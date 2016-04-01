/**
 * Used to export timesheet data for printing
 */

var stopSending = false,
    baseUrl = 'http://localhost:9050',
    exportTimesheet;

function getMercuryData() {
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

  if (document.location.hash.indexOf('#/detail') === 0) {
    var firstDayShown = new Date(document.getElementsByClassName('sapMeCalendarType00')[0].getElementsByTagName('input')[0].value);
    firstDayShown.setTime(firstDayShown.getTime() - 1000 * 60 * firstDayShown.getTimezoneOffset());
    result.minDate = firstDayShown.toISOString().slice(0, 10).replace(/-/g, '');
    firstDayShown.setTime(firstDayShown.getTime() + 1000 * 60 * 60 * 24 * 6);
    result.maxDate = firstDayShown.toISOString().slice(0, 10).replace(/-/g, '');
  } else {
    var monthName = new Date(document.querySelectorAll('.sapMeCalendarType01:not(.sapMeCalendarDayNotInCurrentMonth)')[0].getElementsByTagName('input')[0].value);
    monthName.setTime(monthName.getTime() - 1000 * 60 * monthName.getTimezoneOffset());
    result.minDate = monthName.toISOString().slice(0, 10).replace(/-/g, '');
    monthName = new Date(monthName.getFullYear(), monthName.getMonth() + 1, 1);
    monthName.setTime(monthName.getTime() - 1000 * 60 * monthName.getTimezoneOffset() - 1000 * 60 * 60 * 24);
    result.maxDate = monthName.toISOString().slice(0, 10).replace(/-/g, '');
  }
  if (delegatorID) {
    baseTimesheetURL = 'https://mercury-pg1.ey.net:44365/sap/opu/odata/FTTE/ENH_SRA002_TIMESHEET_SRV/';
  }
  r.open('GET', baseTimesheetURL + 'TimeDataList?$filter=StartDate%20eq%20%27' + result.minDate + '%27%20and%20EndDate%20eq%20%27' + result.maxDate + '%27&sap-client=200', false);
  if (delegatorID) {
    r.setRequestHeader("DelegatorID", delegatorID);
  }
  r.send();
  result.responseText = r.responseText;
  exportTimesheet.postMessage(result, baseUrl);
}

var sendData = function (event) {
  if ((event.origin === baseUrl) && !stopSending && (event.data.msg === 'Get current timesheet data')) {
    stopSending = true;
    getMercuryData();
    window.removeEventListener('message', sendData);
  }
};

var scheduleSending = function () {
  setTimeout(function () {
    exportTimesheet.postMessage('Hello from Mercury', baseUrl);
    if (!stopSending) {
      scheduleSending();
    }
  }, 500);
};

var generateTimesheetExport = function () {
  try {
    //noinspection JSUnresolvedVariable
    if (calledInFrame.origin) {
      //noinspection JSUnresolvedVariable
      baseUrl = bURL;
      exportTimesheet = window.frames[0];
      getMercuryData();
    }
  } catch (error) {
    console.log(error);
    window.addEventListener('message', sendData);
    exportTimesheet = window.open(baseUrl + '/export.html');
    if (window.location.host !== 'mercury-pg1.ey.net:44365') {
      alert('Bookmarklet can only be used on Mercury. Current host is ' + window.location.host + ' and it should be mercury-pg1.ey.net:44365.\n\nIf you disagree please contact Oliver Wienand.');
    } else {
      scheduleSending();
    }
  }
};

generateTimesheetExport();
