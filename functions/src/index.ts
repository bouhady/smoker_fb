'use strict';

import {admin} from 'firebase-admin/lib/database';
import DataSnapshot = admin.database.DataSnapshot;

const functions = require('firebase-functions');
const fbAdmin = require("firebase-admin");
const serviceAccount = require("./smokingcontroller-firebase-adminsdk.json");
fbAdmin.initializeApp({
  credential: fbAdmin.credential.cert(serviceAccount),
  databaseURL: "https://smokingcontroller.firebaseio.com"
});

class Tempertures {
  constructor(public t1 : number,public t2 : number) {}
}
export const multiTempUpdate = functions.https.onRequest((request: any, response: any) => {
  const temperature1 = Number(request.query.t1 ?? 0);
  const temperature2 = Number(request.query.t2 ?? 0);
  const date = new Date().valueOf();
  const temperatures = new Tempertures(temperature1,temperature2);
  pushMultiTemp(date, temperatures)
  fbAdmin.database().ref('/messageEnabled').once('value')
    .then((snapshot: any) => Number(snapshot.val()))
    .then((messageEnabled: number) => {
      if (messageEnabled === 1) {
        return fbAdmin.database().ref('/tempertureBounderies').once('value')
      }
      return null;
    })
    .then((snapshot2: any) => {
      const bunderies: { min: number, max: number } = snapshot2.val()
      if (temperature1 < bunderies.min) {
        console.log(' MIN Tempertures triggered : t1' + temperature1 + " t2 :" + temperature2 + " min :" + bunderies.min + " max :" + bunderies.max);
        pushDataToSend("Smoker getting cold", "T1 : " + temperature1 + " T2 : " + temperature2);
        setMessageEnable(0);
      } else {
        if (temperature1 > bunderies.max) {
          console.log('MAX Tempertures triggered : t1' + temperature1 + " t2 :" + temperature2 + " min :" + bunderies.min + " max :" + bunderies.max);
          pushDataToSend("Smoker getting Hot", "T1 : " + temperature1 + " T2 : " + temperature2);
          setMessageEnable(0);
        }
      }
      return true;
    }).catch((error: any) => { console.log("error") });
  response.send("Hellochild " + temperature1 + " " + date + " Added ");
});

function pushMultiTemp(timeDate: any, tempertures: Tempertures) {
  console.log(`tempertures : ${tempertures.t1} ${tempertures.t2} `);
  fbAdmin.database().ref('/multiTempData/').child(timeDate).set(tempertures)
  .catch((error: any) => { console.log("error") });
}

function dataTo2Plot(dataJson: any) {
  const arr: any = [];
  if (!(dataJson === null)) {
    Object.keys(dataJson).forEach((key) =>  {
      const poi = '[dateFormatter.formatValue(new Date(' + key + ')), ' + dataJson[key].t1 + ', ' + dataJson[key].t2 + ']'
      arr.push(poi);
    })
  }
  return arr.join(',');
}


exports.resetData = functions.https.onRequest((request: any, response: any) => {
  // var lastSec = Number(request.param("lastSec", 1000));
  // var now = new Date().valueOf();
  // var startDateFromLast = (now - (lastSec * 1000)).toString()
  const ref = fbAdmin.database().ref("/multiTempData/")
  // resetTableUntilDate(ref,startDateFromLast);
  ref.limitToFirst(5000).once("value").then((snapshot: any) =>  {
    snapshot.forEach( (child: any) => child.ref.remove());
    response.send("There are " + snapshot.numChildren + " items removed");
    return true;
  }).catch((error : any) => { console.log("error") });
})

exports.resetAllData = functions.https.onRequest((request: any, response: any) => {
  const ref = fbAdmin.database().ref("/multiTempData/")
  resetAllTableUntilDate(ref)

  response.send("Reset testDataRef! 1 ");
})

function resetAllTableUntilDate(ref: any) {
  ref.orderByKey()
    .once('value').then( (snapshot: any) => {
      snapshot.forEach( (childSnapshot: any) => ref.child(childSnapshot.key).remove());
      return true;
    }).catch((error : any) => { console.log("error") });
}

exports.send = functions.https.onRequest((request: any, response: any) => {

  setMessageEnable(request.param("en", "0"));
  fbAdmin.database().ref('/tempertureBounderies').once('value').then((snapshot2: any)=>  {
    const bunderies = snapshot2.val()
    pushDataToSend("Smoker Notification On ", "From " + bunderies.min + " to  " + bunderies.max);
    return true;
  }).catch((error : any) => { console.log("error") });
  response.send("setMessageEnable ");
});


function pushDataToSend(title: string, body: string) {
  const datatosend = { name: title, text: body };
  const ref = fbAdmin.database().ref('/messages')
  ref.push(datatosend)
}
exports.historyMultiTemp = functions.https.onRequest((req: any, res: any) => {
  const lastSec = Number(req.query.lastSec ?? 1000)
  const tableSource = req.query.table ?? "/multiTempData/"
  res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');
  const now = new Date().valueOf();
  const startDateFromLast = (now - (lastSec * 1000)).toString()
  fbAdmin.database().ref(tableSource)
    .orderByKey()
    .startAt(startDateFromLast)
    .once('value')
    .then((snapshot: DataSnapshot) =>  {
      const results = snapshot.val()
      const points = dataTo2Plot(results)
      const resultsArray = Object.keys(results)
      const currentTemp1 = results[resultsArray[resultsArray.length - 1]].t1
      const currentTemp2 = results[resultsArray[resultsArray.length - 1]].t2
      res.status(200).send(`<!doctype html>
    <head>
      <title>Tempertures</title>

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
                ${points} 
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
      <H1> Current Temperture 1 : ${currentTemp1 } </H1>
      <H1> Current Temperture 2 : ${currentTemp2 } </H1>
      <br>
      <div id="chart_div" style="width: 900px; height: 500px;"></div>
    </body>
  </html>`);
      setMessageEnable(1);
      return true;
    })
    .catch((error: any) => { console.log("error") });


});
// [END all]



// Listens for new messages added to messages/:pushId
exports.pushNotification = functions.database.ref('/messages/{pushId}').onWrite((change: any, context: any) => {
  console.log('Push notification event triggered');
  const valueObject = change.after.val();
  const payload = {
    notification: {
      title: valueObject.name,
      body: valueObject.text || valueObject.photoUrl,
      sound: "default"
    },
  };
  const options = {
    priority: "high",
    timeToLive: 60 * 60 * 24
  };
  return fbAdmin.messaging().sendToTopic("pushNotifications", payload, options);
});

function setMessageEnable(enable: number) {
  fbAdmin.database()
      .ref('/messageEnabled')
      .set(enable);
  if (enable === 1) {
    // pushDataToSend("Smoker App", "Smoker alerts on");
  }
}

function setTemperturesBounderies(bounderies: any) {
  fbAdmin.database().ref('/tempertureBounderies').update(bounderies)
}

exports.updateBounderies = functions.https.onRequest((request: any, response: any) => {
  const temperatureMin = Number(request.query.min ?? 0)
  const temperatureMax = Number(request.query.max ?? 0)
  const temperatures = { min: temperatureMin, max: temperatureMax };
  setTemperturesBounderies(temperatures)
  response.send("temperatures updated  ");
});
