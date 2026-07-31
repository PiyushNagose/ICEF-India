const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const employeeSchema = new mongoose.Schema(
  {
    // ── Personal Details ──────────────────────────────────────
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    dateOfBirth: { type: Date },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    contactNumber: {
      type: String,
      required: [true, "Contact number is required"],
      trim: true,
    },

    // ── Employment Details ────────────────────────────────────
    department: {
      type: String,
      required: [true, "Department is required"],
      trim: true,
    },
    roleDesignation: {
      type: String,
      required: [true, "Role designation is required"],
      trim: true,
    },
    employeeId: {
      type: String,
      required: [true, "Employee ID is required"],
      unique: true,
      trim: true,
    },
    dateOfJoining: {
      type: Date,
      required: [true, "Date of joining is required"],
    },

    // ── System Access ─────────────────────────────────────────
    officialEmail: {
      type: String,
      required: [true, "Official email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    systemRole: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: [true, "System role is required"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "On Leave"],
      default: "Active",
    },

    // ── Security ──────────────────────────────────────────────
    refreshToken: { type: String, select: false },
    lastLoginAt: { type: Date },
    lastLoginIP: { type: String },
    mustChangePassword: { type: Boolean, default: false },
    passwordChangedAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0, select: false },
    lockedUntil: { type: Date, select: false },
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },

    // ── Metadata ──────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────────
// Note: employeeId and officialEmail already have unique indexes from schema definition
employeeSchema.index({ department: 1 });
employeeSchema.index({ status: 1 });
employeeSchema.index({ systemRole: 1 });

// ── Hash password before save ─────────────────────────────────
employeeSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────────
employeeSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Remove sensitive fields from JSON output ──────────────────
employeeSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model("Employee", employeeSchema);
