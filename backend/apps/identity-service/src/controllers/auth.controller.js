const { StatusCodes } = require("http-status-codes");
const authService = require("../shared/services/auth.service");
const { ApiResponse } = require("../shared/utils/ApiResponse");
const asyncHandler = require("../shared/utils/asyncHandler");
const { emitToAdmins, SOCKET_EVENTS } = require("../shared/socket/index");
const logger = require("../shared/utils/logger");

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new candidate
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, registeredMobile]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, minLength: 8 }
 *               registeredMobile: { type: string, example: "9876543210" }
 *     responses:
 *       201: { description: Registration successful, OTP sent }
 *       409: { description: Email already registered }
 */
const register = asyncHandler(async (req, res) => {
  const result = await authService.registerCandidate(req.body);

  try {
    emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
      type: "new_registration",
      message: `New candidate registered: ${result.email}`,
      timestamp: new Date(),
    });
  } catch (e) {
    logger.warn("Socket emit failed: " + e.message);
  }

  res
    .status(StatusCodes.CREATED)
    .json(
      new ApiResponse(
        StatusCodes.CREATED,
        "Registration successful. OTP sent to your email.",
        result,
      ),
    );
});

/**
 * @swagger
 * /api/auth/verify-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Verify OTP and activate account
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email: { type: string }
 *               otp: { type: string, minLength: 6, maxLength: 6 }
 *     responses:
 *       200: { description: OTP verified, tokens returned }
 *       400: { description: Invalid or expired OTP }
 */
const verifyOTP = asyncHandler(async (req, res) => {
  const result = await authService.verifyOTP(req.body);
  authService.setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "OTP verified successfully", {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }),
  );
});

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Candidate login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
const loginCandidate = asyncHandler(async (req, res) => {
  const result = await authService.loginCandidate(req.body);
  authService.setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Login successful", {
      user: result.user,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }),
  );
});

/**
 * @swagger
 * /api/auth/admin/login:
 *   post:
 *     tags: [Auth]
 *     summary: Admin / Employee login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login successful }
 *       401: { description: Invalid credentials }
 */
const loginAdmin = asyncHandler(async (req, res) => {
  const result = await authService.loginAdmin({ ...req.body, loginAs: "admin" }, {
    ipAddress: req.ip || req.headers["x-forwarded-for"],
  });
  authService.setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Super Admin login successful", {
      user: result.employee,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }),
  );
});

const loginEmployee = asyncHandler(async (req, res) => {
  const result = await authService.loginAdmin({ ...req.body, loginAs: "employee" }, {
    ipAddress: req.ip || req.headers["x-forwarded-for"],
  });
  authService.setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Employee login successful", {
      user: result.employee,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }),
  );
});

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     responses:
 *       200: { description: New access token issued }
 *       401: { description: Invalid refresh token }
 */
const refreshToken = asyncHandler(async (req, res) => {
  const token = req.cookies?.refreshToken || req.body?.refreshToken;
  const result = await authService.refreshAccessToken(token);
  authService.setAuthCookies(res, result.accessToken, result.refreshToken);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Token refreshed", {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
    }),
  );
});

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: OTP sent }
 *       404: { description: Email not found }
 */
const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.body);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result.message));
});

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password using OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email: { type: string }
 *               otp: { type: string }
 *               newPassword: { type: string, minLength: 8 }
 *     responses:
 *       200: { description: Password reset successful }
 *       400: { description: Invalid OTP }
 */
const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.body);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result.message));
});

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Logged out }
 */
const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user.id, req.user.role);
  authService.clearAuthCookies(res);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Logged out successfully"));
});

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: Current user data }
 */
