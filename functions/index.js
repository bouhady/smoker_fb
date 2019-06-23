'use strict';

// [START all]
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();


exports.multiTempUpdate = functions.https.onRequest((request, response) => {
  var temperture1 = Number(request.param("t1", 0))
  var temperture2 = Number(request.param("t2", 0))
  var date = new Date().valueOf();
  var tempertures = {t1:temperture1, t2:temperture2};
  pushMultiTemp(date, tempertures)
  admin.database().ref('/messageEnabled').once('value').then(function (snapshot) {
    var messageEnabled = snapshot.val()
    if (messageEnabled == 1) {
      admin.database().ref('/tempertureBounderies').once('value').then(function (snapshot2) {
        var bunderies = snapshot2.val()
        if (temperture1<bunderies.min) {
          console.log(' MIN Tempertures triggered : t1' + temperture1 + " t2 :" + temperture2 + " min :" + bunderies.min + " max :" + bunderies.max);
          pushDataToSend("Smoker getting cold","T1 : " + temperture1 + " T2 : " + temperture2);
          setMessageEnable(0);
        } else {
          if (temperture1>bunderies.max) {
            console.log('MAX Tempertures triggered : t1' + temperture1 + " t2 :" + temperture2 + " min :" + bunderies.min + " max :" + bunderies.max);
            pushDataToSend("Smoker getting Hot","T1 : " + temperture1 + " T2 : " + temperture2);
            setMessageEnable(0);
          } 
        }
      });
    } else {

    }
  })
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
  var lastSec = Number(request.param("lastSec", 1000));
  var now = new Date().valueOf();
  var startDateFromLast = (now - (lastSec * 1000)).toString()
  var ref = admin.database().ref("/multiTempData/")
  // resetTableUntilDate(ref,startDateFromLast);
  ref.limitToFirst(5000).once("value").then(function(snapshot) {
    snapshot.forEach(function(child) {
      child.ref.remove();
    });
    response.send("There are "+snapshot.numChildren + " items removed");
  });
  // ref.once('value').then("value", function(snapshot) {
  //   console.log("There are "+snapshot.numChildren()+" items to delete");
  //   response.send("There are "+snapshot.numChildren()+" items to delete");
  // });
})

exports.resetAllData = functions.https.onRequest((request, response) => {
  var ref = admin.database().ref("/multiTempData/")
  resetAllTableUntilDate(ref)
  
  response.send("Reset testDataRef! 1 ");
})

function resetTableUntilDate(ref, startDateFromLast) {

  ref.orderByKey().once('value').then("value", function(snapshot) {
    console.log("There are "+snapshot.numChildren()+" items to delete");
  });
  ref.orderByKey()
    .endAt(startDateFromLast).once('value').then(function (snapshot) {
      snapshot.forEach(function (childSnapshot) {
        //remove each child
        ref.child(childSnapshot.key).remove();
      });
    });
}
function resetAllTableUntilDate(ref) {
  ref.orderByKey()
    .once('value').then(function (snapshot) {
      snapshot.forEach(function (childSnapshot) {
        //remove each child
        ref.child(childSnapshot.key).remove();
      });
    });
}

exports.send = functions.https.onRequest((request, response) => {

  setMessageEnable(request.param("en", "0"));
  admin.database().ref('/tempertureBounderies').once('value').then(function (snapshot2) {
    var bunderies = snapshot2.val()
    pushDataToSend("Smoker Notification On ","From " + bunderies.min + " to  " + bunderies.max);
  });
  response.send("setMessageEnable ");
});


function pushDataToSend(title,body) {
  var datatosend = {name:title, text: body};
  var ref = admin.database().ref('/messages')
  ref.push(datatosend)
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
  setMessageEnable(1);
    });


});
// [END all]



// Listens for new messages added to messages/:pushId
exports.pushNotification = functions.database.ref('/messages/{pushId}').onWrite(  (change,context) => {
  console.log('Push notification event triggered');
  var valueObject = change.after.val();
  if(valueObject.photoUrl != null) {
    valueObject.photoUrl= "Sent you a photo!";
  }
  const payload = {
      notification: {
          title:valueObject.name,
          body: valueObject.text || valueObject.photoUrl,
          sound: "default"
      },
  };
  const options = {
      priority: "high",
      timeToLive: 60 * 60 * 24
  };
  return admin.messaging().sendToTopic("pushNotifications", payload, options);
});

function setMessageEnable(enable) {
  var ref = admin.database().ref('/messageEnabled')
  ref.set(enable)
  if (enable == 1) {
    pushDataToSend("Smoker App", "Smoker alerts on");
  }
}

function setTemperturesBounderies(bounderies) {
  var ref = admin.database().ref('/tempertureBounderies')
  ref.update(bounderies)
}

exports.updateBounderies = functions.https.onRequest((request, response) => {
  var tempertureMin = Number(request.param("min", 0))
  var tempertureMax = Number(request.param("max", 0))
  var tempertures = {min:tempertureMin, max:tempertureMax};
  setTemperturesBounderies(tempertures)
  response.send("tempertures updated  ");
});
