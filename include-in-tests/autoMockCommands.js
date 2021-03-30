/**
 * cy.testRequests(cb)
 *  Calls cb() with the entire array of requests made from the frontend to the mock server.
 *
 *  * cy.testRequests(filter, cb)
 *  Calls cb() with the array of requests where the URL contains filter.
 */

module.exports = registerAutoMockCommands;

function registerAutoMockCommands() {
  // for recording or mocking:
  let currentMockFileName = null;
  let currentOptions = null;

  // for recording
  let recordedApis = [];

  // for mocking
  let apiKeyToMocks = {};
  let apiKeyToCallCounts = {};
  let mockArray = [];

  let completedPendingRequestsFunc = null;
  var pendingApiCount = 0;
  let automocker = null;

  Cypress.Commands.add("automock", (sessionName, options) => {
    const automockRecord = Cypress.config().automocker
      ? Cypress.config().automocker.record !== false
      : true;
    const automockPlayback = Cypress.config().automocker
      ? Cypress.config().automocker.playback !== false
      : true;

    const testDirPath = "./cypress/integration";
    options = setOptions(options);

    // determine the mock file name
    if (sessionName.indexOf(".json") == -1) {
      sessionName += ".json";
    }

    currentMockFileName = testDirPath + "/../automocks/" + sessionName;

    // get the absolute path for recording purposes
    const pwd = Cypress.platform === "win32" ? "cd" : "pwd";
    const ls = Cypress.platform === "win32" ? "dir " : "ls ";
    cy.exec(pwd, {
      log: false
    }).then(result => {
      const mockFilePath = result.stdout + "/cypress/automocks/" + sessionName;
      const absolutePathToMockFile =
        Cypress.platform === "win32"
          ? mockFilePath.split("/").join("\\")
          : mockFilePath;
      // if the config allows us to replay the mock, test if it exists
      if (automockPlayback) {
        cy.exec(ls + absolutePathToMockFile, {
          failOnNonZeroExit: false,
          log: false
        }).then(result => {
          if (result.code === 0) {
            // file exists, so mock APIs
            cy.readFile(currentMockFileName).then(contents => {
              startApiMocking(contents);
            });
          } else {
            // file doesn't exist, so start recording if allowed
            if (!currentOptions.isCustomMock && automockRecord) {
              startApiRecording();
            }
          }
        });
      } else if (!currentOptions.isCustomMock && automockRecord) {
        startApiRecording();
      }
    });
  });

  Cypress.Commands.add("automockEnd", () => {
    if (automocker.isRecording) {
      cy.automockWaitOnPendingAPIs().then(() => {
        automocker.isRecording = false;
      });
      // use undocumented field to determine if the test failed
      const wasError = typeof cy.state === "function" && !!cy.state().error;
      if (!wasError) {
        cy.writeMockServer();
      }
    }
    automocker.isMocking = false;
  });

  // not implemented for now
  //
  // Cypress.Commands.add("inspectRequests", (param1, param2) => {
  //   if (automocker.isRecording) {
  //     return; // no-op for now when using live server
  //   }
  //   let mockedRequests = testServerAPI.mockedRequests();
  //   let testFunction;

  //   if (typeof param1 === "function") {
  //     testFunction = param1;
  //   } else {
  //     testFunction = param2;
  //     mockedRequests = mockedRequests.filter(val => {
  //       return val.apiKey.indexOf(param1) !== -1;
  //     });
  //   }
  //   testFunction(mockedRequests);
  // });

  Cypress.Commands.add("automockWaitOnPendingAPIs", () => {
    return new Cypress.Promise((resolve, reject) => {
      if (pendingApiCount) {
        console.log("waiting on APIs to complete");
        completedPendingRequestsFunc = function() {
          resolve();
        };
      } else {
        resolve();
      }
    });
  });

  Cypress.Commands.add("writeMockServer", () => {
    if (currentMockFileName !== null && recordedApis) {
      cy.writeFile(currentMockFileName, recordedApis);
      currentMockFileName = null;
    } else {
      currentMockFileName = null;
    }
  });

  automocker = window.Cypress.autoMocker = {
    isRecording: false,
    isMocking: false,
    recordedApis: recordedApis,
    prepareOnLoadHandler: (xhr) => {
      (function () {
        const old_onload = xhr.onload;
        const url = xhr.url;
        const method = xhr.method;

        xhr.onload = () => {
          function recordTransformedObject(
            xhr,
            requestObject,
            responseObject
          ) {
            let contentType = xhr.getResponseHeader("content-type");
            if (
              contentType !== null &&
              contentType.toLowerCase().indexOf("application/json") !== -1
            ) {
              try {
                responseObject = JSON.parse(responseObject);
              } catch (e) {
              }
            }
            let transformedObject = {
              method: xhr.method,
              path: parseUri(xhr.url).path,
              query: parseUri(xhr.url).query,
              request: requestObject,
              response: responseObject,
              status: xhr.status,
              statusText: xhr.statusText,
              contentType: contentType,
              responseHeaders: xhr.getAllResponseHeaders()  // add response headers to record head parameters
            };
            recordedApis.push(transformedObject);
          }

          if (old_onload) {
            old_onload();
          }
          let parsed = parseUri(url);
          let query = "";
          var blobResponseObject = null;

          console.log("RECORD: " + getApiKey(xhr));

          if (typeof xhr.object.response === "object") {
            var fr = new FileReader();
            fr.onload = function (e) {
              var blobText = e.target.result;
              blobResponseObject = JSON.parse(blobText);
              let requestObject = xhr.request
                ? JSON.parse(JSON.stringify(xhr.request))
                : "";
              let responseObject;
              if (!blobResponseObject) {
                responseObject = xhr.response
                  ? JSON.parse(JSON.stringify(xhr.response))
                  : "";
              } else {
                responseObject = blobResponseObject;
              }
              recordTransformedObject(xhr, requestObject, responseObject);
            };
            fr.readAsText(xhr.object.response);
          } else {
            let requestObject = xhr.request
              ? JSON.parse(JSON.stringify(xhr.request))
              : "";
            let responseObject = xhr.response
              ? JSON.parse(JSON.stringify(xhr.response))
              : "";
            recordTransformedObject(xhr, requestObject, responseObject);
          }
        };
      })();
    },
    autoMockResponse: (request) => {
      let key = getApiKey(request);
      let mock = null;
      if (apiKeyToMocks.hasOwnProperty(key)) {
        const apiCount = apiKeyToCallCounts[key]++;
        if (apiCount < apiKeyToMocks[key].length) {
          mock = apiKeyToMocks[key][apiCount];
        }
      }
      if (currentOptions.resolveMockFunc) {
        mock = currentOptions.resolveMockFunc(request, mockArray, mock);
      }
      // this header gets called to parse the header from mock into key, value object.
      // let headers = (completeMatch, keyword, data) => {
      //   // get the raw header string
      //   let headers = mock.responseHeaders;
      //
      //   // convert the header string into an array of individual headers
      //   let arr = headers.trim().split(/[\r\n]+/);
      //
      //   // create a map of header names to values
      //   let headerMap = {};
      //   arr.forEach(line => {
      //     let parts = line.split(': ');
      //     let header = parts.shift();
      //     headerMap[header] = parts.join(': ');
      //   });
      //   return headerMap;
      // }
      if (mock) {
        console.log("MOCKING " + getApiKey(request));
        return {
          status: mock.status,
          statusText: mock.statusText,
          response: JSON.stringify(mock.response),
          // headers: headers,
          responseHeaders: mock.responseHeaders
        };
      }
    },
    mockResponse: request => {
      if (automocker.isMocking) {
        window.Cypress.autoMocker.autoMockResponse(request);
      } else if (automocker.isRecording) {
        window.Cypress.autoMocker.prepareOnLoadHandler(request);
      }
      if (automocker.isMocking) {
        console.log(
          "MOCKING ON, but letting this fall through cause it could not find a match: " + getApiKey(request)
        );
      }
      ++pendingApiCount;
      return false;
    },

    onloadstart: event => {},

    onloadend: event => {
      --pendingApiCount;
      if (!pendingApiCount && completedPendingRequestsFunc) {
        completedPendingRequestsFunc();
        completedPendingRequestsFunc = null;
      }
    }
  };

  function startApiRecording() {
    automocker.isRecording = true;
    recordedApis = [];
  }

  function startApiMocking(mocks) {
    automocker.isMocking = true;
    apiKeyToMocks = {};
    apiKeyToCallCounts = {};
    mockArray = mocks;

    mocks.forEach(function (mock) {
      const key = getApiKey(mock);
      if (!apiKeyToMocks.hasOwnProperty(key)) {
        apiKeyToMocks[key] = [];
        apiKeyToCallCounts[key] = 0;
      }
      apiKeyToMocks[key].push(mock);
    });

    console.log("USING MOCK SERVER");
    console.log("MOCK DIRECTORY");
    console.log(apiKeyToMocks);
  }

  function setOptions(options) {
    // create & set up default options
    if (!options) {
      options = {};
    }

    if (options.isCustomMock == undefined) {
      options.isCustomMock = false;
    }
    if (options.outDir == undefined) {
      options.ourDir = '/tests/e2e/mocks';
    }

    currentOptions = options;
    return options;
  }

  function getApiKey(api) {
    let path = api.path;
    if (api.query && ["GET", "HEAD"].includes(api.method)) {
      path = path + "?" + api.query;
    }
    if (api.url) {
      let uri = parseUri(api.url);
      path = uri.path;
      if (uri.query) {
        path = path + "?" + uri.query;
      }
    }

    return api.method + "." + path;
  }

  // (c) Steven Levithan <stevenlevithan.com>
  // MIT License

  function parseUri(str) {
    var o = parseUri.options,
      m = o.parser[o.strictMode ? "strict" : "loose"].exec(str),
      uri = {},
      i = 14;

    while (i--) uri[o.key[i]] = m[i] || "";

    uri[o.q.name] = {};
    uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
      if ($1) uri[o.q.name][$1] = $2;
    });

    return uri;
  }

  parseUri.options = {
    strictMode: false,
    key: [
      "source",
      "protocol",
      "authority",
      "userInfo",
      "user",
      "password",
      "host",
      "port",
      "relative",
      "path",
      "directory",
      "file",
      "query",
      "anchor"
    ],
    q: {
      name: "queryKey",
      parser: /(?:^|&)([^&=]*)=?([^&]*)/g
    },
    parser: {
      strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
      loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
    }
  };
}
