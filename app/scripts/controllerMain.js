(function () {
  'use strict';
  /* global _, angular, console, moment, alert, confirm */

  angular.module('gteApp')
      .controller('TimesheetCtrl', function ($window, $http, $timeout, $scope) {
        var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
            weekdaysForGTE = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
            chargeTypes = {
              A: 'Absences',
              C: 'Cost centers',
              E: 'External projects',
              I: 'Internal projects'
            };
        $scope.callbackToggleFactory = function (row) {
          return function (stopped, oldTime, newTime) {
            var weekday = weekdays[(new Date()).getDay()];
            row[weekday] += newTime - oldTime;
            row.totalTime = newTime;
          };
        };
        $scope.getTotalFor = function (rows, field) {
          return _.reduce(_.pluck(rows, field), function (sum, el) {
            return sum + el;
          }, 0);
        };
        $scope.getTotalDiff = function (rows) {
          var totalDiff = 0;
          _.forEach(rows, function (row) {
            totalDiff += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday - row.totalTime;
          });
          return totalDiff;
        };
        $scope.getTotal = function (rows) {
          var totalDiff = 0;
          _.forEach(rows, function (row) {
            totalDiff += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday;
          });
          return totalDiff;
        };
        $scope.aggregateByType = function (rows) {
          var totalByType = {};
          _.forEach(rows, function (row) {
            var chargeType = chargeTypes[row.engagement.charAt(0)] || row.engagement.charAt(0);
            totalByType[chargeType] = totalByType[chargeType] || 0;
            totalByType[chargeType] += row.saturday + row.sunday + row.monday + row.tuesday + row.wednesday + row.thursday + row.friday;
          });
          return totalByType;
        };
        $scope.deleteAllRows = function (rows) {
          if (confirm('Delete all rows?\n\nATTENTION: Data cannot be recovered afterwards!')) {
            rows.splice(0, rows.length);
            $window.localStorage.timesheetChangeUUID = localChangeUUID;
            $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
          }
        };
        $scope.addRow = function () {
          var newRow = {
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
        $scope.swapRows = function (rows, indexA, indexB) {
          var tmp = rows[indexA];
          rows[indexA] = rows[indexB];
          rows[indexB] = tmp;
        };
        $scope.roundRow = function (row) {
          var remainder = 0;
          _.forEach(weekdaysForGTE, function (weekday) {
            var roundedValue = Math.floor((row[weekday] + remainder) * 10) / 10;
            remainder = row[weekday] + remainder - roundedValue;
            row[weekday] = roundedValue;
          });
          row.friday += remainder;
        };
        $scope.roundRows = function (rows) {
          _.forEach(rows, function (row) {
            $scope.roundRow(row);
          });
        };
        $scope.clearTimes = function (rows) {
          _.forEach(rows, function (row) {
            row.totalTime = 0;
            row.saturday = 0;
            row.sunday = 0;
            row.monday = 0;
            row.tuesday = 0;
            row.wednesday = 0;
            row.thursday = 0;
            row.friday = 0;
          });
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
          if (row.hasOwnProperty('$$hashkey')) {
            delete row.$$hashkey;
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
              activity   : {'0000 - General': new Date().toJSON()},
              description: {},
              location1  : {'DE': new Date().toJSON()},
              location2  : {'REG': new Date().toJSON()}
            };
        createTypeAheadLists();
        updateRowsFromLocalStorage(true);

        addEventListener('storage', function (e) {
          if ($window.localStorage.timesheetChangeUUID === localChangeUUID) {
            return;
          }
          if (e.key === 'rowsForGTE') {
            updateRowsFromLocalStorage();
          }
          if (e.key === 'typeahead') {
            $scope.typeaheadLastUsed = JSON.parse($window.localStorage.typeahead || null) || $scope.typeaheadLastUsed;
            _.forEach($scope.typeaheadLastUsed, function (value, key, list) {
              $scope.typeahead[key] = _.keys(list[key]);
              $scope.typeahead[key].sort();
            });
            $scope.$apply();
          }
        }, false);

        $scope.refMomentForExport = moment();
        $scope.jsonForMercury = function (rows, refMoment) {
          var dataForMercury = [];
          refMoment = refMoment || moment();

          _.forEach(rows, function (row) {
            _.forEach(weekdaysForGTE, function (weekday) {
              var duration = Math.ceil((Math.max(row[weekday], 0) || 0) * 10) / 10,
                  weekdayOfEntry = weekdaysForGTE.indexOf(weekday),
                  dateOfEntry = moment(refMoment.startOf('week')).add(weekdayOfEntry - 1, 'days').format('YYYYMMDD');

              if (Math.abs(duration) > 0) {
                var entry = {
                      date       : dateOfEntry,
                      description: row.description,
                      location   : row.location1.split(' - ')[0],
                      role       : row.location2.split(' - ')[0],
                      duration   : duration
                    },
                    activity = row.activity.split(' - ')[0];
                if (activity.indexOf(':') > -1) {
                  activity = activity.split(':');
                  entry.type = activity[0];
                  activity = activity[1];
                }
                entry.engagement = row.engagement.split(' - ')[0] + '-' + activity;
                dataForMercury.push(entry);
              }
            });
          });
          return dataForMercury;
        };
        $scope.exportForMercury = function () {
          // window.clipboardData.setData('Text', JSON.stringify(dataForMercury));
          alert('Please directly import the data to Mercury as it is stored in the clipboard!\n\nPlease find the bookmarklet required for the import to Mercury on the end of the page after hitting "Edit auto complete entries".');
        };
        $scope.sendTimesheetUpdate = $scope.sendTimesheetUpdate || {};
        $scope.sendTimesheetUpdate.exec = function (rowsForGTE) {
          $window.localStorage.timesheetChangeUUID = localChangeUUID;
          $window.localStorage.rowsForGTE = JSON.stringify(rowsForGTE);
          updateRowsFromLocalStorage(rowsForGTE);
          $scope.$apply();
        };

        // Mercury integration
        $scope.onTopOfMercury = $window.self !== $window.top;
        $scope.originOfMercury = $window.document.referrer.split('/')[0] + '//' + $window.document.referrer.split('/')[2];
        $scope.originOfMyself = $window.location.origin;
        $scope.noHTTPS = false:
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
        $scope.importToMercury = function (rowsForGTE) {
          var getWeekShownInMercury = function (event) {
            if (document.location.hash.indexOf('#/detail') === 0) {
              //noinspection JSUnresolvedVariable
              window.frames[0].postMessage({
                msg           : 'import',
                rowsForGTE    : event.data.rowsForGTE,
                firstDayOfWeek: new Date(document.getElementsByClassName('sapMeCalendarType00')[0].getElementsByTagName('input')[0].value)
              }, bURL);
            } else {
              alert('Import only on week view of Mercury!');
            }
          };
          $window.parent.postMessage({f: '(' + getWeekShownInMercury + ')', rowsForGTE: rowsForGTE}, $scope.originOfMercury)
        };
        var receiveMessage = function (event) {
          if (event.origin !== $scope.originOfMercury) {
            return;
          }
          console.log(event);
          if (event.data.msg === 'import') {
            var rows = $scope.jsonForMercury(event.data.rowsForGTE, moment(event.data.firstDayOfWeek).add(3, 'days'));
            if (rows.length === 0) {
              alert('Nothing to import!')
              return;
            }
            $http.get('scripts/importToMercury.js').then(function (response) {
              $window.parent.postMessage({
                f   : '(function() {' + response.data.replace('http://localhost:9050', $window.location.origin) + '})',
                rows: rows
              }, $scope.originOfMercury)
            }, function (response) {
              console.log(response);
              alert('Error during downloading of import script!');
            });
          }
          $scope.$apply();
        };
        $window.addEventListener('message', receiveMessage);
        if ($scope.onTopOfMercury) {
          var setIFrameAttributes = function () {
            var positionIFrame = function () {
              if (window.location.hash) {
                frm.setAttribute('style', 'position:fixed; margin-top:'
                    + document.getElementById('__toolbar0').getBoundingClientRect().bottom
                    + 'px; top: 0; left: 0; width:100%; height:100%');
              } else {
                var anchor = document.getElementById('__xmlview2--calendar');
                frm.setAttribute('style', 'position:fixed; margin-top:'
                    + (anchor.getBoundingClientRect().bottom - anchor.getBoundingClientRect().top + 48)
                    + 'px; top: 0; left: 0; width:100%; height:100%');
              }
            };
            var schedulePositionUpdate = function () {
              setTimeout(positionIFrame, 1000);
            };
            window.addEventListener('hashchange', schedulePositionUpdate, false);
            positionIFrame();
          };
          $window.parent.postMessage({f: '(' + setIFrameAttributes + ')'}, $scope.originOfMercury)
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
