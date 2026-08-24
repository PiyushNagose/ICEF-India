const asyncHandler = require("../utils/asyncHandler");

/**
 * Audit log middleware factory.
 * Automatically logs admin/employee actions to the ActivityLog collection.
 *
 * Usage: auditLog('Jobs', 'CREATE')
 */
const auditLog = (module, action) => {
  return asyncHandler(async (req, res, next) => {
    // Store audit info on req so the controller can enrich it if needed
    req.auditInfo = {
      module,
      action,
      employeeId: req.user?.id,
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"],
    };
    next();
  });
};

/**
 * Call this inside a controller after a successful operation
 * to persist the audit log entry.
 */
const saveAuditLog = async (req, details = "") => {
  try {
    if (!req.auditInfo) return;

    const ActivityLog = require("../models/ActivityLog");
    await ActivityLog.create({
      ...req.auditInfo,
      details,
    });

    if (
      req.user?.role === "employee" &&
      (req.auditInfo.action === "UPDATE" || req.auditInfo.action === "DELETE")
    ) {
      const Employee = require("../models/Employee");
      const Role = require("../models/Role");
      const Notification = require("../models/Notification");
      const { emitToAdmins, SOCKET_EVENTS } = require("../socket/index");

      const superAdminRole = await Role.findOne({ roleName: { $regex: /super\s*admin/i } }).select("_id").lean();
      if (superAdminRole) {
        const admins = await Employee.find({ status: "Active", systemRole: superAdminRole._id }).select("_id").lean();
        if (admins.length > 0) {
          const actor = await Employee.findById(req.user.id)
            .select("fullName employeeId officialEmail")
            .lean();
          const empName =
            actor?.fullName ||
            actor?.employeeId ||
            req.user?.employeeId ||
            req.user?.email ||
            "An employee";
          const recordAction =
            req.auditInfo.action === "UPDATE" ? "updated" : "deleted";
          const title = `Employee ${recordAction} ${req.auditInfo.module}`;
          const message = `${empName} ${recordAction} a ${req.auditInfo.module} record from the employee portal.`;
          const link = "/admin/activity-logs";

          const docs = admins.map(a => ({
            recipientId: a._id,
            recipientModel: "Employee",
            type: "system_audit",
            title,
            message,
            link,
            metadata: {
              module: req.auditInfo.module,
              action: req.auditInfo.action,
              employeeId: req.auditInfo.employeeId,
              actorRole: req.user.role,
            },
            isRead: false,
          }));

          await Notification.insertMany(docs, { ordered: false });
          try {
            emitToAdmins(SOCKET_EVENTS.NEW_NOTIFICATION, {
              type: "system_audit", title, message, link, isRead: false, createdAt: new Date(),
            });
          } catch (_) {}
        }
      }
    }
  } catch (err) {
    // Audit log failure should never break the main operation
    const logger = require("../utils/logger");
    logger.error(`Audit log save failed: ${err.message}`);
  }
};

module.exports = { auditLog, saveAuditLog };
