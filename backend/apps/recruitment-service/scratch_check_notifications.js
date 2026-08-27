const mongoose = require("mongoose");
const Notification = require("./src/shared/models/Notification");
require("dotenv").config({ path: "../../.env" });

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const notifs = await Notification.find().sort({ createdAt: -1 }).limit(5);
  console.log(JSON.stringify(notifs, null, 2));
  process.exit(0);
}

checkDb();
