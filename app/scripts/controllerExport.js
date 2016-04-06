(function () {
  'use strict';
  /* global _, angular, console, moment, alert, confirm */

  angular.module('gteApp')
      .controller('ExportTableCtrl', function ($window, $http, $scope) {
        var chargeTypes = {
          A: 'Absences',
          C: 'Cost centers',
          E: 'External projects',
          I: 'Internal projects'
        };

        $scope.tableData = [];
        $scope.minDate = moment('19800926');
        $scope.maxDate = moment('19800926');
        $scope.days = [];

        var addEngagementActivity = function (entry) {
          entry.EngagementCode = entry.POSID['d:FieldValue'].split('-');
          entry.ActivityCode = entry.EngagementCode.pop();
          entry.EngagementCode = entry.EngagementCode.join('-');
          entry.Engagement = entry.POSID['d:FieldValueText'].split('(')[0].trim().split('-');
          entry.Activity = entry.Engagement.pop();
          entry.Engagement = entry.Engagement.join('-');
          return entry;
        };

        $scope.getTotalFor = function (tableData, day, days, type) {
          return _.reduce(tableData, function (memo, row) {
                if (row.days[days.indexOf(day)] !== undefined) {
                  if (!type || (row.days[days.indexOf(day)].POSID['d:FieldValue'].charAt(0) === type.charAt(0))) {
                    return memo + (row.days[days.indexOf(day)].TIME['d:FieldValue'] || 0);
                  }
                }
                return memo;
              }, 0) || null;
        };

        $scope.getTotal = function (tableData) {
          return _.reduce(tableData, function (memo, row) {
            return memo + row.total;
          }, 0)
        };

        $scope.aggregateByType = function (tableData) {
          var totalByType = {};
          _.forEach(tableData, function (row) {
            var WBS = row.plain.POSID['d:FieldValue'],
                chargeType = chargeTypes[WBS.charAt(0)] || WBS.charAt(0);
            totalByType[chargeType] = totalByType[chargeType] || 0;
            totalByType[chargeType] += row.total;
          });
          return totalByType;
        };

        var allowedBaseUrl = false,
            mercuryWindow;
        var receiveMessage = function (event) {
          if (event.data === 'Hello from Mercury') {
            if (!allowedBaseUrl) {
              allowedBaseUrl = event.origin;
              mercuryWindow = event.source;
              mercuryWindow.postMessage({msg: 'Get current timesheet data', f: '(function(){})'}, allowedBaseUrl);
            }
            return;
          }
          if (event.origin !== allowedBaseUrl) {
            return;
          }
          receiveMercuryData(event);
          $scope.$apply();
        };

        var receiveMercuryData = function (event) {
          var oParser = new DOMParser(),
              xml = oParser.parseFromString(event.data.responseText, 'text/xml'),
              entries = xml.getElementsByTagNameNS('http://schemas.microsoft.com/ado/2007/08/dataservices/metadata', 'properties'),
              entryObjects = {}, entryObject,
              tableFormat = {}, tableAggregated = {}, minDate = '99991231', maxDate = '00000000';

          $scope.delegatorID = event.data.delegatorID;
          $scope.timesheetOf = event.data.timesheetOf;
          for (var i = 0; i < entries.length; i++) {
            var entry = entries[i],
                tmp = {},
                property = entry.firstChild;
            do {
              tmp[property.nodeName] = property.textContent;
              property = property.nextSibling;
            } while (property !== null);
            entryObject = entryObjects[tmp['d:WorkDate'] + '-' + tmp['d:RecordNumber']] || {};
            entryObject[tmp['d:FieldName']] = tmp;
            entryObjects[tmp['d:WorkDate'] + '-' + tmp['d:RecordNumber']] = entryObject;
            minDate = (tmp['d:WorkDate'] < minDate) ? tmp['d:WorkDate'] : minDate;
            maxDate = (maxDate < tmp['d:WorkDate']) ? tmp['d:WorkDate'] : maxDate;
          }
          for (var tag in entryObjects) {
            if (entryObjects.hasOwnProperty(tag)) {
              entryObject = entryObjects[tag];
              var tableKey = entryObject.POSID['d:FieldValue'] + ' ' +
                  entryObject.STATUS['d:FieldValue'] + ' ' +
                  entryObject.NOTES['d:FieldValueText'] + ' ' +
                  entryObject.ZZYLOC['d:FieldValue'] + ' ' +
                  entryObject.ZZYROLE['d:FieldValue'] +
                  (entryObject.AWART ? entryObject.AWART['d:FieldValue'] : '');
              tableFormat[tableKey] = tableFormat[tableKey] || {};
              tableFormat[tableKey][entryObject.POSID['d:WorkDate']] = tableFormat[tableKey][entryObject.POSID['d:WorkDate']] || [];
              tableFormat[tableKey][entryObject.POSID['d:WorkDate']].push(entryObject);
              tableAggregated[tableKey] = tableAggregated[tableKey] || {};
              if (tableAggregated[tableKey].hasOwnProperty(entryObject.POSID['d:WorkDate'])) {
                tableAggregated[tableKey][entryObject.POSID['d:WorkDate']].TIME['d:FieldValue'] += parseFloat(entryObject.TIME['d:FieldValue']);
              } else {
                entryObject.TIME['d:FieldValue'] = parseFloat(entryObject.TIME['d:FieldValue']);
                tableAggregated[tableKey][entryObject.POSID['d:WorkDate']] = entryObject;
              }
            }
          }
          $scope.tableData = [];
          $scope.requestDate = moment(event.data.requestDate);
          $scope.minDate = moment((event.data.minDate < minDate) ? event.data.minDate : minDate);
          $scope.maxDate = moment((event.data.maxDate < maxDate) ? maxDate : event.data.maxDate);
          $scope.days = [$scope.minDate];
          var day = $scope.minDate;
          while (day < $scope.maxDate) {
            day = moment(day);
            day.add(1, 'days');
            $scope.days.push(day);
          }
          _.forEach(tableAggregated, function (row) {
            $scope.tableData.push({
              days : _.map($scope.days, function (day) {
                return row[day.format('YYYYMMDD')]
              }),
              plain: addEngagementActivity(_.values(row)[0]),
              total: _.reduce(row, function (memo, entry) {
                return memo + (entry.TIME['d:FieldValue'] || 0);
              }, 0)
            });
          });
          var comparatorForSort = function (left, right) {
            if (left.plain.POSID['d:FieldValue'] < right.plain.POSID['d:FieldValue']) {
              return -1;
            }
            if (left.plain.POSID['d:FieldValue'] === right.plain.POSID['d:FieldValue']) {
              if (left.plain.AWART && !right.plain.AWART) {
                return 1
              }
              if (!left.plain.AWART && right.plain.AWART) {
                return -1
              }
              var i = 0;
              while (!left.days[i] && !right.days[i] && i < $scope.days.length) {
                i += 1;
              }
              if ((i < $scope.days.length) && left.days[i]) {
                return -1;
              }
            }
            return 1;
          };
          $scope.tableData.sort(comparatorForSort);
        };
        $window.addEventListener('message', receiveMessage);

        // Mercury integration
        $scope.onTopOfMercury = $window.self !== $window.top;
        $scope.originOfMercury = $window.document.referrer.split('/')[0] + '//' + $window.document.referrer.split('/')[2];
        $scope.originOfMyself = $window.location.origin;
        if ($scope.onTopOfMercury) {
          allowedBaseUrl = $scope.originOfMercury;
          var positionIFrame = function () {
            frm.setAttribute('style', 'position:fixed; top: 0; left: 0; width:100%; height:100%; z-index: 100;');
          };
          $window.parent.postMessage({f: '(' + positionIFrame + ')'}, $scope.originOfMercury);
          $http.get('scripts/exportFromMercury.js').then(function (response) {
            $window.parent.postMessage({
              f: '(function(calledInFrame) {' + response.data.replace('http://localhost:9050', $window.location.origin) + '})'
            }, $scope.originOfMercury)
          }, function (response) {
            console.log(response);
            alert('Error during downloading of export script!');
          });
        }
        $scope.closeOverlay = function () {
          var close = function () {
            window.removeEventListener('message', f);
            //noinspection JSUnresolvedVariable
            frm.parentNode.removeChild(frm);
          };
          $window.parent.postMessage({f: '(' + close + ')'}, $scope.originOfMercury);
        };

        var ua = $window.navigator.userAgent;
        $scope.detectIE = !!(ua.indexOf('MSIE ') > 0 || ua.indexOf('Trident/') > 0 || ua.indexOf('Edge/') > 0);
      });
})();
