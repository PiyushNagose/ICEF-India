const { StatusCodes } = require("http-status-codes");
const StandardPreset = require("../../shared/models/StandardPreset");
const ApiError = require("../../shared/utils/ApiError");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const Employee = require("../../shared/models/Employee");
const { notifyAdmins } = require("../../shared/utils/notifyAdmins");

const isAdminOrSuperAdminUser = async (user = {}) => {
  if (user.role === "admin" || user.isSuperAdmin) return true;
  if (user.role !== "employee" || !user.id) return false;
  const employee = await Employee.findById(user.id)
    .populate("systemRole", "roleName")
    .select("employeeId roleDesignation systemRole")
    .lean();
  const roleName = employee?.systemRole?.roleName?.trim().toLowerCase();
  return (
    roleName === "super admin" ||
    employee?.roleDesignation?.trim().toLowerCase() === "super administrator" ||
    employee?.employeeId?.trim().toLowerCase() === "emp-super-001"
  );
};

const normalizeCriteria = (criteria = []) =>
  (Array.isArray(criteria) ? criteria : [])
    .map((item) => ({
      label: String(item.label || "").trim(),
      male: String(item.male || "").trim(),
      female: String(item.female || "").trim(),
      value: String(item.value || "").trim(),
      unit: String(item.unit || "").trim(),
      notes: String(item.notes || "").trim(),
    }))
    .filter((item) => item.label && (item.male || item.female || item.value || item.notes));

const legacyPhysicalCriteria = (physical = {}) =>
  ["height", "chest", "weight"]
    .map((key) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1),
      male: physical[key]?.male ? String(physical[key].male) : "",
      female: physical[key]?.female ? String(physical[key].female) : "",
      unit: key === "weight" ? "kg" : "cm",
    }))
    .filter((item) => item.male || item.female);

const legacyMedicalCriteria = (medical = {}) =>
  [
    { label: "Vision", value: medical.vision },
    { label: "Hearing", value: medical.hearing },
    { label: "Other", value: medical.other },
  ].filter((item) => item.value);

const normalizePayload = (body = {}) => ({
  name: String(body.name || "").trim(),
  description: String(body.description || "").trim(),
  active: body.active !== false,
  physicalStandards: {
    required: Boolean(body.physicalStandards?.required),
    criteria: normalizeCriteria(body.physicalStandards?.criteria).length
      ? normalizeCriteria(body.physicalStandards?.criteria)
      : legacyPhysicalCriteria(body.physicalStandards),
  },
  medicalStandards: {
    required: Boolean(body.medicalStandards?.required),
    criteria: normalizeCriteria(body.medicalStandards?.criteria).length
      ? normalizeCriteria(body.medicalStandards?.criteria)
      : legacyMedicalCriteria(body.medicalStandards),
  },
});

const getAll = asyncHandler(async (req, res) => {
  const isAdminOrSuperAdmin = await isAdminOrSuperAdminUser(req.user);
  const filter = req.query.includeInactive === "1" ? {} : { active: true };
  if (!isAdminOrSuperAdmin) filter.isSoftDeleted = { $ne: true };
  const presets = await StandardPreset.find(filter).sort({ name: 1 }).lean();
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Standard presets fetched", { presets }),
  );
});

const create = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);
  if (!payload.name) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Preset name is required");
  }

  const preset = await StandardPreset.create({
    ...payload,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "Standard preset created", { preset }),
  );
});

const update = asyncHandler(async (req, res) => {
  const payload = normalizePayload(req.body);
  if (!payload.name) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Preset name is required");
  }

  const preset = await StandardPreset.findByIdAndUpdate(
    req.params.id,
    { ...payload, updatedBy: req.user.id },
    { new: true, runValidators: true },
  );
  if (!preset) throw new ApiError(StatusCodes.NOT_FOUND, "Preset not found");
  await saveAuditLog(req, `Updated standard preset: ${preset.name}`);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Standard preset updated", { preset }),
  );
});

const remove = asyncHandler(async (req, res) => {
  const isAdminOrSuperAdmin = await isAdminOrSuperAdminUser(req.user);
  const preset = await StandardPreset.findByIdAndUpdate(
    req.params.id,
    {
      active: false,
      updatedBy: req.user.id,
      ...(isAdminOrSuperAdmin
        ? {}
        : {
            isSoftDeleted: true,
            deletedBy: req.user.id,
            deletedAt: new Date(),
          }),
    },
    { new: true },
  );
  if (!preset) throw new ApiError(StatusCodes.NOT_FOUND, "Preset not found");
  await saveAuditLog(req, `Archived standard preset: ${preset.name}`);
  if (!isAdminOrSuperAdmin) {
    await notifyAdmins({
      type: "system_audit",
      title: "Standard preset removal requested",
      message: `Employee removed standard preset "${preset.name}". It is hidden from employee views and still visible to admin/superadmin.`,
      link: "/admin/standards-settings",
      metadata: {
        action: "soft_delete",
        resource: "standard_preset",
        resourceId: String(preset._id),
        actorId: String(req.user.id),
      },
    });
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(
      StatusCodes.OK,
      isAdminOrSuperAdmin
        ? "Standard preset archived"
        : "Standard preset hidden from employee portal and admin notified",
      {
        preset,
        message: isAdminOrSuperAdmin
          ? "Standard preset archived"
          : "Standard preset hidden from employee portal and admin notified",
        softDeleted: !isAdminOrSuperAdmin,
      },
    ),
  );
});

module.exports = { getAll, create, update, remove };
