const mongoose = require("mongoose");
const Role = require("./src/shared/models/Role");
const Employee = require("./src/shared/models/Employee");
require("dotenv").config({ path: "../../.env" });

async function checkDb() {
  await mongoose.connect(process.env.MONGODB_URI);
  const superAdminRole = await Role.findOne({ roleName: { $regex: /super\s*admin/i } }).select("_id").lean();
  console.log("Super Admin Role:", superAdminRole);
  if (superAdminRole) {
    const admins = await Employee.find({ status: "Active", systemRole: superAdminRole._id }).select("_id fullName role").lean();
    console.log("Super Admins found:", admins);
  } else {
    const allRoles = await Role.find();
    console.log("All roles:", allRoles.map(r => r.roleName));
  }
  process.exit(0);
}

checkDb();
