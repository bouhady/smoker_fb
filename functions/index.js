'use strict';

// [START all]
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();


exports.tempUpdate = functions.https.onRequest((request, response) => {
  var temperture1 = request.param("temperture1", 0)
  var date = new Date().valueOf();
  pushTemp(date, temperture1)
  admin.database().ref('/testData1/').once('value').then(function (snapshot) {
    response.send("Hellochild " + temperture1 + " " + date + " Added to : \n" + snapshot.val());
  });

});
function pushTemp(timeDate, temperture1) {
  admin.database().ref('/testData1/').child(timeDate).set(temperture1);
}

exports.adcUpdate = functions.https.onRequest((request, response) => {
  var adc = request.param("adc", 0)
  var date = new Date().valueOf();
  pushAdc(date, adc)
  admin.database().ref('/testData1/').once('value').then(function (snapshot) {
    response.send("Hellochild " + adc + " " + date + " Added to : \n" + snapshot.val());
  });

});
function pushAdc(timeDate, adc) {
  admin.database().ref('/adcData1/').child(timeDate).set(adc);
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

exports.historyTemp = functions.https.onRequest((req, res) => {
  var lastSec = req.param("lastSec", "1000")
  var tableSource = req.param("table", "/testData1/")
  res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');

  var now = new Date().valueOf();
  var startDateFromLast = (now - (lastSec * 1000)).toString()
  admin.database().ref(tableSource)
    .orderByKey()
    .startAt(startDateFromLast)
    .once('value').then(function (snapshot) {
      var results = snapshot.val()
      var points = dataToPlot(results)
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
            data.addColumn('number', 'Current Temperture');

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
                    title: 'Minutes',
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
      <div id="chart_div" style="width: 900px; height: 500px;"></div>
    </body>
  </html>`);
    });


});
// [END all]
