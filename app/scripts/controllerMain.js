(function () {
  'use strict';
  /* global _, angular, console, moment, alert, confirm */

  /**
   * @return {string}
   */
  function Z7() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substr(1);
  }

  angular.module('gteApp')
      .controller('TimesheetCtrl', function ($window, $http, $timeout, $location, $scope) {
        var batchToRows = {},
            batchToWeekdays = {},
            weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            weekdaysForGTE = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            findEngagementRE = /^(.*(\s|[\(]))?(\w-\w{8}-[\w@]{4})((\s|[\)]).*)?$/,
            chargeTypes = {
              A: 'Absences',
              C: 'Cost center',
              E: 'External',
              I: 'Internal',
              D: 'Internal'
            };
        $scope.state = {
          saveInProgress: false,
          hideWeekend   : $location.search()['hideWeekend'] === '1'
        };
        $scope.callbackToggleFactory = function (row) {
          return function (stopped, oldTime, newTime) {
            var weekday = weekdays[(new Date()).getDay()];
            row[weekday] += newTime - oldTime;
            row.totalTime = newTime;
          };
        };
        $scope.getTotalFor = function (rows, field) {
          return _.reduce(_.pluck(_.filter(rows, function (row) {
            return !row.engagement || (row.engagement.charAt(0) !== 'X');
          }), field), function (sum, el) {
            return sum + el;
          }, 0);
        };
        $scope.getTotalDiff = function (rows) {
          var totalDiff = 0;
          _.forEach(rows, function (row) {
            if (!row.engagement || (row.engagement.charAt(0) !== 'X')) {
              totalDiff += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday - row.totalTime;
            }
          });
          return totalDiff;
        };
        $scope.getTotal = function (rows) {
          var total = 0;
          _.forEach(rows, function (row) {
            if (!row.engagement || (row.engagement.charAt(0) !== 'X')) {
              total += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday;
            }
          });
          return total;
        };
        $scope.aggregateByType = function (rows) {
          var totalByType = {};
          _.forEach(rows, function (row) {
            var chargeType = 'Unknown';
            if (row.engagement) {
              var baseWBS = row.engagement.match(findEngagementRE);
              if (baseWBS) {
                chargeType = chargeTypes[baseWBS[3].charAt(0)] || baseWBS[3];
              }
            }
            totalByType[chargeType] = totalByType[chargeType] || 0;
            totalByType[chargeType] += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday;
          });
          return totalByType;
        };
        $scope.deleteAllRows = function (rows) {
          if (confirm('Delete all rows?\n\nATTENTION: Data cannot be recovered afterwards!')) {
            _.forEach(rows, function (row) {
              row._immediateUpdate = true;
              _.forEach(weekdaysForGTE, function (day) {
                row[day] = 0;
              });
            });
            rows.splice(0, rows.length);
            $window.localStorage.timesheetChangeUUID = localChangeUUID;
            $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
          }
        };
        $scope.addRow = function () {
          var newRow = {
            mercury    : {},
            _startTime : null,
            _running   : null,
            totalTime  : 0,
            engagement : '',
            activity   : '0000 - General',
            description: '',
            location1  : ($scope.rowsForGTE && ($scope.rowsForGTE.length > 0) && $scope.rowsForGTE[0].location1) || 'DE',
            location2  : ($scope.rowsForGTE && ($scope.rowsForGTE.length > 0) && $scope.rowsForGTE[0].location2) || 'REG',
            saturday   : 0,
            sunday     : 0,
            monday     : 0,
            tuesday    : 0,
            wednesday  : 0,
            thursday   : 0,
            friday     : 0
          };
          $scope.rowsForGTE.push(newRow);
          addWatchesForRow(newRow);
        };
        $scope.submitRows = function (rows) {
          _.forEach(rows, function (row) {
            updateRowDelayed(row, 'X');
          });
        };
        $scope.swapRows = function (rows, indexA, indexB) {
          var tmp = rows[indexA];
          rows[indexA] = rows[indexB];
          rows[indexB] = tmp;
        };
        $scope.roundRow = function (row, rowOfSameGroup) {
          var remainder = 0;
          row._lastDayWithValues = null;
          _.forEach(weekdaysForGTE, function (weekday) {
            if (row[weekday] >  0) {
              var roundedValue = Math.floor((row[weekday] + remainder) * 10) / 10;
              remainder = row[weekday] + remainder - roundedValue;
              row[weekday] = roundedValue;
              if (roundedValue > 0) {
                row._lastDayWithValues = weekday;
              }
            }
          });
          if (row._lastDayWithValues) {
            row[row._lastDayWithValues] += remainder;
            if (rowOfSameGroup && rowOfSameGroup._lastDayWithValues) {
              var remainderFromLast = rowOfSameGroup[rowOfSameGroup._lastDayWithValues] - Math.floor(rowOfSameGroup[rowOfSameGroup._lastDayWithValues] * 10) / 10;
              rowOfSameGroup[rowOfSameGroup._lastDayWithValues] -= remainderFromLast;
              row[row._lastDayWithValues] += remainderFromLast;
            }
          }
          return row;
        };
        $scope.roundRows = function (rows, crossLineDistribute) {
          if (!crossLineDistribute) {
            crossLineDistribute = function(row) {
              return null;
            }
          }
          var distributeCache = {};
          _.forEach(rows, function (row) {
            var tag = crossLineDistribute(row);
            if (tag) {
              distributeCache[tag] = $scope.roundRow(row, distributeCache[tag] || false);
            } else {
              $scope.roundRow(row);
            }
          });
        };
        $scope.clearTimes = function (rows) {
          if (confirm('Set all hours to zero?\n\nATTENTION: Data cannot be recovered afterwards!')) {
            _.forEach(rows, function (row) {
              if (!row.engagement || row.engagement.charAt(0) !== 'X') {
                row.totalTime = 0;
                row.saturday = 0;
                row.sunday = 0;
                row.monday = 0;
                row.tuesday = 0;
                row.wednesday = 0;
                row.thursday = 0;
                row.friday = 0;
              }
            });
          }
        };
        function orderByProperty(prop) {  
          var args = Array.prototype.slice.call(arguments, 1);  
          return function (a, b) {  
          var equality;  
          if (typeof a[prop] === 'string' && typeof b[prop] === 'string') {  
            if (a[prop] < b[prop]) {  
                equality = -1;  
              } else if (a[prop] > b[prop]) {  
                equality = 1;  
              } else {  
                equality = 0;  
              }  
            } else {  
              equality = b[prop] - a[prop];  
            }  
           if (equality === 0 && arguments.length > 1) {  
              return orderByProperty.apply(null, args)(a, b);  
            }  
          return equality;  
          };  
        }          
        $scope.sortEngagement = function (rows) {  
          $scope.rowsForGTE = rows.sort(orderByProperty('engagement', 'description', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));  
          $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
          $window.localStorage.timesheetChangeUUID = localChangeUUID;
        };

        $scope.sortDescription = function (rows) {  
          $scope.rowsForGTE = rows.sort(orderByProperty('description', 'engagement', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'));  
          $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
          $window.localStorage.timesheetChangeUUID = localChangeUUID;  
        };



        $scope.removeTypeaheadEntry = function (key, index, entry) {
          $scope.typeahead[key].splice(index, 1);
          delete $scope.typeaheadLastUsed[key][entry];
          $window.localStorage.timesheetChangeUUID = localChangeUUID;
          $window.localStorage.typeahead = JSON.stringify($scope.typeaheadLastUsed);
        };
        var addTypeaheadEntry = function (key, entry) {
          $scope.typeahead[key].push(entry);
          $scope.typeaheadLastUsed[key][entry] = (new Date()).toJSON();
        };
        $scope.addTypeaheadEntries = function (key, entries) {
          if (entries.indexOf('\n') === -1) {
            addTypeaheadEntry(key, entries);
          } else {
            _.forEach(entries.split('\n'), function (row) {
              addTypeaheadEntry(key, row.split('\t').join(' - '));
            });
          }
        };

        var guid = function () {
          var s4 = function () {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
          };
          return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };
        var localChangeUUID = guid(),
            watches = [];
        var addWatchesForRow = function (row) {
          var
              firstCall = true,
              delayedSaveOfTypeahead;
          if (row.hasOwnProperty('$$hashKey')) {
              delete row.$$hashKey;
          }
          watches.push($scope.$watch(function () {
            return row.totalTime;
          }, function (newValue, oldValue) {
            if (newValue !== oldValue) {
              console.log('Changed ' + row.engagement + ' (' + row.activity + '): ' + oldValue + ' --> ' + newValue);
            }
          }));
          watches.push($scope.$watchCollection(function () {
            return row;
          }, function () {
            if (firstCall) {
              firstCall = false;
            } else {
              $window.localStorage.timesheetChangeUUID = localChangeUUID;
              $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
              $timeout.cancel(delayedSaveOfTypeahead);
              delayedSaveOfTypeahead = $timeout(saveNewTypeahead, 5000);
              updateRowDelayed(row, row._immediateUpdate && ' ');
            }
          }));
        };

        var updateRowsFromLocalStorage = function (calledInScope) {
          $scope.rowsForGTE = JSON.parse($window.localStorage.rowsForGTE || null) || $scope.rowsForGTE || [];
          while (watches.length > 0) {
            var watch = watches.pop();
            watch();
          }
          _.forEach($scope.rowsForGTE, addWatchesForRow);
          if (!calledInScope) {
            $scope.$apply();
          }
        };
        var updateTypeaheadFromLocalStorage = function (calledInScope) {
          $scope.typeaheadLastUsed = JSON.parse($window.localStorage.typeahead || null) || $scope.typeaheadLastUsed;
          _.forEach($scope.typeaheadLastUsed, function (value, key, list) {
            $scope.typeahead[key] = _.keys(list[key]);
            $scope.typeahead[key].sort();
          });
          if (!calledInScope) {
            $scope.$apply();
          }
        };
        var createTypeAheadLists = function () {
          $scope.typeahead = $scope.typeahead || {};
          _.forEach($scope.typeaheadLastUsed, function (value, key, list) {
            $scope.typeahead[key] = _.keys(list[key]);
            $scope.typeahead[key].sort();
          });
        };
        var saveNewTypeahead = function () {
          _.forEach($scope.typeahead, function (value, key, list) {
            var entries = _.pluck($scope.rowsForGTE, key);
            list[key] = _.union(entries, value);
            _.extend($scope.typeaheadLastUsed[key], _.object(_.map(entries, function (entry) {
              return [entry, new Date().toJSON()];
            })));
            if (key !== 'description') {
              _.forEach($scope.typeaheadLastUsed[key], function (lastUsed, entry) {
                if (_.some($scope.typeaheadLastUsed[key], function (lastUsedOther, entryOther) {
                      return (entryOther.indexOf(entry) > -1) && (entryOther.length > entry.length) && (lastUsed < lastUsedOther);
                    })) {
                  delete $scope.typeaheadLastUsed[key][entry];
                }
              });
            }
          });
          createTypeAheadLists();
          $window.localStorage.timesheetChangeUUID = localChangeUUID;
          $window.localStorage.typeahead = JSON.stringify($scope.typeaheadLastUsed);
        };
        $scope.typeaheadLastUsed = JSON.parse($window.localStorage.typeahead || null) ||
            {
              engagement : {},
              description: {},
              location1  : {'DE': new Date().toJSON()},
              location2  : {'REG': new Date().toJSON()}
            };
        createTypeAheadLists();
        //updateRowsFromLocalStorage(true);

        addEventListener('storage', function (e) {
          if ($window.localStorage.timesheetChangeUUID === localChangeUUID) {
            return;
          }
          if (e.key === 'rowsForGTE') {
            //updateRowsFromLocalStorage();
          }
          if (e.key === 'typeahead') {
            updateTypeaheadFromLocalStorage();
          }
        }, false);

        $scope.refMomentForExport = moment().startOf('week');
        $scope.sendTimesheetUpdate = $scope.sendTimesheetUpdate || {};
        $scope.sendTimesheetUpdate.exec = function (rowsForGTE) {
          $window.localStorage.timesheetChangeUUID = localChangeUUID;
          $window.localStorage.rowsForGTE = JSON.stringify(rowsForGTE);
          //updateRowsFromLocalStorage(rowsForGTE);
          $scope.$apply();
        };

        // Mercury integration
        $scope.onTopOfMercury = $window.self !== $window.top;
        $scope.originOfMercury = $window.document.referrer.split('/')[0] + '//' + $window.document.referrer.split('/')[2];
        $scope.originOfMyself = $window.location.origin;
        $scope.noHTTPS = false;
        if ($window.location.protocol === 'http:') {
          $scope.originOfMyself = 'https://defravmfoi0d51c.ey.net';
          $scope.noHTTPS = true;
        }
        $scope.printTimesheet = function () {
          $http.get('scripts/exportFromMercury.js').then(function (response) {
            $window.parent.postMessage({f: '(function(event) {' + response.data.replace('http://localhost:9050', $window.location.origin) + '})'}, $scope.originOfMercury)
          }, function (response) {
            console.log(response);
            alert('Error during downloading of export script!');
          });
        };
        var receiveMessage = function (event) {
          console.log(event);
          if (event.origin !== $scope.originOfMercury) {
            return;
          }
          if (event.data.msg === 'Timesheet data') {
            receiveMercuryData(event);
          }
          if (event.data.msg === 'Response from TimeEntryOperation') {
            updateMercuryData(event);
          }
          $scope.$apply();
        };
        $window.addEventListener('message', receiveMessage);
        $scope.closeOverlay = function () {
          var close = function () {
            window.removeEventListener('message', f);
            //noinspection JSUnresolvedVariable
            frm.parentNode.removeChild(frm);
          };
          $window.parent.postMessage({f: '(' + close + ')'}, $scope.originOfMercury);
        };
        $scope.loadInitialMercuryData = function (refMoment) {
          var getMercuryData = function () {
            var
                delegatorID = hcm.emp.reuse.util.Delegator.parent.oConnectionManager.getModel().getHeaders().DelegatorID,
                baseTimesheetURL = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/',
                r = new XMLHttpRequest(),
                result = {
                  msg        : 'Timesheet data',
                  requestDate: new Date(),
                  delegatorID: delegatorID,
                  timesheetOf: hcm.emp.reuse.util.Delegator.oPageTitle
                };
            if (delegatorID) {
              baseTimesheetURL = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/FTTE/ENH_SRA002_TIMESHEET_SRV/';
            }
            r.open('GET', baseTimesheetURL + 'TimeDataList?$filter=StartDate%20eq%20%27' + e.data.minDate + '%27%20and%20EndDate%20eq%20%27' + e.data.maxDate + '%27&sap-client=200', false);
            if (delegatorID) {
              r.setRequestHeader("DelegatorID", delegatorID);
            }
            r.send();
            result.responseText = r.responseText;
            exportTimesheet.postMessage(result, bURL);
          };
          $window.parent.postMessage({
                f      : '(' + getMercuryData + ')',
                minDate: moment(refMoment).add(-1, 'days').format('YYYYMMDD'),
                maxDate: moment(refMoment).add(6, 'days').format('YYYYMMDD')
              },
              $scope.originOfMercury
          );
        };
        if ($scope.onTopOfMercury) {
          var setIFrameAttributes = function () {
            frm.setAttribute('style', 'position: fixed; border: 0; margin: 0; top: 0; left: 0; width: 100%; height: 100%; z-index: 100');
            exportTimesheet = window.frames[window.frames.length - 1];
          };
          $window.parent.postMessage({f: '(' + setIFrameAttributes + ')'}, $scope.originOfMercury);
          $scope.loadInitialMercuryData($scope.refMomentForExport);
        }
        var updateMercuryData = function (event) {
          console.log(event.data.responseText);
          console.log('Update from Mercury', event);
          var results = _.map(_.filter(event.data.responseText.split('\n'), function (line) {
            return line.charAt(0) === '{';
          }), function (line) {
            return JSON.parse(line);
          });
          console.log(results);
          var errors = [],
              row = batchToRows[event.data.callingData.batch];
          _.forEach(results, function (result) {
            var weekday = batchToWeekdays[event.data.callingData.batch].pop();
            if (result.hasOwnProperty('error')) {
              errors.push(result.error.message.value);
            } else {
              result = result.d;
              row.mercury.updating = false;
              if (result.Counter) {
                row.mercury.WBS = result.TimeEntryDataFields.POSID;
                row.mercury.description = result.TimeEntryDataFields.LONGTEXT_DATA ? result.TimeEntryDataFields.LONGTEXT_DATA : '';
                row.mercury.location1 = result.TimeEntryDataFields.ZZYLOC;
                row.mercury.location2 = result.TimeEntryDataFields.ZZYROLE;
              }
              if ((result.Counter) && (weekday !== moment(result.TimeEntryDataFields.WORKDATE).format('dddd').toLowerCase())) {
                alert('Warning, unexpected weekday', weekday, result);
                weekday = moment(result.TimeEntryDataFields.WORKDATE).format('dddd').toLowerCase();
              }
              row.mercury[weekday] = row.mercury[weekday] || {};
              row.mercury[weekday].counter = result.Counter;
              row.mercury[weekday].hours = parseFloat(result.TimeEntryDataFields.CATSHOURS) || 0;
              row.mercury[weekday].status = result.Status === '30' ? 'DONE' : 'MSAVE';
              if (!result.Counter) {
                delete row.mercury[weekday];
              }
            }
          });
          if (errors.length > 0) {
            alert('The following errors occurred during interactions with Mercury:\n\n' + errors.join('\n'));
          }
          // TODO: result.d.Status = {10: Draft, 30: Submitted}
        };
        var receiveMercuryData = function (event) {
          console.log('Receive from Mercury', event);
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
          }
          for (var tag in entryObjects) {
            if (entryObjects.hasOwnProperty(tag)) {
              entryObject = entryObjects[tag];
              var tableKey = entryObject.POSID['d:FieldValue'] + ' ' +
                  entryObject.NOTES['d:FieldValueText'] + ' ' +
                  entryObject.ZZYLOC['d:FieldValue'] + ' ' +
                  entryObject.ZZYROLE['d:FieldValue'] +
                  (entryObject.AWART ? entryObject.AWART['d:FieldValue'] : '');
              tableFormat[tableKey] = tableFormat[tableKey] || {};
              tableFormat[tableKey][entryObject.POSID['d:WorkDate']] = tableFormat[tableKey][entryObject.POSID['d:WorkDate']] || [];
              tableFormat[tableKey][entryObject.POSID['d:WorkDate']].push(entryObject);
            }
          }

          $scope.rowsForGTE = [];
          console.log(tableFormat);
          _.forEach(tableFormat, function (mercuryRow) {
            var index = 0,
                maxLength = 1;
            while (index < maxLength) {
              var entry = null,
                  row = {
                    _startTime: null,
                    _running  : null,
                    mercury   : {},
                    totalTime : 0,
                    saturday  : 0,
                    sunday    : 0,
                    monday    : 0,
                    tuesday   : 0,
                    wednesday : 0,
                    thursday  : 0,
                    friday    : 0
                  };
              _.forEach(mercuryRow, function (entries) {
                if (index < entries.length) {
                  entry = entries[index];
                  maxLength = Math.max(maxLength, entries.length);
                  row[moment(entry.POSID['d:WorkDate']).format('dddd').toLowerCase()] = parseFloat(entry.TIME['d:FieldValue']) || 0;
                  row.mercury.WBS = entry.POSID['d:FieldValue'];
                  row.mercury.description = entry.NOTES ? entry.NOTES['d:FieldValueText'] : '';
                  row.mercury.location1 = entry.ZZYLOC['d:FieldValue'];
                  row.mercury.location2 = entry.ZZYROLE['d:FieldValue'] + (entryObject.AWART ? entryObject.AWART['d:FieldValue'] : '');
                  row.mercury[moment(entry.POSID['d:WorkDate']).format('dddd').toLowerCase()] = {
                    counter: entry.COUNTER['d:FieldValue'],
                    hours  : parseFloat(entry.TIME['d:FieldValue']) || 0,
                    status : entry.STATUS['d:FieldValue']
                    //TODO: ...
                  };
                }
              });
              row.engagement = entry.POSID['d:FieldValueText'];
              row.description = entry.NOTES ? entry.NOTES['d:FieldValueText'] : '';
              row.location1 = entry.ZZYLOC['d:FieldValue'];
              row.location2 = entry.ZZYROLE['d:FieldValue'] + (entryObject.AWART ? entryObject.AWART['d:FieldValue'] : '');
              row.totalTime = row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday;
              addWatchesForRow(row);
              $scope.rowsForGTE.push(row);
              index += 1;
            }
          });
        };
        var updateEntry = function (row, release) {
              return function () {
                var callMercuryBatch = function () {
                      var httpForToken = new XMLHttpRequest(),
                          baseTimesheetURL = "https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/",
                          delegatorID = hcm.emp.reuse.util.Delegator.parent.oConnectionManager.getModel().getHeaders().DelegatorID;
                      if (delegatorID) {
                        baseTimesheetURL = "https://mercury-pg1.ey.net:44365/sap/opu/odata/FTTE/ENH_SRA002_TIMESHEET_SRV/";
                      }
                      httpForToken.open("GET", baseTimesheetURL, false);
                      httpForToken.setRequestHeader("Accept", "application/json");
                      httpForToken.setRequestHeader("x-csrf-token", "Fetch");
                      if (delegatorID) {
                        httpForToken.setRequestHeader("DelegatorID", delegatorID);
                      }
                      httpForToken.send("sap-client=200");
                      var token = httpForToken.getResponseHeader('x-csrf-token'),
                          httpForEntry = new XMLHttpRequest();
                      httpForEntry.open("POST", baseTimesheetURL + "$batch?sap-client=200", false);
                      httpForEntry.setRequestHeader("Content-Type", "multipart/mixed;boundary=" + e.data.batch);
                      httpForEntry.setRequestHeader("x-csrf-token", token);
                      if (delegatorID) {
                        httpForEntry.setRequestHeader("DelegatorID", delegatorID);
                      }
                      httpForEntry.send(e.data.body);
                      exportTimesheet.postMessage({msg: 'Response from TimeEntryOperation', responseText: httpForEntry.responseText, callingData: e.data}, bURL);
                    },
                    batch = 'batch_' + Z7() + '-' + Z7() + '-' + Z7(),
                    changeset = 'changeset_' + Z7() + '-' + Z7() + '-' + Z7(),
                    body = '--' + batch + '--\r\n',
                    head = '\r\n--' + batch + '\r\nContent-Type: multipart/mixed; boundary=' + changeset + '\r\n\r\n\r\n--' + changeset + '\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\nPOST TimeEntries HTTP/1.1\r\nAccept-Language: EN\r\nAccept: application/json\r\nContent-Type: application/json\r\n\r\n',
                    tail = '\r\n--' + changeset + '--\r\n\r\n';

                batchToWeekdays[batch] = [];
                _.forEach(weekdaysForGTE, function (day) {
                  // TODO: AWART
                  var baseWBS = row.engagement.match(findEngagementRE);
                  if (!baseWBS || ((row[day] === 0) && !(row.mercury && row.mercury[day]))) {
                    return;
                  }
                  if (!release && row.mercury && row.mercury[day] && (row[day] === row.mercury[day].hours)
                      && (baseWBS[3] === row.mercury.WBS)
                      && (row.location1 === row.mercury.location1)
                      && (row.location2 === row.mercury.location2)
                      && (row.description === row.mercury.description)) {
                    return;
                  }
                  var weekdayOfEntry = weekdaysForGTE.indexOf(day),
                      dateOfEntry = moment($scope.refMomentForExport).add(weekdayOfEntry - 1, 'days').format('YYYYMMDD'),
                      entry = {
                        Counter            : '',
                        TimeEntryOperation : 'C',
                        TimeEntryRelease   : release || ' ',
                        TimeEntryDataFields: {
                          WORKDATE  : dateOfEntry,
                          CATSAMOUNT: '' + row[day],
                          BEGUZ     : '000000',
                          ENDUZ     : '000000',
                          POSID     : baseWBS[3],
                          ZZYLOC    : row.location1.split(' - ')[0],
                          ZZYROLE   : row.location2.split(' - ')[0],
                          LONGTEXT  : ' '
                        }
                      };
                  if (row.description) {
                    entry.TimeEntryDataFields.LONGTEXT_DATA = row.description;
                    entry.TimeEntryDataFields.LONGTEXT = "X";
                  }
                  if (row.mercury && row.mercury[day] && row.mercury[day].hasOwnProperty('hours')) {
                    entry.Counter = row.mercury[day].counter;
                    entry.TimeEntryOperation = 'U';
                  }
                  batchToWeekdays[batch].push(day);
                  body = head + JSON.stringify(entry) + tail + body;
                });
                console.log('Sending updates to mercury', body);
                batchToRows[batch] = row;
                $window.parent.postMessage({
                      f    : '(' + callMercuryBatch + ')',
                      body : body,
                      batch: batch
                    },
                    $scope.originOfMercury
                );
              }
            },
            updateRowDelayed = function (row, release) {
              row.mercury.updating = true;
              $timeout.cancel(row.mercury.delayedUpdate);
              row.mercury.delayedUpdate = $timeout(updateEntry(row, release), release ? 0 : 5000);
            };
        $scope.getCellStatus = function (localHours, mercury) {
          if (mercury) {
            if (localHours === mercury.hours) {
              if (mercury.status === 'DONE') {
                return 'green';
              }
              return 'yellow';
            } else {
              return 'red';
            }
          }
          if (localHours) {
            return 'red';
          }
          return '';
        };
        $scope.getTextCellStatus = function (local, mercury) {
          if (local === mercury) {
            return 'green';
          }
          return 'red';
        };
        $scope.getEngagementCellStatus = function (engagement, mercury) {
          if (!engagement) {
            return '';
          }
          var baseWBS = engagement.match(findEngagementRE);
          if (!baseWBS) {
            return '';
          }
          if (baseWBS[3] === mercury) {
            return 'green';
          }
          return 'red';
        };

        var ua = $window.navigator.userAgent;
        $scope.detectIE = !!(ua.indexOf('MSIE ') > 0 || ua.indexOf('Trident/') > 0 || ua.indexOf('Edge/') > 0);

        $scope.tagOfCurrentSheet = localStorage.timesheetTagOfCurrentSheet;
        $scope.tagOfSheet = $scope.tagOfCurrentSheet;
        var generateTagsForSheetSelect = function () {
          $scope.sheetStoreTags = _.keys(JSON.parse(localStorage.timesheetSheetStore || '{}')).sort();
          $scope.sheetStoreTags.unshift('--------------------');
          $scope.sheetStoreTags.unshift('Delete sheet');
          $scope.sheetStoreTags.unshift('Save as new ...');
        };
        generateTagsForSheetSelect();

        $scope.tagOfSheetSelected = function (tag, prevTag) {
          var sheetStore = JSON.parse(localStorage.timesheetSheetStore || '{}');
          switch (tag) {
            case 'Save as new ...':
            {
              $scope.state.saveInProgress = true;
              $scope.tagOfSheet = $scope.tagOfCurrentSheet;
              break;
            }
            case 'Delete sheet':
            {
              delete sheetStore[prevTag];
              localStorage.timesheetSheetStore = JSON.stringify(sheetStore);
              generateTagsForSheetSelect();
              $scope.tagOfCurrentSheet = null;
              break;
            }
            case '--------------------':
            {
              $scope.tagOfSheet = $scope.tagOfCurrentSheet;
              break;
            }
            default:
            {
              switchToSheet(sheetStore, tag, prevTag);
            }
          }
        };
        var switchToSheet = function (sheetStore, tag, prevTag) {
          if (sheetStore.hasOwnProperty(tag)) {
            if (prevTag !== 'Delete sheet') {
              if ($scope.tagOfCurrentSheet) {
                $scope.saveSheet($scope.tagOfCurrentSheet, true);
              } else {
                $scope.saveSheet('Unnamed sheet from ' + moment().format('YYYY-MM-DD HH:mm:ss'), true);
              }
            }
            localStorage.rowsForGTE = sheetStore[tag].rowsForGTE;
            localStorage.typeahead = sheetStore[tag].typeahead;
            localStorage.timesheetTagOfCurrentSheet = tag;
            $scope.tagOfCurrentSheet = tag;
            $scope.tagOfSheet = tag;
            localStorage.timesheetTagOfCurrentSheet = tag;
            updateRowsFromLocalStorage(true);
            updateTypeaheadFromLocalStorage(true);
          }
        };
        $scope.saveSheet = function (tag, noUpdateUI) {
          var sheetStore = JSON.parse(localStorage.timesheetSheetStore || '{}');
          sheetStore[tag] = sheetStore[tag] || {};
          sheetStore[tag].rowsForGTE = localStorage.rowsForGTE;
          sheetStore[tag].typeahead = localStorage.typeahead;
          localStorage.timesheetSheetStore = JSON.stringify(sheetStore);
          if (!noUpdateUI) {
            $scope.tagOfCurrentSheet = tag;
            $scope.tagOfSheet = tag;
            localStorage.timesheetTagOfCurrentSheet = tag;
            generateTagsForSheetSelect();
            $scope.state.saveInProgress = false;
          }
        };
        $scope.importJson = function (data) {
          data = JSON.parse(data);
          var sheetStore = JSON.parse(localStorage.timesheetSheetStore || '{}'),
              tag = data.timesheetTagOfCurrentSheet;
          sheetStore[tag] = sheetStore[tag] || {};
          sheetStore[tag].rowsForGTE = data.rowsForGTE;
          sheetStore[tag].typeahead = data.typeahead;
          localStorage.timesheetSheetStore = JSON.stringify(sheetStore);
          generateTagsForSheetSelect();
          if (tag === $scope.tagOfSheet) {
            switchToSheet(sheetStore, tag, $scope.tagOfSheet);
          } else {
            switchToSheet(sheetStore, tag, 'Delete sheet');
          }
        };
        $scope.downloadJson = function () {
          var data = JSON.stringify({
                rowsForGTE                : JSON.stringify($scope.rowsForGTE),
                typeahead                 : localStorage.typeahead,
                timesheetTagOfCurrentSheet: $scope.tagOfCurrentSheet || ('Exported on ' + moment().format('YYYY-MM-DD HH:mm:ss'))
              }),
              link = document.createElement('a');
          link.download = 'Timesheet Plus - Sheet ' + $scope.tagOfCurrentSheet + ' - ' + moment().format('YYYY-MM-DD HH_mm_ss') + '.json';
          link.href = 'data:application/octet-stream,' + encodeURIComponent(data);
          link.click();
          if ($scope.detectIE) {
            $window.navigator.msSaveBlob(new Blob([data], {type: "application/json"}), link.download);
          }
        };
      });
})();
