(function () {
  'use strict';
  /* global _, angular, console, bURL */

  angular.module('gteApp')
      .controller('SearchCtrl', function ($window, $http, $scope) {
        var allowedBaseUrl = $window.document.referrer.split('/')[0] + '//' + $window.document.referrer.split('/')[2];
        $scope.searchResult = [];

        var receiveMessage = function (event) {
          if (event.origin !== allowedBaseUrl) {
            return;
          }
          console.log(event);
          receiveSearchResult(event);
          $scope.$apply();
        };

        var receiveSearchResult = function (event) {
          var oParser = new DOMParser(),
              xml = oParser.parseFromString(event.data.responseText, 'text/xml'),
              entries = xml.getElementsByTagNameNS('http://schemas.microsoft.com/ado/2007/08/dataservices/metadata', 'properties');

          $scope.searchResult = [];
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i],
                entryObject = {},
                property = entry.firstChild;
            do {
              entryObject[property.nodeName] = property.textContent;
              property = property.nextSibling;
            } while (property !== null);
            $scope.searchResult.push(entryObject)
          }
        };

        var searchInMercury = function (event) {
          var searchFrame = window.frames[window.frames.length - 1],
              r = new XMLHttpRequest(),
              oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/';
          if (window.location.pathname.indexOf('ztrv_te_cre') > -1) {
            oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/Z_FIN_EXPENSE_SRV/';
          }
          r.open('GET', oDataBase + 'ValueHelpList?$filter=FieldName%20eq%20%27POSID%27%20and%20substringof(%27' + event.data.searchTerm + '%27,%20FieldValue)' +
              '&$top=100&$skip=0&sap-client=200', false);
          r.send();
          searchFrame.postMessage({responseText: r.responseText}, bURL);
        };
        $scope.search = function (searchTerm) {
          //noinspection JSCheckFunctionSignatures
          $window.parent.postMessage({f: '(' + searchInMercury + ')', searchTerm: searchTerm}, allowedBaseUrl);
        };

        var transferWBS = function (event) {
          if (window.location.pathname.indexOf('ztrv_te_cre') > -1) {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            var WBS = event.data.WBS,
                r = new XMLHttpRequest(),
                oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/Z_FIN_EXPENSE_SRV/',
                hash = location.hash,
                headerID = hash.split('/')[2],
                fromDate = zmytravelandexpense.util.ZExpenseFormatter.formatDate(hcm.emp.reuse.util.Delegator.parent.oApplicationFacade.oApplicationImplementation
                    .oConnectionManager.getModel().oData["TravelAndExpenseHeaders('040315650045132409_____')"].FromDate, "YYYY-MM-DDThh:mm:ss"),
                toDate = zmytravelandexpense.util.ZExpenseFormatter.formatDate(hcm.emp.reuse.util.Delegator.parent.oApplicationFacade.oApplicationImplementation
                    .oConnectionManager.getModel().oData["TravelAndExpenseHeaders('040315650045132409_____')"].ToDate, "YYYY-MM-DDThh:mm:ss");

            if (hash.indexOf('#/editExpense/TravelAndExpenseHeaders') !== 0) {
              alert('Wrong view to add WBS elements!');
            } else {
              var returnFunction = function () {
                location.hash = hash;
              };
              location.hash = "#/editDetailClaim/ZWBSSEARCH/" + headerID + "/%20/%20/" + fromDate + "/" + toDate + "/%20/false/%20";
              r.open('GET', oDataBase + "WbsSearchHelpList/?$filter=DateFrom%20eq%20datetime%27" + fromDate + "%27%20and%20DateTo%20eq%20datetime%27" + toDate +
                  "%27%20and%20WBSElement%20eq%20%27" + WBS.slice(0, 10) + "%27&$skip=0&$top=50&sap-client=200", false);
              r.send();
              console.log(r.responseText);
              var customerNumber = r.responseText.match(/CustomerNumberout>(\d*)<\/d:CustomerNumberout/)[1];
              /** @namespace zmytravelandexpense.util.WBSElementHelper._addSelectedWBS */
              /** @namespace hcm.emp.reuse.util.Delegator.parent */
              zmytravelandexpense.util.WBSElementHelper._addSelectedWBS(hcm.emp.reuse.util.Delegator.parent, WBS, customerNumber, headerID, " ", " ", false, null, returnFunction);
            }
          } else {
            document.getElementById('__input0-__xmlview4--COST_ASSIGNMENT_MANUAL_INPUT_LIST-1-inner').value = event.data.WBS;
          }
        };
        $scope.transferWBS = function (WBS) {
          //noinspection JSCheckFunctionSignatures
          $window.parent.postMessage({f: '(' + transferWBS + ')', WBS: WBS['d:FieldId']}, allowedBaseUrl);
        };

        $scope.closeOverlay = function () {
          var close = function () {
            window.removeEventListener('message', f);
            //noinspection JSUnresolvedVariable
            frm.parentNode.removeChild(frm);
          };
          //noinspection JSCheckFunctionSignatures
          $window.parent.postMessage({f: '(' + close + ')'}, allowedBaseUrl);
        };

        var positionIFrame = function (e) {
          /** @namespace frm */
          frm.setAttribute('style', 'position:fixed; top: 0; right: 0; width:' + e.data.width + '; height:calc(100% - 3rem - 5px); z-index: 100;');
        };
        var hoverInFrame = function () {
          //noinspection JSCheckFunctionSignatures
          $window.parent.postMessage({f: '(' + positionIFrame + ')', width: '300px'}, allowedBaseUrl);
          $scope.minimized = false;
        };
        var hoverOutFrame = function () {
          //noinspection JSCheckFunctionSignatures
          $window.parent.postMessage({f: '(' + positionIFrame + ')', width: '10px'}, allowedBaseUrl);
          $scope.minimized = true;
        };

        // Setup Mercury integration
        $window.addEventListener('message', receiveMessage);
        hoverInFrame();

        $scope.hoverIn = function () {
          hoverInFrame();
        };

        $scope.hoverOut = function () {
          if (event.fromElement.tagName === 'BODY') {
            hoverOutFrame();
          }
        };
      });
})();
