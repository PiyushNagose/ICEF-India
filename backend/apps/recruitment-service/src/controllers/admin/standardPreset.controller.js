const { StatusCodes } = require("http-status-codes");
const StandardPreset = require("../../shared/models/StandardPreset");
const ApiError = require("../../shared/utils/ApiError");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");

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
  const filter = req.query.includeInactive === "1" ? {} : { active: true };
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
  const preset = await StandardPreset.findByIdAndUpdate(
    req.params.id,
    { active: false, updatedBy: req.user.id },
    { new: true },
  );
  if (!preset) throw new ApiError(StatusCodes.NOT_FOUND, "Preset not found");
  await saveAuditLog(req, `Archived standard preset: ${preset.name}`);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Standard preset archived", { preset }),
  );
});

module.exports = { getAll, create, update, remove };
