const AutoMappingTableFields = Class.create();
AutoMappingTableFields.prototype = {
  initialize: function () {
    this.CAPABILITY_ID = "ca1e4622fffc761004b9ffffffffff05";
    gs.debug("[AutoMapping] Script Include initialized");
  },

  /**
   * Main method: mapFields
   * @param {Array} sourceTable - Source table field list
   * @param {Array} targetTable - Target table field list
   * @returns {Object} JSON mapping result
   */
  mapFields: function (sourceTable, targetTable) {
    gs.debug("[AutoMapping] mapFields() invoked");
    gs.debug("[AutoMapping] Source fields: " + JSON.stringify(sourceTable));
    gs.debug("[AutoMapping] Target fields: " + JSON.stringify(targetTable));
    let request = {
      executionRequests: [
        {
          payload: {
            target_list: targetTable,
            source_list: sourceTable,
            capability_id: this.CAPABILITY_ID,
          },
          mode: "sync",
          capabilityId: this.CAPABILITY_ID,
        },
      ],
    };

    // Calling the one extend API to execute the request to generate the https response
    let response = sn_one_extend.OneExtendUtil.execute(request);

    let capability = response.capabilities
      ? response.capabilities[this.CAPABILITY_ID]
      : null;
    if (capability && capability.result) {
      return JSON.stringify(capability.result);
    }
    return null;
  },
  execute: function (inputs) {
    // called from one extend util
    try {
      const requestPayload = this._buildRequestPayload(
        inputs.source_list,
        inputs.target_list
      );
      const connectionDetails = this._getConnectionInfo(
        inputs._meta._connection_alias
      );
      const response = this._callAutoMappingAPI(
        requestPayload,
        connectionDetails
      );
      const parsedResponse = JSON.parse(response);
      if (
        parsedResponse &&
        parsedResponse.outputs &&
        parsedResponse.outputs[0].data
      ) {
        gs.debug("[AutoMapping] API call completed. Parsing response...");
        const parsedMap = JSON.parse(parsedResponse.outputs[0].data[0]);
        gs.debug("[AutoMapping] Mapping successfully parsed.");
        return {
          result: {
            json_mapping: parsedMap,
          },
        };
      }
      return null;
    } catch (ex) {
      gs.error("[AutoMapping] mapFields() failed: " + ex.message);
      throw ex;
    }
  },

  /**
   * Builds the request payload JSON string for AutoMapping API.
   */
  _buildRequestPayload: function (sourceTable, targetTable) {
    gs.debug("[AutoMapping] Building request payload...");

    const payload = {
      inputs: [
        {
          name: "source_payload",
          shape: [sourceTable.length],
          datatype: "BYTES",
          data: sourceTable,
        },
        {
          name: "target_payload",
          shape: [targetTable.length],
          datatype: "BYTES",
          data: targetTable,
        },
      ],
      outputs: [
        {
          name: "json_mapping",
        },
      ],
    };

    const payloadStr = JSON.stringify(payload);
    gs.debug("[AutoMapping] Request payload: " + payloadStr);
    return payloadStr;
  },

  /**
   * Retrieves Bearer Token from credentials alias.
   */
  _getConnectionInfo: function (connectionId) {
    gs.debug("[AutoMapping] Fetching connection details");
    let provider = new sn_cc.ConnectionInfoProvider();
    let connectionInfo = provider.getConnectionInfo(connectionId);

    if (gs.nil(connectionInfo)) {
      const errorMsg = "No connection details found";
      gs.error("[AutoMapping] " + errorMsg);
      throw new Error(errorMsg);
    }

    return {
      connectionUrl: connectionInfo.getAttribute("connection_url"),
      api_key: connectionInfo.getCredentialAttribute("api_key"),
    };
  },

  /**
   * Makes REST API call to AutoMapping endpoint.
   */
  _callAutoMappingAPI: function (requestPayload, connectionDetails) {
    gs.debug("[AutoMapping] Preparing REST API call...");
    const r = new sn_ws.RESTMessageV2();
    r.setEndpoint(connectionDetails.connectionUrl);
    r.setHttpMethod("POST");
    if (connectionDetails.api_key) {
      r.setRequestHeader(
        "Authorization",
        "Bearer " + connectionDetails.api_key
      );
    }
    this._addHeadersParameters(r, requestPayload);
    r.setRequestBody(requestPayload);

    gs.debug("[AutoMapping] Executing REST message...");
    const response = r.executeAsync();

    const status = response.getStatusCode();
    gs.debug("[AutoMapping] HTTP status code: " + status);

    if (status !== 200) {
      gs.warn("[AutoMapping] Non-200 response received: " + status);
    }

    const body = response.getBody();
    gs.debug("[AutoMapping] Raw response body: " + body);
    return body;
  },
  _addHeadersParameters: function (request, payload) {
    let standardHeaders = sn_ml.MLRecordUtil.populateMetadata();
    request.setRequestHeader("X-Allow-Routing", this.getRouting());
    request.setRequestHeader("Content-Type", "application/json");
    request.setRequestHeader("traceparent", standardHeaders.traceparent);
    request.setRequestHeader("trace_id", standardHeaders.trace_id);
    request.setRequestHeader("instance_id", standardHeaders.instance_id);
    request.setRequestHeader(
      "instance_version",
      standardHeaders.instance_version
    );
    request.setRequestHeader("solution_id", "");
    request.setRequestHeader("solution_name", "");
    request.setRequestHeader("capability_version", "");
    request.setRequestHeader("x-now-transaction-id", gs.generateGUID());
    request.setRequestHeader("Inference-Header-Content-Length", payload.length);
  },
  getRouting: function () {
    if (
      new GlidePluginManager().isActive("com.sn.generative.ai") &&
      gs.getProperty("sn_generative_ai.nowllm_allow_overflow", true) == "true"
    ) {
      return "hybrid";
    } else {
      return "regional";
    }
  },
  type: "AutoMappingTableFields",
};
