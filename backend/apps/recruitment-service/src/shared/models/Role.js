const mongoose = require("mongoose");

// Permission sub-schema — reused for each module
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
    roleName: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
    },
    roleDescription: {
      type: String,
      trim: true,
    },
    isSystemRole: {
      type: Boolean,
      default: false, // true for built-in roles like 'admin'
    },
    permissions: {
      jobs: { type: permissionSchema, default: () => ({}) },
      applications: { type: permissionSchema, default: () => ({}) },
      analytics: { type: permissionSchema, default: () => ({}) },
      employees: { type: permissionSchema, default: () => ({}) },
      paymentSettings: { type: permissionSchema, default: () => ({}) },
      support: { type: permissionSchema, default: () => ({}) },
      projects: { type: permissionSchema, default: () => ({}) },
      results: { type: permissionSchema, default: () => ({}) },
      admitCards: { type: permissionSchema, default: () => ({}) },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
    },
  },
  { timestamps: true },
);

roleSchema.index({ isSystemRole: 1 });

module.exports = mongoose.model("Role", roleSchema);
