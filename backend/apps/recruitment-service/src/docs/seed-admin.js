/**
 * Seed Script — Creates the first Super Admin + default roles
 * Run once: node scripts/seed-admin.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// ── Colors ────────────────────────────────────────────────────
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
};
const log = (msg) => console.log(`${C.green}✅ ${msg}${C.reset}`);
const warn = (msg) => console.log(`${C.yellow}⚠️  ${msg}${C.reset}`);
const err = (msg) => console.log(`${C.red}❌ ${msg}${C.reset}`);
const info = (msg) => console.log(`${C.cyan}ℹ️  ${msg}${C.reset}`);

async function seed() {
  console.log(`\n${C.bright}${C.cyan}🌱 Seeding database...${C.reset}\n`);

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    info("Connected to MongoDB");

    const Role = require("../src/models/Role");
    const Employee = require("../src/models/Employee");

    // ── 1. Create default roles ───────────────────────────────
    const allPerms = {
      create: true,
      view: true,
      edit: true,
      delete: true,
      download: true,
      publish: true,
      approve: true,
      reject: true,
      assign: true,
      resolve: true,
      refund: true,
      reconcile: true,
      publishWindow: true,
      generateOnDemand: true,
      bulkGenerate: true,
      attendance: true,
    };
    const viewOnly = {
      create: false,
      view: true,
      edit: false,
      delete: false,
      download: true,
      publish: false,
      approve: false,
      reject: false,
      assign: false,
      resolve: false,
      refund: false,
      reconcile: false,
      publishWindow: false,
      generateOnDemand: false,
      bulkGenerate: false,
      attendance: false,
    };
    const editView = {
      create: false,
      view: true,
      edit: true,
      delete: false,
      download: true,
      publish: false,
      approve: false,
      reject: false,
      assign: false,
      resolve: false,
      refund: false,
      reconcile: false,
      publishWindow: false,
      generateOnDemand: false,
      bulkGenerate: false,
      attendance: false,
    };

    const defaultRoles = [
      {
        roleName: "Super Admin",
        roleDescription: "Full system access",
        isSystemRole: true,
        permissions: {
          jobs: allPerms,
          applications: allPerms,
          analytics: allPerms,
          employees: allPerms,
          paymentSettings: allPerms,
          support: allPerms,
          projects: allPerms,
          results: allPerms,
          admitCards: allPerms,
          payments: allPerms,
          cms: allPerms,
          activityLogs: allPerms,
          standardsSettings: allPerms,
        },
      },
      {
        roleName: "Recruitment Admin",
        roleDescription: "Manage jobs and applications",
        isSystemRole: true,
        permissions: {
          jobs: allPerms,
          applications: allPerms,
          analytics: viewOnly,
          employees: viewOnly,
          paymentSettings: viewOnly,
          support: editView,
          projects: allPerms,
          results: editView,
          admitCards: allPerms,
          payments: viewOnly,
          cms: editView,
          activityLogs: viewOnly,
          standardsSettings: editView,
        },
      },
      {
        roleName: "Verification Officer",
        roleDescription: "Verify candidate documents",
        isSystemRole: true,
        permissions: {
          jobs: viewOnly,
          applications: editView,
          analytics: viewOnly,
          employees: viewOnly,
          paymentSettings: viewOnly,
          support: viewOnly,
          projects: viewOnly,
          results: viewOnly,
          admitCards: viewOnly,
          payments: viewOnly,
          cms: viewOnly,
          activityLogs: viewOnly,
          standardsSettings: viewOnly,
        },
      },
      {
        roleName: "Finance Officer",
        roleDescription: "Manage payments and refunds",
        isSystemRole: true,
        permissions: {
          jobs: viewOnly,
          applications: viewOnly,
          analytics: editView,
          employees: viewOnly,
          paymentSettings: allPerms,
          support: viewOnly,
          projects: viewOnly,
          results: viewOnly,
          admitCards: viewOnly,
          payments: allPerms,
          cms: viewOnly,
          activityLogs: viewOnly,
          standardsSettings: viewOnly,
        },
      },
      {
        roleName: "Support Agent",
        roleDescription: "Handle support tickets",
        isSystemRole: true,
        permissions: {
          jobs: viewOnly,
          applications: viewOnly,
          analytics: viewOnly,
          employees: viewOnly,
          paymentSettings: viewOnly,
          support: allPerms,
          projects: viewOnly,
          results: viewOnly,
          admitCards: viewOnly,
          payments: viewOnly,
          cms: viewOnly,
          activityLogs: viewOnly,
          standardsSettings: viewOnly,
        },
      },
    ];

    let superAdminRole;
    for (const roleData of defaultRoles) {
      const existing = await Role.findOne({ roleName: roleData.roleName });
      if (existing) {
        warn(`Role already exists: ${roleData.roleName}`);
        if (roleData.roleName === "Super Admin") superAdminRole = existing;
      } else {
        const role = await Role.create(roleData);
        log(`Created role: ${roleData.roleName}`);
        if (roleData.roleName === "Super Admin") superAdminRole = role;
      }
    }

    // ── 2. Create Super Admin employee ────────────────────────
    const adminEmail = process.env.ADMIN_EMAIL || "admin@recruitment.gov.in";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";

    const existingAdmin = await Employee.findOne({ officialEmail: adminEmail });
    if (existingAdmin) {
      warn(`Super Admin already exists: ${adminEmail}`);
    } else {
      // Check if email exists in User (Candidate) collection
      const existingUser = await User.findOne({ email: adminEmail });
      if (existingUser) {
        err(
          `Email ${adminEmail} already registered as candidate. Cannot create admin with this email.`,
        );
      } else {
        await Employee.create({
          fullName: "Super Admin",
          contactNumber: "9999999999",
          department: "Administration",
          roleDesignation: "Super Administrator",
          employeeId: "EMP-SUPER-001",
          dateOfJoining: new Date(),
          officialEmail: adminEmail,
          password: adminPassword,
          systemRole: superAdminRole._id,
          status: "Active",
          createdBy: null,
        });
        log(`Created Super Admin: ${adminEmail}`);
        info(`Password: ${adminPassword}`);
      }
    }

    console.log(`\n${C.bright}${C.green}╔══════════════════════════════════════════╗
║         ✅ Seed completed!               ║
╚══════════════════════════════════════════╝${C.reset}

${C.bright}Admin Login:${C.reset}
  Email:    ${adminEmail}
  Password: ${adminPassword}

${C.bright}API:${C.reset}
  POST http://localhost:5000/api/auth/admin/login
`);
  } catch (error) {
    err(`Seed failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seed();
