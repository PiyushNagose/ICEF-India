/**
 * Simple Seed Script — Creates Super Admin + default roles
 * Run: node scripts/seed-admin.js
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcryptjs = require("bcryptjs");

// Colors
const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  bright: "\x1b[1m",
};

async function seed() {
  console.log(`\n${C.bright}${C.cyan}🌱 Seeding database...${C.reset}\n`);

  try {
    // Connect
    console.log(`${C.cyan}ℹ️  Connecting...${C.reset}`);
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(
      `${C.green}✅ Connected to: ${mongoose.connection.db.databaseName}${C.reset}\n`,
    );

    // Define schemas inline to avoid module loading issues
    const permissionSchema = new mongoose.Schema(
      {
        create: { type: Boolean, default: false },
        view: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
        download: { type: Boolean, default: false },
      },
      { _id: false },
    );

    const roleSchema = new mongoose.Schema(
      {
        roleName: { type: String, required: true, unique: true, trim: true },
        roleDescription: { type: String, trim: true },
        isSystemRole: { type: Boolean, default: false },
        permissions: {
          jobs: permissionSchema,
          applications: permissionSchema,
          analytics: permissionSchema,
          employees: permissionSchema,
          paymentSettings: permissionSchema,
          support: permissionSchema,
          projects: permissionSchema,
          results: permissionSchema,
          admitCards: permissionSchema,
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      },
      { timestamps: true },
    );

    const employeeSchema = new mongoose.Schema(
      {
        fullName: { type: String, required: true, trim: true },
        contactNumber: { type: String, required: true, trim: true },
        department: { type: String, required: true, trim: true },
        roleDesignation: { type: String, required: true, trim: true },
        employeeId: { type: String, required: true, unique: true, trim: true },
        dateOfJoining: { type: Date, required: true },
        officialEmail: {
          type: String,
          required: true,
          unique: true,
          trim: true,
          lowercase: true,
        },
        password: { type: String, required: true },
        systemRole: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Role",
          required: true,
        },
        status: {
          type: String,
          enum: ["Active", "Inactive", "Suspended"],
          default: "Active",
        },
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
      },
      { timestamps: true },
    );

    // Hash password before saving
    employeeSchema.pre("save", async function (next) {
      if (!this.isModified("password")) return next();
      this.password = await bcryptjs.hash(this.password, 12);
      next();
    });

    const Role = mongoose.models.Role || mongoose.model("Role", roleSchema);
    const Employee =
      mongoose.models.Employee || mongoose.model("Employee", employeeSchema);

    // Create roles
    const allPerms = {
      create: true,
      view: true,
      edit: true,
      delete: true,
      download: true,
    };
    const viewOnly = {
      create: false,
      view: true,
      edit: false,
      delete: false,
      download: true,
    };
    const editView = {
      create: false,
      view: true,
      edit: true,
      delete: false,
      download: true,
    };

    const roles = [
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
        },
      },
    ];

    let superAdminRole;
    for (const roleData of roles) {
      const existing = await Role.findOne({ roleName: roleData.roleName });
      if (existing) {
        existing.roleDescription = roleData.roleDescription;
        existing.isSystemRole = roleData.isSystemRole;
        existing.permissions = {
          ...(existing.permissions?.toObject?.() || existing.permissions || {}),
          ...roleData.permissions,
        };
        await existing.save();
        console.log(
          `${C.yellow}⚠️  Role exists, updated permissions: ${roleData.roleName}${C.reset}`,
        );
        if (roleData.roleName === "Super Admin") superAdminRole = existing;
      } else {
        const role = await Role.create(roleData);
        console.log(
          `${C.green}✅ Created role: ${roleData.roleName}${C.reset}`,
        );
        if (roleData.roleName === "Super Admin") superAdminRole = role;
      }
    }

    // Create Super Admin
    const adminEmail = process.env.ADMIN_EMAIL || "admin@recruitment.gov.in";
    const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123456";

    const existingAdmin = await Employee.findOne({ officialEmail: adminEmail });
    if (existingAdmin) {
      console.log(`${C.yellow}⚠️  Super Admin exists: ${adminEmail}${C.reset}`);
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
      });
      console.log(`${C.green}✅ Created Super Admin: ${adminEmail}${C.reset}`);
    }

    console.log(`\n${C.bright}${C.green}╔══════════════════════════════════════════╗
║         ✅ Seed completed!               ║
╚══════════════════════════════════════════╝${C.reset}

${C.bright}Login Credentials:${C.reset}
  Email:    ${adminEmail}
  Password: ${adminPassword}

${C.bright}API Endpoints:${C.reset}
  POST http://localhost:5000/api/auth/admin/login
  POST http://localhost:5001/api/auth/admin/login
`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(`${C.red}❌ Seed failed: ${error.message}${C.reset}`);
    console.error(error);
    process.exit(1);
  }
}

seed();
