const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Auth ──────────────────────────────────────────────
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: function () {
        return this.accountType !== "ghost";
      },
      minlength: 8,
      select: false,
    },

    // ── Account Type (NEW) ────────────────────────────────
    accountType: {
      type: String,
      enum: ["ghost", "candidate", "admin", "employee"],
      default: "ghost",
    },

    // ── Registration Number (NEW) ─────────────────────────
    registrationNumber: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },

    // ── Creation Source (NEW) ─────────────────────────────
    createdVia: {
      type: String,
      enum: ["public_application", "admin", "manual"],
      default: "public_application",
    },

    role: {
      type: String,
      enum: ["candidate", "applicant"],
      default: "applicant",
    },
    isEmailVerified: { type: Boolean, default: false },
    isMobileVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // ── OTP ───────────────────────────────────────────────
    otp: { type: String, select: false },
    otpExpiry: { type: Date, select: false },

    // ── Refresh Token ─────────────────────────────────────
    refreshToken: { type: String, select: false },

    // ── Personal Details ──────────────────────────────────
    fullName: { type: String, trim: true },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ["male", "female", "other"] },
    category: {
      type: String,
      enum: ["general", "obc", "sc", "st", "ews"],
    },
    fatherName: { type: String, trim: true },
    motherName: { type: String, trim: true },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed"],
    },
    religion: { type: String, trim: true },
    identificationMark: { type: String, trim: true },
    registeredMobile: { type: String, trim: true },
    isDomicileOfBihar: { type: Boolean },

    // ── Profile Photo ─────────────────────────────────────
    profilePhoto: { type: String }, // Cloudinary URL

    // ── Profile Completion ────────────────────────────────
    profileCompletionPercentage: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// ── Indexes ───────────────────────────────────────────────
userSchema.index({ registeredMobile: 1 });
userSchema.index({ accountType: 1 });

// ── Hash password before save ─────────────────────────────
userSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ── Compare password ──────────────────────────────────────
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Remove sensitive fields from JSON output ──────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.otp;
  delete obj.otpExpiry;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
