const ApiError = require("../utils/ApiError");

/**
 * Role-based access control middleware.
 * Usage: authorize('admin') or authorize('admin', 'employee')
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, "Not authenticated");
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      throw new ApiError(
        403,
        `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      );
    }

    next();
  };
};

/**
 * Permission-based access control for employee roles.
 * Checks the employee's permission matrix from the database.
 * Usage: checkPermission('jobs', 'create')
 */
const checkPermission = (module, action) => {
  return async (req, res, next) => {
    try {
      // Main admin has all permissions
      if (req.user.role === "admin") {
        return next();
      }

      // For employees, check their role's permission matrix
      if (req.user.role === "employee") {
        const Employee = require("../models/Employee");
        const Role = require("../models/Role");

        const employee = await Employee.findById(req.user.id).select(
          "status systemRole",
        );
        if (!employee) {
          throw new ApiError(403, "Employee not found");
        }
        if (employee.status !== "Active") {
          throw new ApiError(403, "Employee account is inactive");
        }

        const role = await Role.findById(employee.systemRole);
        if (!role) {
          throw new ApiError(403, "Role not found");
        }
        if (role.isActive === false) {
          throw new ApiError(403, "Role is inactive");
        }

        if (role.roleName?.trim().toLowerCase() === "super admin") {
          return next();
        }

        const hasPermission = role.permissions?.[module]?.[action];
        if (!hasPermission) {
          throw new ApiError(403, `Permission denied: ${action} on ${module}`);
        }

        return next();
      }

      throw new ApiError(403, "Access denied");
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { authorize, checkPermission };
