const mongoose = require("mongoose");

// Permission sub-schema — reused for each module
const permissionSchema = new mongoose.Schema(
  {
    create: { type: Boolean, default: false },
    view: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    download: { type: Boolean, default: false },
    publish: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    reject: { type: Boolean, default: false },
    assign: { type: Boolean, default: false },
    resolve: { type: Boolean, default: false },
    refund: { type: Boolean, default: false },
    reconcile: { type: Boolean, default: false },
    publishWindow: { type: Boolean, default: false },
    generateOnDemand: { type: Boolean, default: false },
    bulkGenerate: { type: Boolean, default: false },
    attendance: { type: Boolean, default: false },
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
      payments: { type: permissionSchema, default: () => ({}) },
      support: { type: permissionSchema, default: () => ({}) },
      projects: { type: permissionSchema, default: () => ({}) },
      results: { type: permissionSchema, default: () => ({}) },
      admitCards: { type: permissionSchema, default: () => ({}) },
      cms: { type: permissionSchema, default: () => ({}) },
      activityLogs: { type: permissionSchema, default: () => ({}) },
      standardsSettings: { type: permissionSchema, default: () => ({}) },
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
