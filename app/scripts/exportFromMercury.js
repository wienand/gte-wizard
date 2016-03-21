/**
 * Used to export timesheet data for printing
 */

window.addEventListener('message', function (event) {
  if ((event.origin === baseUrl) && !stopSending) {
    stopSending = true;
    var
        r = new XMLHttpRequest(),
        result = {
          requestDate: new Date()
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
    r.open('GET', 'https://mercury-pg1.ey.net:44365/sap/opu/odata/sap/SRA002_TIMESHEET_SRV/TimeDataList?$filter=StartDate%20eq%20%27' + result.minDate
        + '%27%20and%20EndDate%20eq%20%27' + result.maxDate + '%27&sap-client=200', false);
    r.send();
    console.log(result, r);
    result.responseText = r.responseText;
    exportTimesheet.postMessage(result, baseUrl);
  }
});

var scheduleSending = function () {
  setTimeout(function () {
    exportTimesheet.postMessage('Hello from Mercury', baseUrl);
    if (!stopSending) {
      scheduleSending();
    }
  }, 1000);
};

var stopSending = false,
    baseUrl = 'http://localhost:9050',
    exportTimesheet = window.open(baseUrl + '/export.html');

if (window.location.host !== 'mercury-pg1.ey.net:44365') {
  alert('Bookmarklet can only be used on Mercury. Current host is ' + window.location.host + ' and it should be mercury-pg1.ey.net:44365.\n\nIf you disagree please contact Oliver Wienand.');
} else {
  scheduleSending();
}
