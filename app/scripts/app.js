'use strict';

/**
 * @ngdoc overview
 * @name gteApp
 * @description
 * # gteApp
 *
 * Main module of the application.
 */
angular
    .module('gteApp', ['ui.bootstrap', 'zeroclipboard'])
    .config(function ($compileProvider) {
      $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|mailto|javascript):/);
    })
    .directive('resizeInputToLength', [
      function () {
        return {
          restrict: 'A',
          scope   : {},
          link    : function (scope, element) {
            var input = $(element[0]),
                friday = $('#thTotalColumn'),
                checkWidthAndEnlargeInCase = function () {
                  if (!input.hasClass('enlarge-input') && (input.width() / input.val().length < 7.25)) {
                    input.addClass('enlarge-input');
                    input.width((friday.position().left - input.position().left - 8) + 'px');
                  }
                },
                handlerFocusIn = function (event) {
                  checkWidthAndEnlargeInCase();
                },
                handlerFocusOut = function (event) {
                  input.removeClass('enlarge-input');
                  input[0].style.width = '100%';
                },
                handlerInput = function (event) {
                  if (input.focus) {
                    checkWidthAndEnlargeInCase();
                  }
                };
            input.on('focusin', handlerFocusIn);
            input.on('focusout', handlerFocusOut);
            input.on('input', handlerInput);
          }
        };
      }
    ])
    .directive('dropZone', [
      function () {
        return {
          restrict: 'C',
          scope   : {onFile: '&onFile'},
          link    : function (scope, element) {
            var onFile = scope.onFile();
            scope.output = [];
            function handleFileSelect(evt) {
              evt.stopPropagation();
              evt.preventDefault();
              var files = evt.dataTransfer.files;
              _.forEach(files, function (file) {
                var reader = new FileReader();
                // Closure to capture the file information.
                reader.onload = function (theFile) {
                  return function (e) {
                    if (typeof onFile === 'function') {
                      scope.$apply(function () {
                        onFile(e.target.result, theFile);
                      });
                    }
                  };
                }(file);
                // Read in the image file as a data URL.
                reader.readAsText(file);
              });
            }

            function handleDragOver(evt) {
              evt.stopPropagation();
              evt.preventDefault();
              evt.dataTransfer.dropEffect = 'copy';  // Explicitly show this is a copy.
            }

            element[0].addEventListener('dragover', handleDragOver, false);
            element[0].addEventListener('drop', handleFileSelect, false);
          }
        };
      }
    ]);

