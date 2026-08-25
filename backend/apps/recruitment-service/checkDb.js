const mongoose = require("mongoose");
const AdmitCardTemplate = require("./src/shared/models/AdmitCardTemplate");
require("dotenv").config({ path: "../../.env" });

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const templates = await AdmitCardTemplate.find({});
  console.log("Templates in DB:");
  console.log(templates);
  mongoose.connection.close();
}

checkDb().catch(console.error);
