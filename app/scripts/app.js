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
    });
