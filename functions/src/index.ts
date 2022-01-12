'use strict';

import { Change } from "firebase-functions";
import { DataSnapshot } from "firebase-functions/lib/providers/database";


const functions = require('firebase-functions');
const fbAdmin = require("firebase-admin");
const serviceAccount = require("./smokingcontroller-firebase-adminsdk.json");
fbAdmin.initializeApp({
    credential: fbAdmin.credential.cert(serviceAccount),
    databaseURL: "https://online-kamado.firebaseio.com"
});

interface Temperatures {
   t1: number;
   t2: number;
   t3: number;
   t4: number;
}

export const initSession = functions.https.onRequest((req: any, resp: any) => {
    fbAdmin.database().ref('/recentSessionID').once('value')
        .then((snapshot: any) => Number(snapshot.val()))
        .then((recentSessionID: number) => {
            fbAdmin.database().ref('/recentSessionID').set(recentSessionID + 1)
            const rese = recentSessionID + 1;
            resp.send(rese.toString());
            return recentSessionID + 1
        })
        .catch((error: any) => {
            console.error(error)
            resp.send("000")
        });
});
export const multiTempUpdate = functions.https.onRequest((request: any, response: any) => {
    const temperature1 = Number(request.query.t1 ?? 0);
    const temperature2 = Number(request.query.t2 ?? 0);
    const temperature3 = Number(request.query.t3 ?? 0);
    const temperature4 = Number(request.query.t4 ?? 0);
    const sessionId = request.query.sessionID ?? "0";

    const date = new Date().valueOf();
    const temperatures = {
        t1: temperature1,
        t2: temperature2,
        t3: temperature3,
        t4: temperature4
    };
    pushMultiTemp(date, temperatures, sessionId)
    .then(() => fbAdmin.database().ref(`/fanState/${sessionId}`).once('value')
    .then((snapshot: { val: () => any; }) => snapshot.val()))
    .then((fanState => response.send(`${JSON.stringify(fanState)}`)))
    .catch((error: any) => {
        console.error(error)
    });
    
    fbAdmin.database().ref('/messageEnabled').once('value')
        .then((snapshot: any) => Boolean(snapshot.val()))
        .then((messageEnabled: boolean) => {
            if (messageEnabled) {
                return fbAdmin.database().ref('/boundaries').once('value')
                    .then((snapshot2: DataSnapshot) => {
                        const boundaries: { min: number, max: number } = snapshot2.val()
                        console.log(`boundaries : ${boundaries.min}-${boundaries.max} `)
                        if (temperature1 < boundaries.min) {
                            console.log(' MIN Temperatures triggered : t1' + temperature1 + " t2 :" + temperature2 + " min :" + boundaries.min + " max :" + boundaries.max);
                            pushDataToSend("Smoker getting cold", "T1 : " + temperature1 + " T2 : " + temperature2);
                            setMessageEnable(false);
                        }
                        if (temperature1 > boundaries.max) {
                            console.log('MAX Temperatures triggered : t1' + temperature1 + " t2 :" + temperature2 + " min :" + boundaries.min + " max :" + boundaries.max);
                            pushDataToSend("Smoker getting Hot", "T1 : " + temperature1 + " T2 : " + temperature2);
                            setMessageEnable(false);
                        }
                        return true;
                    })
            }
            return false;
        })
        .catch((error: any) => {
            console.error(error)
        });
});

async function pushMultiTemp(timeDate: any, tempertures: Temperatures, sessionId: string) {
    console.log(`tempertures new: ${JSON.stringify(tempertures)} `);
    return fbAdmin.database().ref('/multiTempData/' + sessionId + '/').child(timeDate).set(tempertures)
        .catch((error: any) => {
            console.error(error)
        });
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
    const datatosend = {name: title, text: body};
    const ref = fbAdmin.database().ref('/messages')
    ref.push(datatosend)
}

exports.getRecentPoints = functions.https.onRequest((req: any, res: any) => {
    const trimRecent = Number(req.query.trim ?? 100)
    const sessionID = req.query.sessionID
    res.set('Vary', 'Accept-Encoding, X-My-Custom-Header');
    fbAdmin.database().ref('/recentSessionID').once('value')
        .then((snapshot: any) => Number(snapshot.val()))
        .then((value: number) => {
            const sessionIdTable = sessionID ?? value;
            const tableSource1 = `/multiTempData/${sessionIdTable}/`;
            fbAdmin.database().ref(tableSource1)
                .limitToLast(trimRecent)
                .once('value')
                .then((snapshot: DataSnapshot) => {
                    const results = snapshot.val()
                    const points = dataTo2Plot(results)
                    res.status(200).send(points);
                })
                .catch((error: any) => {
                    console.error(error)
                });
        });
});
// [END all]

exports.fanStateSetter = functions.https.onRequest( async (req: any, res: any) => {
    const fanState = Number(req.query.fanState ?? 100)
    const fanDuration = Number((req.query.fanDuration ?? 5) * 1000)
    const sessionID = req.query.session ?? "0"

     fbAdmin.database().ref(`/fanState/${sessionID}`).once('value')
         .then((snapshot: any) => Number(snapshot.val()?.id??0))
         .then((value: number ) => {
             console.log(value);
             const newID = (value)+1;
             const payload = {
                 id: newID,
                 fanState,
                 fanDuration,
                 session: sessionID
             }
             fbAdmin.database().ref(`/fanState/${sessionID}`).set(payload);
         });


     //.then(() => sleep(fanDuration))
     //.then(() => fbAdmin.database().ref('/fanState').set(0));
     res.set('Access-Control-Allow-Origin', '*')
         .send(`Set ${fanState}`)
});

// function sleep(ms: number) {
//     return new Promise((resolve) => {
//         console.log("before delay" + ms);
//       setTimeout(resolve, ms);
//     });
//   }

// Listens for new messages added to messages/:pushId
exports.pushNotification = functions.database.ref('/messages/{pushId}').onWrite((change:Change<DataSnapshot>, context: any) => {
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
            fbAdmin.messaging().sendToDevice(keys, payload, options);
        })
    return true;
});

function setMessageEnable(enable: boolean) {
    fbAdmin.database()
        .ref('/messageEnabled')
        .set(enable);
}
