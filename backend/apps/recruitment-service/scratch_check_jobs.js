const mongoose = require("mongoose");
const Job = require("./src/shared/models/Job");
require("dotenv").config({ path: "../../.env" });

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const jobs = await Job.find().sort({ updatedAt: -1 }).limit(5);
  console.log(jobs.map(p => ({
    title: p.title,
    isSoftDeleted: p.isSoftDeleted,
    deletedBy: p.deletedBy,
    updatedAt: p.updatedAt
  })));
  process.exit(0);
}

checkDb();
