'use strict';

// [START all]
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();


exports.multiTempUpdate = functions.https.onRequest((request, response) => {
  var temperture1 = request.param("t1", 0)
  var temperture2 = request.param("t2", 0)
  var date = new Date().valueOf();
  var tempertures = {t1:temperture1, t2:temperture2};
  pushMultiTemp(date, tempertures)
  response.send("Hellochild " + temperture1 + " " + date + " Added ");
});

function pushMultiTemp(timeDate, tempertures) {
  admin.database().ref('/multiTempData/').child(timeDate).set(tempertures);
}

function dataToPlot(dataJson) {
  var arr = [];
  var resu = ""
  if (dataJson != null) {
    Object.keys(dataJson).forEach(function (key) {
      var poi = '[dateFormatter.formatValue(new Date(' + key + ')), ' + dataJson[key] + ']'
      arr.push(poi)
    })
  }
  resu = arr.join(',')
  return resu
}
function dataTo2Plot(dataJson) {
  var arr = [];
  var resu = ""
  if (dataJson != null) {
    Object.keys(dataJson).forEach(function (key) {
      var poi = '[dateFormatter.formatValue(new Date(' + key + ')), ' + dataJson[key].t1 + ', ' + dataJson[key].t2 + ']'
      arr.push(poi)
    })
  }
  resu = arr.join(',')
  return resu
}


exports.resetData = functions.https.onRequest((request, response) => {
  var lastSec = request.param("lastSec", "1000")
  var now = new Date().valueOf();
  var startDateFromLast = (now - (lastSec * 1000)).toString()
  var ref = admin.database().ref("/adcData1/")
  resetTableUntilDate(ref,startDateFromLast)
  var testDataRef = admin.database().ref("/testData1/")
  resetTableUntilDate(testDataRef,startDateFromLast)
  
  response.send("Reset testDataRef! ");
})

function resetTableUntilDate(ref, startDateFromLast) {
  ref.orderByKey()
    .endAt(startDateFromLast).once('value').then(function (snapshot) {
      snapshot.forEach(function (childSnapshot) {
        //remove each child
        ref.child(childSnapshot.key).remove();
      });
    });
}

exports.historyMultiTemp = functions.https.onRequest((req, res) => {
  var lastSec = req.param("lastSec", "1000")
  var tableSource = req.param("table", "/multiTempData/")
  res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');
  var now = new Date().valueOf();
  var startDateFromLast = (now - (lastSec * 1000)).toString()
  admin.database().ref(tableSource)
    .orderByKey()
    .startAt(startDateFromLast)
    .once('value').then(function (snapshot) {
      var results = snapshot.val()
      var points = dataTo2Plot(results)
      var resultsArray = Object.keys(results)
      var currentTemp1 = results[resultsArray[resultsArray.length - 1]].t1
      var currentTemp2 = results[resultsArray[resultsArray.length - 1]].t2
      res.status(200).send(`<!doctype html>
    <head>
      <title>Time</title>

      <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
      <script type="text/javascript">
        google.charts.load('current', {'packages':['corechart']});
        google.charts.setOnLoadCallback(drawChart);
  
        function drawChart() {
          var data = new google.visualization.DataTable(),
                dateFormatter = new google.visualization.DateFormat({ formatType: 'short' });

            data.addColumn('string', 'X');
            data.addColumn('number', 'T1');
            data.addColumn('number', 'T2');

            data.addRows([
                `+ points + `
            ]);

            var options = {
                hAxis: {
                    title: 'Current Time',
                    gridlines: {
                        color: 'none'
                    }
                },
                vAxis: {
                    title: 'Temperture',
                    gridlines: {
                        color: 'none'
                    }
                },
                curveType: 'function'
            };
          var chart = new google.visualization.ScatterChart(document.getElementById('chart_div'));
          chart.draw(data, options);
        }
      </script>
    </head>
    <body>
      <H1> Current Temperture 1 : `+ currentTemp1 + `</H1>
      <H1> Current Temperture 2 : `+ currentTemp2 + `</H1>
      <br>
      <div id="chart_div" style="width: 900px; height: 500px;"></div>
    </body>
  </html>`);
    });


});
// [END all]
