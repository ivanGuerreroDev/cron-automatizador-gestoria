const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const axios = require('axios');
const clientPromise = require("./mongodb");
const HOST_URL = process.env.HOST_URL || "http://localhost:3000";
app = express();
const ejecutarAgendarChile = async (user, pass, year, month) => {
  const config = {
    method: 'get',
    url: `${HOST_URL}/api/agendarCitas/${user}/${pass}/f6d7b7fb/${year}/${month}`
  }
  try {
    let res = await axios(config)
    console.log(res.data.message);
  } catch (error) {
    console.log(error)
  }

}
const ejecutarAgendarGlobal = async () => {
  const client = await clientPromise;
  const db = client.db("saime-citas");
  var query = { status: 'PENDING' };
  const trxs = await db
    .collection("trxs")
    .find(query).toArray();

  if (trxs) {
    trxs.forEach(schedules => {
      schedules?.offices?.forEach(office => {
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

cron.schedule("*/1 * * * * *", async function () {
  //ejecutarAgendarChile('V5781580', 'Lrlm1157', '2023', '9')
  //ejecutarAgendarChile('V27198131', 'Saime123', '2023', '9')
  //ejecutarAgendarChile('V26746593', 'Saime123', '2023', '9')
  //ejecutarAgendarChile('V26746593', 'Saime123', '2023', '8')
  ejecutarAgendarGlobal()
});

app.listen(3128);