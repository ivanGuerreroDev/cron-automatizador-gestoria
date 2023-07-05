const cron = require("node-cron");
const express = require("express");
const { parse, addHours, addMinutes } = require("date-fns");
const axios = require('axios');
const clientPromise = require("./mongodb");
const HOST_URL = process.env.HOST_URL || "http://localhost:3000";
const CRON_STR = process.env.CRON_STR || '*/30 * * * *'
app = express();

const execFindSchedules = async () => {
  try {
    const client = await clientPromise;
    const db = client.db("saime-citas");
    var query = { status: 'PENDING', type: 'FIND_SCHEDULES' };
    const trxs = await db
      .collection("trxs")
      .find(query).toArray();
    console.log("Find Schedules - Trxs: " + trxs?.length);
    if (trxs?.length > 0) {
      trxs.forEach(schedules => {
        schedules?.offices?.forEach(office => {
          console.log("execFindSchedules Cedula: " + schedules.dni + " Oficina: " + office.name + " Dates: " + schedules.dates[0] + "-" + schedules.dates[schedules.dates.length - 1]);
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
              console.log(schedules.dni + " " + response.data);
            }).catch(function (error) {
              console.log(error);
            });
        })
      })
    }
  } catch (error) {
    console.log(error);
  }
}
const execNewQuotas = async () => {
  try {
    const client = await clientPromise;
    const db = client.db("saime-citas");
    var query = { status: 'PENDING', type: 'NEW_QUOTA' };
    const trxs = await db
      .collection("trxs")
      .find(query).toArray();
    if (trxs?.length > 0) {
      trxs.forEach(schedules => {
        schedules?.offices?.forEach(office => {
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
          console.log("New Quota Cedula: " + schedules.dni + " Oficina: " + office.name);
          axios(config)
            .then(function (response) {
              console.log(schedules.dni + " " + response.data);
            }).catch(function (error) {
              console.log(error);
            });
        })
      })
    }
  } catch (error) {
    console.log(error);
  }
}
const cronsObj = {}

cron.schedule(CRON_STR, async function () {
  console.log("running a task")
  const client = await clientPromise;
  const db = client.db("saime-citas");
  const findSchedulesCronStr = await db.collection("settings").findOne({ key: 'findSchedulesCronStr' });
  const newQuotaCronStr = await db.collection("settings").findOne({ key: 'newQuotaCronStr' });
  const newQuotaStartTime = await db.collection("settings").findOne({ key: 'newQuotaStartTime' });
  const newQuotaDuration = await db.collection("settings").findOne({ key: 'newQuotaDuration' });
  const newQuotaDurationType = await db.collection("settings").findOne({ key: 'newQuotaDurationType' });
  const current = new Date();
  const newQuotaStart = parse(newQuotaStartTime.value, 'HH:mm', current);
  let newQuotaEnd = parse(newQuotaStartTime.value, 'HH:mm', current);
  switch (newQuotaDurationType.value) {
    case 'HOURS':
      newQuotaEnd = addHours(newQuotaEnd, newQuotaDuration.value);
      break;
    case 'MINUTES':
      newQuotaEnd = addMinutes(newQuotaEnd, newQuotaDuration.value);
      break;
    default:
      break;
  }
  if (current >= newQuotaStart && current <= newQuotaEnd) {
    console.log("New Quota Start: " + newQuotaStart + " End: " + newQuotaEnd);
    cronsObj.newQuota = cron.schedule(newQuotaCronStr.value, execNewQuotas, { scheduled: true })
    cronsObj.newQuota.start();
  } else {
    console.log("New Quota stopped");
    if (cronsObj?.newQuota) cronsObj.newQuota?.stop();
  }
  const trxs = await db
    .collection("trxs")
    .find({
      status: 'PENDING',
      type: 'FIND_SCHEDULES'
    }).toArray();
  if (trxs) {
    console.log("Find Schedules started - finded " + trxs.length + " trxs");
    cronsObj.findSchedules = cron.schedule(findSchedulesCronStr.value, execFindSchedules, { scheduled: true })
    cronsObj.findSchedules.start();
  } else {
    console.log("Find Schedules stopped");
    if (cronsObj?.findSchedules) cronsObj.findSchedules?.stop();
  }
});

app.listen(3128);