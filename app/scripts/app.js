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
    .module('gteApp', ['ui.bootstrap', 'ngclipboard'])
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
    ])
    // http://stackoverflow.com/questions/20459798/angularjs-filter-for-multiple-strings
    .filter("search", function () {
      return function (input, searchText, AND_OR, field) {
        if (!searchText || (searchText.trim() === '')) {
          return input;
        }
        var returnArray = [],
        // Split on single or multi space
            splitext = searchText.toLowerCase().split(/\s+/),
        // Build Regexp with Logical AND using "look ahead assertions"
            regexp_and = "(?=.*" + splitext.join(")(?=.*") + ")",
        // Build Regexp with logicial OR
            regexp_or = searchText.toLowerCase().replace(/\s+/g, "|"),
        // Compile the regular expression
            re = new RegExp((AND_OR == "AND") ? regexp_and : regexp_or, "i");

        for (var x = 0; x < input.length; x++) {
          if (field) {
            if (re.test(input[x][field])) returnArray.push(input[x]);
          } else {
            if (re.test(input[x])) returnArray.push(input[x]);
          }
        }
        return returnArray;
      }
    });

