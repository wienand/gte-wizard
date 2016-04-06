(function () {
  'use strict';
  /* global _, angular, console, bURL */

  angular.module('gteApp')
      .controller('SearchCtrl', function ($window, $http, $scope) {
        var allowedBaseUrl = $window.document.referrer.split('/')[0] + '//' + $window.document.referrer.split('/')[2];
        $scope.storeOfWBS = JSON.parse(localStorage.timesheetWBS || '[]');
        var sortWithLastUsed = function (left, right) {
              if (left.hasOwnProperty('TSP_LastUsed') && right.hasOwnProperty('TSP_LastUsed')) {
                if (left.TSP_LastUsed < right.TSP_LastUsed) {
                  return -1;
                }
                if (left.TSP_LastUsed > right.TSP_LastUsed) {
                  return 1;
                }
              }
              if (left.hasOwnProperty('TSP_LastUsed')) {
                return -1;
              }
              if (right.hasOwnProperty('TSP_LastUsed')) {
                return 1;
              }
              if (left.TSP_LastSeen < right.TSP_LastSeen) {
                return -1;
              }
              if (left.TSP_LastSeen > right.TSP_LastSeen) {
                return 1;
              }
              if (left['d:FieldValue'] > left['d:FieldValue']) {
                return 1;
              }
              return -1;
            },
            sortByName = function (left, right) {
              if (left['d:FieldValue'] > left['d:FieldValue']) {
                return 1;
              }
              return -1;
            };
        $scope.storeOfWBS.sort(sortWithLastUsed);
        $scope.storeOfWBS.splice(10000);

        var receiveMessage = function (event) {
          if (event.origin !== allowedBaseUrl) {
            return;
          }
          receiveSearchResult(event);
          $scope.searchingInMercury = false;
          $scope.$apply();
        };

        var receiveSearchResult = function (event) {
          var oParser = new DOMParser(),
              xml = oParser.parseFromString(event.data.responseText, 'text/xml'),
              entries = xml.getElementsByTagNameNS('http://schemas.microsoft.com/ado/2007/08/dataservices/metadata', 'properties'),
              newWBS = [], newLookupWBS = {};

          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i],
                WBS = {},
                property = entry.firstChild;
            do {
              WBS[property.nodeName] = property.textContent;
              property = property.nextSibling;
            } while (property !== null);

            WBS.TSP_LastSeen = new Date();
            newWBS.push(WBS);
            newLookupWBS[WBS['d:FieldId']] = WBS;
          }
          $scope.storeOfWBS = _.reject($scope.storeOfWBS, function(WBS) {
            if (newLookupWBS.hasOwnProperty(WBS['d:FieldId'])) {
              if (WBS.hasOwnProperty('TSP_LastUsed')) {
                newLookupWBS[WBS['d:FieldId']].TSP_LastUsed = WBS.TSP_LastUsed;
              }
              return true;
            }
          });
          $scope.storeOfWBS = $scope.storeOfWBS.concat(newWBS);
          $scope.storeOfWBS.sort(sortByName);
          localStorage.timesheetWBS = JSON.stringify($scope.storeOfWBS);
        };

        var searchInMercury = function (event) {
          var searchFrame = window.frames[window.frames.length - 1],
              r = new XMLHttpRequest(),
              oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/';
          if (window.location.pathname.indexOf('ztrv_te_cre') > -1) {
            oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/Z_FIN_EXPENSE_SRV/';
          }
          var searchResultReady = function () {
            searchFrame.postMessage({responseText: r.responseText}, bURL);
          };
          r.open('GET', oDataBase + 'ValueHelpList?$filter=FieldName%20eq%20%27POSID%27%20and%20substringof(%27' + event.data.searchTerm + '%27,%20FieldValue)' +
              '&$top=100&$skip=0&sap-client=200');
          r.addEventListener("load", searchResultReady);
          r.send();
        };
        $scope.search = function (searchTerm) {
          //noinspection JSCheckFunctionSignatures
          $scope.searchTerm = searchTerm;
          $scope.searchTermLast = searchTerm;
          $scope.searchingInMercury = true;
          $window.parent.postMessage({f: '(' + searchInMercury + ')', searchTerm: searchTerm}, allowedBaseUrl);
        };

        var transferWBS = function (event) {
          if (window.location.pathname.indexOf('ztrv_te_cre') > -1) {
            //noinspection JSUnresolvedVariable,JSUnresolvedFunction
            var hash = location.hash;
            if (!((hash.indexOf('#/editExpense/TravelAndExpenseHeaders') === 0) || (hash.indexOf('#/newExpense/TravelAndExpenseHeaders') === 0))) {
              alert('Wrong view to add WBS elements!');
            } else {
              var WBS = event.data.WBS,
                  r = new XMLHttpRequest(),
                  oDataBase = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/Z_FIN_EXPENSE_SRV/',
                  headerID = hash.split('/')[2],
                  linkToUI5 = hcm.emp.reuse.util.Delegator.parent,
                  model = linkToUI5.oApplicationFacade.oApplicationImplementation.oConnectionManager.getModel(),
                  fromDate = zmytravelandexpense.util.ZExpenseFormatter.formatDate(model.oData[headerID].FromDate, "YYYY-MM-DDThh:mm:ss"),
                  toDate = zmytravelandexpense.util.ZExpenseFormatter.formatDate(model.oData[headerID].ToDate, "YYYY-MM-DDThh:mm:ss"),
                  book100percent = model.oData[headerID].CostAssignments.__list.length === 0,
                  returnFunction = function () {
                    location.hash = hash;
                  };
              location.hash = "#/editDetailClaim/ZWBSSEARCH/" + headerID + "/%20/%20/" + fromDate + "/" + toDate + "/%20/false/%20";
              r.open('GET', oDataBase + "WbsSearchHelpList/?$filter=DateFrom%20eq%20datetime%27" + fromDate + "%27%20and%20DateTo%20eq%20datetime%27" + toDate +
                  "%27%20and%20WBSElement%20eq%20%27" + WBS.slice(0, 10) + "%27&$skip=0&$top=50&sap-client=200", false);
              r.send();
              if (r.responseText.indexOf('d:CustomerNumberout') === -1) {
                alert('WBS element cannot be used for this trip and date, maybe check with pure Mercury functionality ...');
                returnFunction();
              }
              var customerNumber = r.responseText.match(/CustomerNumberout>(\w*)<\/d:CustomerNumberout/)[1];
              /** @namespace zmytravelandexpense.util.WBSElementHelper._addSelectedWBS */
              /** @namespace hcm.emp.reuse.util.Delegator.parent */
              zmytravelandexpense.util.WBSElementHelper._addSelectedWBS(linkToUI5, WBS, customerNumber, headerID, " ", " ", book100percent, null, returnFunction);
            }
          } else {
            document.getElementById('__input0-__xmlview4--COST_ASSIGNMENT_MANUAL_INPUT_LIST-1-inner').value = event.data.WBS;
          }
        };
        $scope.transferWBS = function (WBS) {
          //noinspection JSCheckFunctionSignatures
          WBS.TSP_LastUsed = new Date();
          localStorage.timesheetWBS = JSON.stringify($scope.storeOfWBS);
          $window.parent.postMessage({f: '(' + transferWBS + ')', WBS: WBS['d:FieldId']}, allowedBaseUrl);
        };

        $scope.removeWBS = function (WBS) {
          var index = $scope.storeOfWBS.indexOf(WBS);
          if (index > -1) {
            $scope.storeOfWBS.splice(index, 1);
            localStorage.timesheetWBS = JSON.stringify($scope.storeOfWBS);
          }
        };

        $scope.removeAllWBS = function () {
          $scope.storeOfWBS = [];
          localStorage.timesheetWBS = JSON.stringify($scope.storeOfWBS);
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
          $window.parent.postMessage({f: '(' + positionIFrame + ')', width: '12px'}, allowedBaseUrl);
          $scope.minimized = true;
        };

        // Setup Mercury integration
        $window.addEventListener('message', receiveMessage);
        hoverInFrame();

        $scope.hoverIn = function () {
          hoverInFrame();
        };

        $scope.hoverOut = function () {
          if ((event.relatedTarget === null) && (event.clientX < 200)) {
            hoverOutFrame();
          }
        };

        $scope.$watch('searchTerm', function(newValue, oldValue) {
          if ((newValue === '') && (oldValue !== '')) {
            $scope.storeOfWBS.sort(sortWithLastUsed);
          }
          if ((newValue !== '') && (oldValue === '')) {
            $scope.storeOfWBS.sort(sortByName);
          }
        })
      });
})();
