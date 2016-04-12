/**
 * Used to import data to Mercury
 */
/* global bURL, e, hcm */

function detectIE() {
  var ua = window.navigator.userAgent;
  var MSIE = ua.indexOf('MSIE ');
  var trident = ua.indexOf('Trident/');
  var edge = ua.indexOf('Edge/');
  return !!(MSIE > 0 || trident > 0 || edge > 0);
}

/**
 * @return {string}
 */
function Z7() {
  return Math.floor((1 + Math.random()) * 0x10000).toString(16).substr(1);
}

function formatDate(dateString) {
  var tmp = dateString.split('');
  tmp.splice(4, 0, '-');
  tmp.splice(-2, 0, '-');
  return tmp.join('');
}

function writeToMercury(rows) {
  if (rows.length === 0) {
    return;
  }
  var i,
      batch = 'batch_' + Z7() + '-' + Z7() + '-' + Z7(),
      changeset = 'changeset_' + Z7() + '-' + Z7() + '-' + Z7(),
      body = '--' + batch + '--\r\n',
      head = '\r\n--' + batch + '\r\nContent-Type: multipart/mixed; boundary=' + changeset + '\r\n\r\n\r\n--' + changeset + '\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\nPOST TimeEntries HTTP/1.1\r\nAccept-Language: EN\r\nAccept: application/json\r\nContent-Type: application/json\r\n\r\n{"Counter":"","TimeEntryOperation":"C","TimeEntryDataFields":',
      tail = ',"TimeEntryRelease":" "}\r\n--' + changeset + '--\r\n\r\n',
      engagementToCustomer = {},
      minDate = '00000000', maxDate = '99999999', totalHours = 0,
      detailDate;
  if (!Array.isArray(rows)) {
    detailDate = rows.detailDate;
    rows = rows.rows;
  }

  for (i = 0; i < rows.length; i++) {
    minDate = (minDate > rows[i].date) ? minDate : rows[i].date;
    maxDate = (maxDate < rows[i].date) ? maxDate : rows[i].date;
    totalHours += rows[i].duration;
    var entry = {
      WORKDATE  : rows[i].date,
      CATSAMOUNT: '' + rows[i].duration,
      BEGUZ     : '',
      ENDUZ     : '',
      POSID     : rows[i].engagement,
      ZZYROLE   : rows[i].role,
      ZZYLOC    : rows[i].location,
      LONGTEXT  : ' '
    };
    if (rows[i].description) {
      entry.LONGTEXT_DATA = rows[i].description;
      entry.LONGTEXT = "X";
    }
    if (rows[i].hasOwnProperty('type')) {
      entry.AWART = rows[i].type;
    }
    if (rows[i].baseWBS && engagementToCustomer.hasOwnProperty(rows[i].baseWBS)) {
      entry.ZZYCLIENT = engagementToCustomer[rows[i].baseWBS];
    } else {
      var httpForCustomer = new XMLHttpRequest(),
          baseSearchURL = "https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/Z_FIN_TIME_VALIDATION_SRV/WbsSearchHelpList/";
      httpForCustomer.open("GET", baseSearchURL + '?$filter=DateFrom%20eq%20%27' + rows[i].date + '%27%20and%20DateTo%20eq%20%27' + rows[i].date +
          '%27%20%20and%20CountryCode%20eq%20%27' + rows[i].location + '%27%20and%20WBSElement%20eq%20%27' + rows[i].baseWBS + '%27', false);
      httpForCustomer.setRequestHeader("Accept", "application/json");
      httpForCustomer.send();
      var customerID = httpForCustomer.responseText.search(/<d:ClientOut>.*?<\/d:ClientOut>/);
      if (customerID) {
        entry.ZZYCLIENT = customerID[1];
        engagementToCustomer[rows[i].baseWBS] = customerID[1];
      }
    }
    body = head + JSON.stringify(entry) + tail + body;
  }

  if (document.location.hash.indexOf('#/detail') === 0) {
    if ((minDate < hcm.emp.reuse.util.Delegator.parent.oApplicationFacade.oApplicationImplementation.oModels.TSM_WEEKLY.oData.start)
        || (hcm.emp.reuse.util.Delegator.parent.oApplicationFacade.oApplicationImplementation.oModels.TSM_WEEKLY.oData.end < maxDate)) {
      if (!confirm('A\u0332t\u0332t\u0332e\u0332n\u0332t\u0332i\u0332o\u0332n\u0332: ' +
              'Hours will be imported into a different week than shown. You can change the week during export with the small arrows besides the export button.' +
              '\n\nShould I really import ' + totalHours + 'h from ' + formatDate(minDate) + ' to ' + formatDate(maxDate) + ' into Mercury?')) {
        return;
      }
    }
  } else {
    if (!confirm('Should I import ' + totalHours + 'h from ' + formatDate(minDate) + ' to ' + formatDate(maxDate) + ' into Mercury?')) {
      return;
    }
  }

  //noinspection JSUnresolvedVariable,JSUnresolvedFunction
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
  httpForEntry.setRequestHeader("Content-Type", "multipart/mixed;boundary=" + batch);
  httpForEntry.setRequestHeader("x-csrf-token", token);
  if (delegatorID) {
    httpForEntry.setRequestHeader("DelegatorID", delegatorID);
  }
  httpForEntry.send(body);

  try {
    var statusCodes = httpForEntry.responseText.match(new RegExp('^HTTP/1\.1 (...)', 'gim')),
        errorMessages = httpForEntry.responseText.match(new RegExp('"message":{.*?}', 'gim')),
        errorCount = 0;
    for (i = 0; i < statusCodes.length; i++) {
      if (Math.floor(statusCodes[i].split(' ')[1] / 100) !== 2) {
        errorCount += 1;
      }
    }
    if (Math.floor(httpForEntry.status / 100) === 2) {
      if (errorCount === 0) {
        alert('Import complete, will reload timesheet application to reflect changes');
      } else {
        alert('At least ' + errorCount + ' entries failed. Please verify engagement codes and in case the error persists contact Oliver Wienand.\n\nErrors: ' + errorMessages);
      }
    } else {
      alert('Error during transfer! Please verify engagement codes and in case the error persists contact Oliver Wienand.\n\nResponse body:\n' + httpForEntry.responseText);
    }
  } catch (e) {
    alert('Error reading response from Mercury!\n\nError stack:\n' + e.stack + '\n\nResponse body:\n' + httpForEntry.responseText +
        '\n\nClipboard data:\n' + window.clipboardData.getData('Text'));
  }
  if (detailDate) {
    if (location.hash === '#/detail/' + detailDate) {
      detailDate = 'Sat' + detailDate.slice(3);
    }
    location.hash = '#/detail/' + detailDate;
  } else {
    window.location = 'https://mercury-pg1.ey.net:44365/sap/bc/ui5_ui5/sap/zhcm_ts_cre/index.html?sap-client=200&sap-language=EN';
  }
}

function importToMercury() {
  try {
    if (bURL && e && (e.origin === bURL)) {
      writeToMercury(e.data.rows);
      return;
    }
  } catch (error) {
    console.log(error);
  }
  if (!detectIE()) {
    alert('Importing data to Mercury only works in Internet Explorer. Recording of times in Timesheet Plus can happen in any browser. You may use the "Activate Timesheet Plus" bookmarklet on other browser for import.');
    return
  }
  if (window.location.host !== 'mercury-pg1.ey.net:44365') {
    alert('Bookmarklet can only be used on Mercury. Current host is ' + window.location.host + ' and it should be mercury-pg1.ey.net:44365.\n\nIf you disagree please contact Oliver Wienand.');
    return
  }
  try {
    writeToMercury(JSON.parse(window.clipboardData.getData('Text')));
  } catch (e) {
    alert('Could not parse clipboard data. Maybe you copied something there after exporting from Timesheets Plus?\n\nError stack:\n' + e.stack + '\n\nClipboard data:\n' + window.clipboardData.getData('Text'));
  }
}

importToMercury();
