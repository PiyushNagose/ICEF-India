const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Employee = require("../models/Employee");
const ApiError = require("../utils/ApiError");
const { generateOTP } = require("../utils/helpers");
const { publishToQueue, QUEUES } = require("../config/rabbitmq");
const { getRedis } = require("../config/redis");
const { sendOTPEmail, sendPasswordResetEmail } = require("./email.service");
const otpService = require("./otp.service");
const env = require("../config/env");

// ── Token helpers ─────────────────────────────────────────────

const generateAccessToken = (payload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

const generateRefreshToken = (payload) =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

const generateTokenPair = (payload) => ({
  accessToken: generateAccessToken(payload),
  refreshToken: generateRefreshToken(payload),
});

// ── Cookie options ────────────────────────────────────────────

const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "strict" : "lax",
};

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie("accessToken", accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie("refreshToken", refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

const clearAuthCookies = (res) => {
  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);
};

// ── Candidate Auth ────────────────────────────────────────────

const registerCandidate = async ({
  email,
  password,
  registeredMobile,
  fullName,
  dateOfBirth,
  gender,
  state,
}) => {
  // Check if email exists in User collection
  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ApiError(409, "Email already registered");

  // Check if email exists in Employee collection
  const existingEmployee = await Employee.findOne({ officialEmail: email });
  if (existingEmployee) throw new ApiError(409, "Email already registered");

  const user = await User.create({
    email,
    password,
    registeredMobile,
    fullName,
    dateOfBirth,
    gender,
    state: state || "",
    role: "candidate",
  });

  // Send OTP for email verification
  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save({ validateBeforeSave: false });

  // Send OTP email directly (not queued for immediate delivery)
  await sendOTPEmail(email, otp, fullName || email);

  return { userId: user._id, email: user.email };
};

const verifyOTP = async ({ email, otp }) => {
  const user = await User.findOne({ email }).select("+otp +otpExpiry");
  if (!user) throw new ApiError(404, "User not found");
  if (!user.otp || user.otp !== otp) throw new ApiError(400, "Invalid OTP");
  if (user.otpExpiry < new Date()) throw new ApiError(400, "OTP expired");

  user.isEmailVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save({ validateBeforeSave: false });

  const payload = { id: user._id, email: user.email, role: "candidate" };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken, user: user.toSafeObject() };
};

const loginCandidate = async ({ email, password }) => {
  const user = await User.findOne({ email }).select("+password +refreshToken");
  if (!user) throw new ApiError(401, "Invalid email or password");
  if (!user.isActive) throw new ApiError(403, "Account is deactivated");

  const isMatch = await user.comparePassword(password);
  if (!isMatch) throw new ApiError(401, "Invalid email or password");

  const payload = { id: user._id, email: user.email, role: "candidate" };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken, user: user.toSafeObject() };
};

// ── Admin / Employee Auth ─────────────────────────────────────

const MAX_EMPLOYEE_LOGIN_ATTEMPTS = 5;
const EMPLOYEE_LOCK_MS = 15 * 60 * 1000;

const isSuperAdminEmployee = (employee) =>
  employee?.systemRole?.roleName?.trim().toLowerCase() === "super admin";

const RESET_ACCOUNT_TYPES = new Set(["candidate", "admin", "employee"]);
const PASSWORD_RESET_MESSAGE =
  "If an account exists for this email, a reset OTP has been sent.";

const normalizeAccountType = (accountType = "candidate") =>
  RESET_ACCOUNT_TYPES.has(accountType) ? accountType : "candidate";

const findResetAccount = async (email, accountType, includeOtp = false) => {
  const normalizedType = normalizeAccountType(accountType);
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (normalizedType === "candidate") {
    const selectFields = includeOtp ? "+otp +otpExpiry" : "";
    const account = await User.findOne({ email: normalizedEmail }).select(
      selectFields,
    );
    return { account, accountType: normalizedType, emailField: "email" };
  }

  const selectFields = includeOtp ? "+otp +otpExpiry" : "";
  const employee = await Employee.findOne({ officialEmail: normalizedEmail })
    .select(selectFields)
    .populate("systemRole", "roleName");

  if (!employee)
    return {
      account: null,
      accountType: normalizedType,
      emailField: "officialEmail",
    };

  const isSuperAdmin = isSuperAdminEmployee(employee);
  if (normalizedType === "admin" && !isSuperAdmin) {
    return {
      account: null,
      accountType: normalizedType,
      emailField: "officialEmail",
    };
  }
  if (normalizedType === "employee" && isSuperAdmin) {
    return {
      account: null,
      accountType: normalizedType,
      emailField: "officialEmail",
    };
  }

  return {
    account: employee,
    accountType: normalizedType,
    emailField: "officialEmail",
  };
};

