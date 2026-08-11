const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const env = require("../config/env");

const validateInternalSession = async (decoded) => {
  if (!["admin", "employee"].includes(decoded.role)) return null;

  const Employee = require("../models/Employee");
  const employee = await Employee.findById(decoded.id)
    .select("+sessionVersion status passwordChangedAt systemRole")
    .populate("systemRole", "roleName isActive");

  if (!employee) throw new ApiError(401, "Account no longer exists");
  if (employee.status !== "Active") {
    throw new ApiError(403, "Account is inactive. Contact Super Admin.");
  }
  if (employee.systemRole && employee.systemRole.isActive === false) {
    throw new ApiError(403, "Assigned role is inactive");
  }
  if (
    typeof decoded.sessionVersion === "number" &&
    decoded.sessionVersion !== (employee.sessionVersion || 0)
  ) {
    throw new ApiError(401, "Session revoked. Please sign in again.");
  }
  if (
    employee.passwordChangedAt &&
    decoded.iat * 1000 < employee.passwordChangedAt.getTime() - 1000
  ) {
    throw new ApiError(401, "Session expired after password change");
  }

  return employee;
};

/**
 * Verifies the JWT access token from Authorization header or cookie.
 * Attaches decoded user payload to req.user.
 */
const authenticate = asyncHandler(async (req, res, next) => {
  let token;

  // Check Authorization header first
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Fallback to cookie
  else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    throw new ApiError(401, "Access token required");
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Token expired");
    }
    throw new ApiError(401, "Invalid token");
  }

  const employee = await validateInternalSession(decoded);

  req.user = decoded; // { id, email, role, employeeId? }
  if (employee) req.employee = employee;
  next();
});

module.exports = authenticate;
