const cron = require("node-cron");
const express = require("express");
const {parse, addHours, addMinutes} = require("date-fns");
const axios = require('axios');
const clientPromise = require("./mongodb");
const HOST_URL = process.env.HOST_URL || "http://localhost:3000";
app = express();
const execFindSchedules = async (trxs) => {
  const client = await clientPromise;
  const db = client.db("saime-citas");
  var query = { status: 'PENDING', type: 'FIND_SCHEDULES' };
  const trxs = await db
    .collection("trxs")
    .find(query).toArray();
  if (trxs?.length > 0) {
    trxs.forEach(schedules => {
      schedules?.offices?.forEach(office => {
        console.log("Cedula: " + schedules.dni + " Oficina: " + office.name + " Dates: ");
        const config = {
          method: 'post',
          url: `${HOST_URL}/api/agendarCitasGlobal`,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify({
            id: schedules._id,
            password: schedules.password,
            dni: schedules.dni,
            office: office.id,
            dates: schedules.dates,
          })
        }
        axios(config)
          .then(function (response) {
            console.log(response.data);
          }).catch(function (error) {
            console.error(error);
          });
      })
    })
  }
}
const execNewQuotas = async () => {
  const client = await clientPromise;
  const db = client.db("saime-citas");
  var query = { status: 'PENDING', type: 'NEW_QUOTA' };
  const trxs = await db
    .collection("trxs")
    .find(query).toArray();
  if (trxs) {
    trxs.forEach(schedules => {
      schedules?.offices?.forEach(office => {
        console.log("New Quota Cedula: " + schedules.dni + " Oficina: " + office.name);
        const config = {
          method: 'post',
          url: `${HOST_URL}/api/newQuota`,
          headers: {
            "Content-Type": "application/json",
          },
          data: JSON.stringify({
            id: schedules._id,
            password: schedules.password,
            dni: schedules.dni,
            office: office.id,
          })
        }
        axios(config)
          .then(function (response) {
            console.log(response.data);
          }).catch(function (error) {
            console.error(error);
          });
      })
    })
  }
}
const cronsObj = {}

cron.schedule("*/45 * * * * *", async function () {
  const client = await clientPromise;
  const db = client.db("saime-citas");
  const newQuotaCronStr = await db.collection("settings").findOne({ key: 'newQuotaCronStr' });
  const newQuotaStartTime = await db.collection("settings").findOne({ key: 'newQuotaStartTime' });
  const newQuotaDuration = await db.collection("settings").findOne({ key: 'newQuotaDuration' });
  const newQuotaDurationType = await db.collection("settings").findOne({ key: 'newQuotaDurationType' });
  const current = new Date();
  const newQuotaStart = parse(newQuotaStartTime.value, 'HH:mm', current);
  let newQuotaEnd = parse(newQuotaStartTime.value, 'HH:mm', current);
  switch (newQuotaDurationType) {
    case 'HOURS':
      newQuotaEnd = addHours(newQuotaEnd, newQuotaDuration.value);
      break;
    case 'MINUTES':
        newQuotaEnd = addMinutes(newQuotaEnd, newQuotaDuration.value);
        break;
    default:
      break;
  }
  if(current >= newQuotaStart && current <= newQuotaEnd){
    cronsObj.newQuota = cron.schedule(newQuotaCronStr, execNewQuotas, {scheduled:true})
  }else{
    if(cronsObj?.newQuota) cronsObj.newQuota?.stop();
  }
  const trxs = await db
    .collection("trxs")
    .find({ 
      status: 'PENDING',
      type: 'FIND_SCHEDULES'
    }).toArray();
  if (trxs) {
    cronsObj.findSchedules = cron.schedule("*/50 * * * * *",  ()=>execFindSchedules(trxs), {scheduled:true})
  }else{
    if(cronsObj?.findSchedules) cronsObj.findSchedules?.stop();
  }
});

app.listen(3128);