const loginAdmin = async (
  { email, password, loginAs = "admin" },
  meta = {},
) => {
  const employee = await Employee.findOne({ officialEmail: email })
    .select("+password +refreshToken +failedLoginAttempts +lockedUntil")
    .populate("systemRole", "roleName permissions isSystemRole");
  if (!employee) throw new ApiError(401, "Invalid credentials");
  if (employee.status !== "Active")
    throw new ApiError(403, "Account is not active");
  if (employee.lockedUntil && employee.lockedUntil > new Date()) {
    throw new ApiError(
      423,
      "Account temporarily locked. Please try again later.",
    );
  }

  const isMatch = await employee.comparePassword(password);
  if (!isMatch) {
    employee.failedLoginAttempts = (employee.failedLoginAttempts || 0) + 1;
    if (employee.failedLoginAttempts >= MAX_EMPLOYEE_LOGIN_ATTEMPTS) {
      employee.lockedUntil = new Date(Date.now() + EMPLOYEE_LOCK_MS);
    }
    await employee.save({ validateBeforeSave: false });
    throw new ApiError(401, "Invalid credentials");
  }

  const isSuperAdmin = isSuperAdminEmployee(employee);
  if (loginAs === "admin" && !isSuperAdmin) {
    throw new ApiError(401, "Invalid credentials");
  }
  if (loginAs === "employee" && isSuperAdmin) {
    throw new ApiError(401, "Invalid credentials");
  }

  const internalRole = isSuperAdmin ? "admin" : "employee";
  const payload = {
    id: employee._id,
    email: employee.officialEmail,
    role: internalRole,
    employeeId: employee.employeeId,
  };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  employee.refreshToken = refreshToken;
  employee.failedLoginAttempts = 0;
  employee.lockedUntil = undefined;
  employee.lastLoginAt = new Date();
  if (meta.ipAddress) employee.lastLoginIP = meta.ipAddress;
  await employee.save({ validateBeforeSave: false });

  return {
    accessToken,
    refreshToken,
    employee: { ...employee.toSafeObject(), role: internalRole },
  };
};

// ── Shared Auth ───────────────────────────────────────────────

