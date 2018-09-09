/**
 * Copyright 2017 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
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

function dataToPlot(dataJson) {
  var resu = ""
  Object.keys(dataJson).forEach(function (key) {
    var poi = ',\n[dateFormatter.formatValue(new Date(' + key + ')), ' + dataJson[key] + ']'
    resu = resu + poi
  })
  return resu
}

exports.bigbengr = functions.https.onRequest((req, res) => {

  res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');
  // [END vary]
  // [END_EXCLUDE]

  admin.database().ref('/testData1/').once('value').then(function (snapshot) {
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
              [dateFormatter.formatValue(new Date(1536469425664)), 54]
                `+points+`

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
