'use strict';
/* global _, angular, moment, alert*/

/**
 * @ngdoc function
 * @name gteApp.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the gteApp
 */
angular.module('gteApp')
    .controller('MainCtrl', function ($window, $timeout, $scope) {
      var weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
          weekdaysForGTE = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          chargeTypes = {C: 'External projects', I: 'Internal projects', A: 'Absences'};

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
        console.log(totalByType);
        return totalByType;
      };
      $scope.deleteAllRows = function (rows) {
        rows.splice(0, rows.length);
      };
      $scope.addRow = function () {
        var newRow = {
          _startTime : null,
          _running   : null,
          totalTime  : 0,
          engagement : '',
          activity   : '0000 - General',
          description: '',
          location1  : 'DE',
          location2  : 'REG',
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
      $scope.rowsForGTE = JSON.parse($window.localStorage.rowsForGTE || null) || [];
      $scope.typeaheadLastUsed = JSON.parse($window.localStorage.typeahead || null) ||
          {
            engagement : {},
            activity   : {'0000 - General': new Date().toJSON()},
            description: {},
            location1  : {'DEU': new Date().toJSON()},
            location2  : {'OTHER': new Date().toJSON()}
          };
      $scope.typeahead = {};
      _.forEach($scope.typeaheadLastUsed, function (value, key, list) {
        $scope.typeahead[key] = _.keys(list[key]);
        $scope.typeahead[key].sort();
      });
      var saveNewTypeahead = function () {
        _.forEach($scope.typeahead, function (value, key, list) {
          var entries = _.pluck($scope.rowsForGTE, key);
          list[key] = _.union(entries, value);
          _.extend($scope.typeaheadLastUsed[key], _.object(_.map(entries, function (entry) {
            return [entry, new Date().toJSON()];
          })));
        });
        $window.localStorage.typeahead = JSON.stringify($scope.typeaheadLastUsed);
      };
      var addWatchesForRow = function (row) {
        var
            firstCall = true,
            delayedSaveOfTypeahead;
        $scope.$watch(function () {
          return row.totalTime;
        }, function (newValue, oldValue) {
          if (newValue !== oldValue) {
            console.log('Changed ' + row.engagement + ' (' + row.activity + '): ' + oldValue + ' --> ' + newValue);
          }
        });
        $scope.$watchCollection(function () {
          return row;
        }, function () {
          if (firstCall) {
            firstCall = false;
          } else {
            $window.localStorage.rowsForGTE = JSON.stringify($scope.rowsForGTE);
            $timeout.cancel(delayedSaveOfTypeahead);
            delayedSaveOfTypeahead = $timeout(saveNewTypeahead, 5000);
          }
        });
      };
      _.forEach($scope.rowsForGTE, addWatchesForRow);

      $scope.jsonForMercury = function (rows) {
        var dataForMercury = [];


        _.forEach(rows, function (row) {
          _.forEach(weekdaysForGTE, function (weekday) {
            var duration = Math.ceil((Math.max(row[weekday], 0) || 0) * 10) / 10,
                weekdayOfEntry = weekdays.indexOf(weekday),
                dateOfEntry = moment().startOf('week').add(weekdayOfEntry, 'days').format('YYYYMMDD');

            if (Math.abs(duration) > 0) {
              dataForMercury.push({
                date       : dateOfEntry,
                engagement : row.engagement.split(' - ')[0] + '-' + row.activity.split(' - ')[0],
                description: row.description,
                location   : row.location1.split(' - ')[0],
                role       : row.location2.split(' - ')[0],
                duration   : duration
              });
            }
          });
        });
        return dataForMercury;
      };

      $scope.exportForMercury = function () {
        /*
         if (localStorage.useFirebase) {
         // <!-- Firebase -->
         // <script src="https://cdn.firebase.com/js/client/2.2.4/firebase.js"></script>
         // <script src="https://cdn.firebase.com/libs/angularfire/1.1.3/angularfire.min.js"></script>
         var myFirebaseRef = new Firebase("https://gte-wizard.firebaseio.com");
         myFirebaseRef.authWithOAuthPopup("google", function (error, authData) {
         myFirebaseRef.child(authData.auth.uid).set(dataForMercury);
         });
         } else */
        {
          // window.clipboardData.setData('Text', JSON.stringify(dataForMercury));
          alert('Please directly import the data to Mercury as it is stored in the clipboard!');
        }
      };
    });
