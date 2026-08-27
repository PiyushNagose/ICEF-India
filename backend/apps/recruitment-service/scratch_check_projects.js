const mongoose = require("mongoose");
const Project = require("./src/shared/models/Project");
require("dotenv").config({ path: "../../.env" });

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const projects = await Project.find().sort({ updatedAt: -1 }).limit(5);
  console.log(projects.map(p => ({
    name: p.name,
    isSoftDeleted: p.isSoftDeleted,
    deletedBy: p.deletedBy,
    updatedAt: p.updatedAt
  })));
  process.exit(0);
}

checkDb();
