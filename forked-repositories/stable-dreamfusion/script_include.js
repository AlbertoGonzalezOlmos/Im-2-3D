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
   * Retrieves Bearer Token from credentials alias. The Bearer Token is only necessary when hitting Toolkit endpoints.
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

    let connectionObj = {};
    connectionObj["connectionUrl"] =
      connectionInfo.getAttribute("connection_url");

    if (!gs.nil(connectionInfo.getCredentialAttribute("api_key"))) {
      connectionObj["api_key"] =
        connectionInfo.getCredentialAttribute("api_key");
    }

    return connectionObj;
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
    r.setRequestHeader("Content-Type", "application/json");
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
  type: "AutoMappingTableFields",
};
