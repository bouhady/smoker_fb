'use strict';

import {admin} from 'firebase-admin/lib/database';
import DataSnapshot = admin.database.DataSnapshot;

const functions = require('firebase-functions');
const fbAdmin = require("firebase-admin");
const serviceAccount = require("./smokingcontroller-firebase-adminsdk.json");
fbAdmin.initializeApp({
  credential: fbAdmin.credential.cert(serviceAccount),
  databaseURL: "https://online-kamado.firebaseio.com"
});

class Tempertures {
  constructor(public t1 : number,public t2 : number) {}
}

export const initSession = functions.https.onRequest(((req: any, resp: any) => {
  fbAdmin.database().ref('/recentSessionID').once('value')
      .then((snapshot: any) => Number(snapshot.val()))
      .then((recentSessionID: number) => {
        fbAdmin.database().ref('/recentSessionID').set(recentSessionID + 1)
        const rese = recentSessionID+1;
        resp.send(rese.toString());
        return recentSessionID + 1
      })
      .catch((error: any) => {
        console.error(error)
        resp.send("000")
      });
}));
export const multiTempUpdate = functions.https.onRequest((request: any, response: any) => {
  const temperature1 = Number(request.query.t1 ?? 0);
  const temperature2 = Number(request.query.t2 ?? 0);
  const sessionId = request.query.sessionID ?? "0000";

  const date = new Date().valueOf();
  const temperatures = new Tempertures(temperature1,temperature2);
  pushMultiTemp(date, temperatures, sessionId)
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
    }).catch((error: any) => { console.error(error) });
  response.send("Hellochild " + temperature1 + " " + date + " Added ");
});

function pushMultiTemp(timeDate: any, tempertures: Tempertures, sessionId: string) {
  console.log(`tempertures : ${tempertures.t1} ${tempertures.t2} `);
  fbAdmin.database().ref('/multiTempData/' + sessionId + '/').child(timeDate).set(tempertures)
  .catch((error: any) => { console.log("error") });
}

function dataTo2Plot(dataJson: any) {
  if (!(dataJson === null)) {
    return Object.entries(dataJson).map((value: [string, any]) => {
      const va = value[1];
      va["timestamp"] = value[0];
      return va;
    })
  }
  return [];
}


function pushDataToSend(title: string, body: string) {
  const datatosend = { name: title, text: body };
  const ref = fbAdmin.database().ref('/messages')
  ref.push(datatosend)
}

exports.getRecentPoints = functions.https.onRequest((req: any, res: any) => {
  const trimRecent = Number(req.query.trim ?? 100)
  const sessionID = req.query.sessionID
  res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');
  fbAdmin.database().ref('/recentSessionID').once('value')
      .then((snapshot: any) => Number(snapshot.val()))
      .then((value:number) => {
        const sessionIdTable = sessionID ?? value ;
        const tableSource1 = `/multiTempData/${sessionIdTable}/`;
        fbAdmin.database().ref(tableSource1)
            .limitToLast(trimRecent)
            .once('value')
            .then((snapshot: DataSnapshot) => {
              const results = snapshot.val()
              const points = dataTo2Plot(results)
              res.status(200).send(points);
            })
            .catch((error: any) => { console.error(error) });
      });
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
  fbAdmin.database().ref('/tokens/').once('value')
      .then((snapshot: DataSnapshot) => {
        const keys = Object.keys(snapshot.val());
        fbAdmin.messaging().sendToDevice(keys,payload,options);
      })
  return true;
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
  const temperatureMax = Number(request.query.max ?? 250)
  const temperatures = { min: temperatureMin, max: temperatureMax };
  setTemperturesBounderies(temperatures)
  response.send("temperatures updated  ");
});