const getMe = asyncHandler(async (req, res) => {
  let user;
  if (req.user.role === "candidate") {
    const User = require("../shared/models/User");
    user = await User.findById(req.user.id);
  } else {
    const Employee = require("../shared/models/Employee");
    user = await Employee.findById(req.user.id).populate(
      "systemRole",
      "roleName permissions",
    );
  }

  if (!user) {
    const ApiError = require("../shared/utils/ApiError");
    throw new ApiError(404, "User not found");
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "User fetched", {
      user: {
        ...user.toSafeObject(),
        role:
          user.systemRole?.roleName?.trim().toLowerCase() === "super admin"
            ? "admin"
            : req.user.role,
      },
    }),
  );
});

const updateProfile = asyncHandler(async (req, res) => {
  const User = require("../shared/models/User");
  const Employee = require("../shared/models/Employee");
  const ApiError = require("../shared/utils/ApiError");

  if (req.user.role !== "candidate") {
    const allowed = [
      "fullName",
      "contactNumber",
      "department",
      "roleDesignation",
      "dateOfJoining",
    ];
    const updates = {};
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, "No valid fields to update");
    }

    const employee = await Employee.findById(req.user.id).populate(
      "systemRole",
      "roleName permissions",
    );
    if (!employee) throw new ApiError(404, "User not found");

    Object.assign(employee, updates);
    await employee.save({ validateBeforeSave: false });

    return res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "Profile updated successfully", {
        user: employee.toSafeObject(),
      }),
    );
  }

  const allowed = [
    "fullName",
    "dateOfBirth",
    "gender",
    "category",
    "fatherName",
    "motherName",
    "maritalStatus",
    "religion",
    "identificationMark",
    "registeredMobile",
    "isDomicileOfBihar",
    "profilePhoto",
  ];

  const updates = {};
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, "No valid fields to update");
  }

  // Calculate profile completion
  const user = await User.findById(req.user.id);
  if (!user) throw new ApiError(404, "User not found");

  Object.assign(user, updates);

  // Recalculate completion percentage
  const completionFields = [
    "fullName",
    "dateOfBirth",
    "gender",
    "category",
    "fatherName",
    "registeredMobile",
    "isDomicileOfBihar",
  ];
  const filled = completionFields.filter(
    (f) => user[f] != null && user[f] !== "",
  ).length;
  user.profileCompletionPercentage = Math.round(
    (filled / completionFields.length) * 100,
  );

  await user.save({ validateBeforeSave: false });

  // Update localStorage token data — return fresh user
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Profile updated successfully", {
      user: user.toSafeObject(),
    }),
  );
});

const changePassword = asyncHandler(async (req, res) => {
  const User = require("../shared/models/User");
  const Employee = require("../shared/models/Employee");
  const ApiError = require("../shared/utils/ApiError");
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, "Current password and new password are required");
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, "New password must be at least 8 characters");
  }

  const Model = req.user.role === "candidate" ? User : Employee;
  const user = await Model.findById(req.user.id).select("+password");
  if (!user) throw new ApiError(404, "User not found");

  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) throw new ApiError(401, "Current password is incorrect");

  user.password = newPassword; // pre-save hook will hash it
  if (req.user.role !== "candidate") {
    user.mustChangePassword = false;
    user.passwordChangedAt = new Date();
  }
  await user.save({ validateBeforeSave: false });

  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, "Password changed successfully"));
});

/**
 * @swagger
 * /api/auth/resend-otp:
 *   post:
 *     tags: [Auth]
 *     summary: Resend OTP for email verification
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string }
 *     responses:
 *       200: { description: OTP resent }
 *       404: { description: User not found }
 */
const resendOTP = asyncHandler(async (req, res) => {
  const result = await authService.resendOTP(req.body.email);
  res
    .status(StatusCodes.OK)
    .json(new ApiResponse(StatusCodes.OK, result.message));
});

module.exports = {
  register,
  verifyOTP,
  loginCandidate,
  loginAdmin,
  loginEmployee,
  refreshToken,
  forgotPassword,
  resetPassword,
  logout,
  getMe,
  updateProfile,
  changePassword,
  resendOTP,
};
