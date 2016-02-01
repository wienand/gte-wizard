/**
 * Created by DEOWIEN1 on 29.01.2016.
 */

function getScript(src, callback) {
  var s = document.createElement('script');
  s.src = src;
  s.async = true;
  s.onreadystatechange = s.onload = function () {
    if (!callback.done && (!s.readyState || /loaded|complete/.test(s.readyState))) {
      callback.done = true;
      callback();
    }
  };
  document.querySelector('head').appendChild(s);
}

function detectIE() {
  var ua = window.navigator.userAgent;
  var msie = ua.indexOf('MSIE ');
  var trident = ua.indexOf('Trident/');
  var edge = ua.indexOf('Edge/');
  return !!(msie > 0 || trident > 0 || edge > 0);
}

function writeToMercury(rows) {
  var body = '--batch_cdc0-f6b6-fece--\r\n',
      head = '\r\n--batch_cdc0-f6b6-fece\r\nContent-Type: multipart/mixed; boundary=changeset_1463-1aa4-5014\r\n\r\n\r\n--changeset_1463-1aa4-5014\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\nPOST TimeEntries HTTP/1.1\r\nAccept-Language: EN\r\nAccept: application/json\r\nContent-Type: application/json\r\n\r\n{"Counter":"","TimeEntryOperation":"C","TimeEntryDataFields":',
      tail = ',"TimeEntryRelease":" "}\r\n--changeset_1463-1aa4-5014--\r\n\r\n';
  for (var i = 0; i < rows.length; i++) {
    var entry = {
      WORKDATE     : rows[i].date,
      CATSAMOUNT   : '' + rows[i].duration,
      BEGUZ        : "",
      ENDUZ        : "",
      POSID        : rows[i].engagement,
      ZZYROLE      : rows[i].role,
      ZZYLOC       : rows[i].location,
      LONGTEXT_DATA: rows[i].description,
      LONGTEXT     : "X"
    };
    body = head + JSON.stringify(entry) + tail + body;
  }
  var httpForToken = new XMLHttpRequest();
  httpForToken.open("GET", "https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/", false);
  httpForToken.setRequestHeader("Accept", "application/json");
  httpForToken.setRequestHeader("x-csrf-token", "Fetch");
  httpForToken.send("sap-client=200");
  var token = httpForToken.getResponseHeader('x-csrf-token'),
      httpForEntry = new XMLHttpRequest();
  httpForEntry.open("POST", "https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/$batch?sap-client=200", false);
  httpForEntry.setRequestHeader("Content-Type", "multipart/mixed;boundary=batch_cdc0-f6b6-fece");
  httpForEntry.setRequestHeader("x-csrf-token", token);
  httpForEntry.send(body);
  if (Math.floor(httpForEntry.status / 100) === 2) {
    alert('Import complete, will reload timesheet application to reflect changes');
    window.location = 'https://mercury-pg1.ey.net:44365/sap/bc/ui5_ui5/sap/zhcm_ts_cre/index.html?sap-client=200';
  } else {
    alert('Error during transfer! Please verify engagement codes and in case the error persists contact Oliver Wienand.');
  }
}

function importToMercury() {
  /*
   if (typeof(window.clipboardData) === 'undefined') {
   var myFirebaseRef = new Firebase("https://gte-wizard.firebaseio.com");
   myFirebaseRef.authWithOAuthPopup("google", function (error, authData) {
   myFirebaseRef.child(authData.auth.uid).once("value", function (rows) {
   writeToMercury(rows.val());
   myFirebaseRef.child(authData.auth.uid).remove();
   });
   });
   } else */
  {
    if (!detectIE()) {
      alert('Importing data to Mercury only works in Internet Explorer. Recording of times in Timesheet Plus can happen in any browser.');
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
}

getScript('https://cdn.firebase.com/js/client/2.2.4/firebase.js', importToMercury);
