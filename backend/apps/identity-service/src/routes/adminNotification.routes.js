const express = require("express");
const router = express.Router();
const asyncHandler = require("../shared/utils/asyncHandler");
const { ApiResponse } = require("../shared/utils/ApiResponse");
const { StatusCodes } = require("http-status-codes");
const Notification = require("../shared/models/Notification");
const authenticate = require("../shared/middlewares/authenticate");
const { authorize } = require("../shared/middlewares/authorize");
const { getPaginationParams } = require("../shared/utils/helpers");
const { paginationMeta } = require("../shared/utils/ApiResponse");

router.use(authenticate, authorize("admin", "employee"));

const HIGH_VOLUME_ADMIN_TYPES = ["payment_success", "application_submitted"];

const buildAdminNotificationFilter = (userId, query = {}) => {
  const filter = {
    recipientId: userId,
    recipientModel: "Employee",
    type: { $nin: HIGH_VOLUME_ADMIN_TYPES },
  };

  if (query.isRead !== undefined) filter.isRead = query.isRead === "true";
  if (query.type) {
    filter.type = {
      $regex: `^${query.type}`,
      $options: "i",
      $nin: HIGH_VOLUME_ADMIN_TYPES,
    };
  }

  return filter;
};

// GET /api/admin/notifications
router.get("/", asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPaginationParams(req.query);
  const filter = buildAdminNotificationFilter(req.user.id, req.query);

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments(buildAdminNotificationFilter(req.user.id, { isRead: "false" })),
  ]);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Notifications fetched", { notifications, unreadCount }, paginationMeta(total, page, limit))
  );
}));

// PATCH /api/admin/notifications/read-all
router.patch("/read-all", asyncHandler(async (req, res) => {
  await Notification.updateMany(
    buildAdminNotificationFilter(req.user.id, { isRead: "false" }),
    { isRead: true, readAt: new Date() }
  );
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "All notifications marked as read"));
}));

// PATCH /api/admin/notifications/:id/read
router.patch("/:id/read", asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipientId: req.user.id },
    { isRead: true, readAt: new Date() },
    { new: true }
  );
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "Notification marked as read", { notification }));
}));

// DELETE /api/admin/notifications/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  await Notification.findOneAndDelete({ _id: req.params.id, recipientId: req.user.id });
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "Notification deleted"));
}));

module.exports = router;