const refreshAccessToken = async (incomingRefreshToken) => {
  if (!incomingRefreshToken) throw new ApiError(401, "Refresh token required");

  let decoded;
  try {
    decoded = jwt.verify(incomingRefreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new ApiError(401, "Invalid or expired refresh token");
  }

  // Find in User or Employee
  let entity;
  if (decoded.role === "candidate") {
    entity = await User.findById(decoded.id).select("+refreshToken");
  } else {
    entity = await Employee.findById(decoded.id).select("+refreshToken");
  }

  if (!entity || entity.refreshToken !== incomingRefreshToken) {
    throw new ApiError(401, "Refresh token mismatch");
  }

  const payload = {
    id: entity._id,
    email: entity.email || entity.officialEmail,
    role: decoded.role,
    ...(decoded.employeeId && { employeeId: decoded.employeeId }),
  };

  const { accessToken, refreshToken } = generateTokenPair(payload);
  entity.refreshToken = refreshToken;
  await entity.save({ validateBeforeSave: false });

  return { accessToken, refreshToken };
};

const logout = async (userId, role) => {
  if (role === "candidate") {
    await User.findByIdAndUpdate(userId, { refreshToken: null });
  } else {
    await Employee.findByIdAndUpdate(userId, { refreshToken: null });
  }
};

const forgotPassword = async ({ email, accountType = "candidate" }) => {
  const {
    account,
    accountType: resolvedType,
    emailField,
  } = await findResetAccount(email, accountType);
  if (!account) return { message: PASSWORD_RESET_MESSAGE };
  if (resolvedType === "candidate" && !account.isActive) {
    return { message: PASSWORD_RESET_MESSAGE };
  }
  if (resolvedType !== "candidate" && account.status !== "Active") {
    return { message: PASSWORD_RESET_MESSAGE };
  }

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  account.otp = otp;
  account.otpExpiry = otpExpiry;
  await account.save({ validateBeforeSave: false });

  // Send OTP email directly for immediate delivery
  await sendPasswordResetEmail(
    account[emailField],
    otp,
    account.fullName || account[emailField],
    resolvedType,
  );

  return { message: PASSWORD_RESET_MESSAGE };
};

const resetPassword = async ({
  email,
  accountType = "candidate",
  otp,
  newPassword,
}) => {
  const { account, accountType: resolvedType } = await findResetAccount(
    email,
    accountType,
    true,
  );
  if (!account) throw new ApiError(400, "Invalid or expired OTP");
  if (!account.otp || account.otp !== otp)
    throw new ApiError(400, "Invalid or expired OTP");
  if (account.otpExpiry < new Date())
    throw new ApiError(400, "Invalid or expired OTP");

  account.password = newPassword;
  account.otp = undefined;
  account.otpExpiry = undefined;
  account.refreshToken = undefined;
  if (resolvedType !== "candidate") {
    account.mustChangePassword = false;
    account.passwordChangedAt = new Date();
    account.failedLoginAttempts = 0;
    account.lockedUntil = undefined;
  }
  await account.save();

  return { message: "Password reset successful" };
};

// ── Public Apply Login (ghost user, OTP already verified via Redis) ──────────

const normalizePublicMobile = (mobile) => {
  const digits = String(mobile || "").replace(/\D/g, "");
  return digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
};

const publicApplyLogin = async ({ email, mobile }) => {
  if (!email || !mobile)
    throw new ApiError(400, "Email and mobile are required");

  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedMobile = normalizePublicMobile(mobile);

  const otpBypass = process.env.PUBLIC_OTP_DEV_BYPASS === "true";
  const [emailVerified, mobileVerified] = await Promise.all([
    otpBypass ? true : otpService.isVerified(normalizedEmail, "email"),
    otpBypass ? true : otpService.isVerified(normalizedMobile, "mobile"),
  ]);

  if (!emailVerified || !mobileVerified) {
    throw new ApiError(
      401,
      "Email and mobile OTP verification is required before starting an application",
    );
  }

  // Find existing ghost user or create one
  let user = await User.findOne({ email: normalizedEmail });

  if (user) {
    // Existing user — check it's not a real candidate with password
    // Ghost users can be re-used; real candidates should use normal login
    if (user.accountType && user.accountType !== "ghost") {
      throw new ApiError(
        409,
        "An account already exists with this email. Please log in normally.",
      );
    }
    // Update mobile if changed
    if (user.registeredMobile !== normalizedMobile) {
      user.registeredMobile = normalizedMobile;
      await user.save({ validateBeforeSave: false });
    }
  } else {
    // Create ghost user
    user = await User.create({
      email: normalizedEmail,
      registeredMobile: normalizedMobile,
      accountType: "ghost",
      createdVia: "public_application",
      role: "candidate", // keeps compatibility with existing ProtectedRoute checks
      isEmailVerified: true,
      isMobileVerified: true,
      isActive: true,
    });
  }

  // Issue JWT (same payload shape as normal candidate login)
  const payload = { id: user._id, email: user.email, role: "candidate" };
  const { accessToken, refreshToken } = generateTokenPair(payload);

  user.refreshToken = refreshToken;
  await user.save({ validateBeforeSave: false });

  return { accessToken, refreshToken, user: user.toSafeObject() };
};

const resendOTP = async (email) => {
  const user = await User.findOne({ email });
  if (!user) throw new ApiError(404, "User not found");

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save({ validateBeforeSave: false });

  // Send OTP email directly
  await sendOTPEmail(email, otp, user.fullName || email);

  return { message: "OTP resent successfully" };
};

module.exports = {
  registerCandidate,
  verifyOTP,
  loginCandidate,
  loginAdmin,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  resendOTP,
  publicApplyLogin,
  generateTokenPair,
  setAuthCookies,
  clearAuthCookies,
};
