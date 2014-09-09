'use strict';
/* global _, angular*/

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
          weekdaysForGTE = ['saturday', 'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
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
          location1  : 'DEU',
          location2  : 'OTHER',
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
        _.forEach(weekdaysForGTE, function(weekday) {
          var roundedValue = Math.floor((row[weekday] + remainder) * 10) / 10;
          remainder = row[weekday] + remainder - roundedValue;
          row[weekday] = roundedValue;
        });
        row.friday += remainder;
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

      $scope.exportAHK = function (rows) {
        var autoHotKeyScript = 'WinActivate, Global Time & Expense: Timesheets: Timesheet Grid' +
            '\nWinWaitActive, Global Time & Expense: Timesheets: Timesheet Grid - Windows Internet Explorer provided by Ernst & Young, Address Combo Contro' +
            '\nSetKeyDelay 250' +
            '\nSend, {TAB}';
        _.forEach(rows, function (row) {
          autoHotKeyScript += '\nclipboard = ' + row.engagement.split(' - ')[0] + '\nSend ^v{TAB}';
          autoHotKeyScript += '\nclipboard = ' + row.activity.split(' - ')[0] + '\nSend ^v{TAB}';
          autoHotKeyScript += '\nclipboard = ' + row.description + '\nSend ^v{TAB}';
          autoHotKeyScript += '\nclipboard = ' + row.location1.split(' - ')[0] + '\nSend ^v{TAB}';
          autoHotKeyScript += '\nclipboard = ' + row.location2.split(' - ')[0] + '\nSend ^v{TAB}';
          _.forEach(weekdaysForGTE, function (weekday) {
            autoHotKeyScript += Math.ceil((row[weekday] || 0) * 10) / 10;
            autoHotKeyScript += '{TAB}';
          });
          autoHotKeyScript += '\nSleep 500\nSend, {TAB}{TAB}{TAB}{TAB}';
        });

        var link = document.createElement('a');
        link.download = 'gte wizard export on ' + (new Date()).toISOString() + '.ahk';
        link.href = 'data:application/octet-stream,' + encodeURIComponent(autoHotKeyScript);
        link.click();
        var oWin = window.open('about:blank', '_blank');
        oWin.document.write(autoHotKeyScript);
        oWin.document.close();
        oWin.document.execCommand('SaveAs', true, 'gte wizard export on ' + (new Date()).toISOString().substring(0, 10) + ' - please drop on AutoHotkey');
        oWin.close();
      };
    });
