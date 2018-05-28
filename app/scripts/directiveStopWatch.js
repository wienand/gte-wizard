'use strict';
/* global angular */
/*jshint -W055 */

angular.module('gteApp')

    .directive('formatTime', function () {
      return {
        // $parsers/$formatters live on the
        // ngModel controller, so we need this!
        require: 'ngModel',
        link   : function (scope, elem, attrs, ngModel) {
          ngModel.$parsers.push(function toModel(input) {
            var timeParts = input.split(':').reverse();
            return parseInt(timeParts[0] || 0) / (60 * 60) + parseInt(timeParts[1] || 0) / 60 + parseInt(timeParts[2] || 0);
          });

          ngModel.$formatters.push(function toView(input) {
            var hours = Math.floor(input);
            var mins = Math.floor((input - hours) * 60);
            var secs = Math.floor(((input - hours) * 60 - mins) * 60);
            if (mins < 10) {
              mins = '0' + mins;
            }
            if (secs < 10) {
              secs = '0' + secs;
            }
            return hours + ':' + mins + ':' + secs;
          });
        }
      };
    })

    .factory('stopwatchFactory', function ($interval) {
      return function (options) {
        var interval,
            self = this,
            callback = options.toggleCallback();

        self.toggleTimer = function () {
          var myStop = callback(options.running, options.elapsedTime, options.elapsedTimeInternal, false);
          if (options.running) { self.stopTimer(); }
          else if(myStop) { self.stopTimer(); }
          else { self.startTimer(); }
        };

        self.updateTime = function () {
          if (!options.running) {
            $interval.cancel(interval);
          } else {
            options.elapsedTimeInternal = options.elapsedTime + (new Date().getTime() - options.startTime) / (1000 * 60 * 60);
          }
        };

        self.startTimer = function () {
          if (options.running) {
            $interval.cancel(interval);
            self.updateTime();
          } else {
            options.startTime = new Date().getTime();
          }
          interval = $interval(self.updateTime, 1000);
          options.running = true;
        };

        self.stopTimer = function () {
          if (options.running) {
            self.updateTime();
            $interval.cancel(interval);
            options.running = false;
            options.elapsedTime = options.elapsedTimeInternal;
          }
        };

        self.cancelTimer = function () {
          debugger;
          $interval.cancel(interval);
          options.running = null;
          options.elapsedTimeInternal = options.elapsedTime;
          callback(options.running, options.elapsedTime, options.elapsedTimeInternal, true);
        };

        return self;
      };
    })

    .controller('stopwatchCtrl', function ($scope, $timeout, stopwatchFactory) {
      var self = this;
      this.stopwatchService = new stopwatchFactory($scope);
      var promise;
      $scope.$watch('running', function (newValue) {
        if (newValue) {
          self.stopwatchService.startTimer();
        }
      });
      $scope.$watch('elapsedTime', function (newValue) {
        $scope.elapsedTimeInternal = newValue;
      });
      $scope.$watch('elapsedTimeInternal', function () {
        if (!$scope.running) {
          if (promise) {
            $timeout.cancel(promise);
          }
          promise = $timeout(function () {
            $scope.elapsedTime = $scope.elapsedTimeInternal;
          }, 1000);
        }
      });
    })

    .directive('stopwatch', function () {
      return {
        restrict  : 'EA',
        scope     : {elapsedTime: '=', startTime: '=', running: '=', toggleCallback: '&'},
        controller: 'stopwatchCtrl',
        template  : '<input type="text" format-time ng-model="elapsedTimeInternal" style="text-align: right;width: 58px">' +
            '<span ng-click="toggleTimer()">' +
            '<i ng-show="running" class="glyphicon glyphicon-pause" tooltip="stop timer and add {{elapsedTimeInternal - elapsedTime | number:1}} hours"></i>' +
            '<i ng-hide="running" class="glyphicon glyphicon-play"></i>' +
            '</span>'+
            '<span ng-click="cancelTimer();" tooltip="cancel timer and return to {{elapsedTime | number:1}} hours">' +
            '<i ng-show="running" class="glyphicon glyphicon-step-backward"></i>' +
            '</span>',
        link      : function (scope, iElement, iAttrs, controller) {
          scope.toggleTimer = controller.stopwatchService.toggleTimer;
          scope.cancelTimer = controller.stopwatchService.cancelTimer;
          scope.$on('$destroy', function () {
            controller.stopwatchService.stopTimer();
          });
        }
      };
    });