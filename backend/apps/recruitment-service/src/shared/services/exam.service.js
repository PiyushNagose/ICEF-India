const { StatusCodes } = require("http-status-codes");
const crypto = require("crypto");
const xlsx = require("xlsx");
const mongoose = require("mongoose");
const ExamCenter = require("../models/ExamCenter");
const ExamRoom = require("../models/ExamRoom");
const ExamSchedule = require("../models/ExamSchedule");
const CandidateAllocation = require("../models/CandidateAllocation");
const AdmitCard = require("../models/AdmitCard");
const Application = require("../models/Application");
const Job = require("../models/Job");
const Project = require("../models/Project");
const AdmitCardTemplate = require("../models/AdmitCardTemplate");
const ApiError = require("../utils/ApiError");
const { getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const { assertJobTimeline, parseDate, startOfDay } = require("../utils/timeline");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../socket/index");

const DEFAULT_PROVISIONAL_NOTE =
  "NOTE: THIS ADMIT CARD PROVISIONALLY ALLOWS YOU TO APPEAR THE OMR BASED TEST ON THE BASIS OF THE PARTICULARS PROVIDED BY YOU IN THE ONLINE APPLICATION. MERE ISSUANCE OF THIS ADMIT CARD DOES NOT NECESSARILY MEAN ACCEPTANCE OF YOUR ELIGIBILITY. YOUR DOCUMENTS REGARDING ELIGIBILITY WILL BE SCRUTINIZED SUBSEQUENTLY.";

const DEFAULT_INSTRUCTIONS = [
  "NO REQUEST FOR CHANGE IN EXAMINATION CENTRE WILL BE ENTERTAINED UNDER ANY CIRCUMSTANCES.",
  "The candidate must bring this Admit Card at the Examination Centre. No candidate will be allowed to enter without Admit Card.",
  "The candidate is also required to bring one valid identification card in original viz, Voter Identity Card, Driving License, PAN Card, Passport or Aadhaar Card etc.",
  "Candidate need to make their own travel/stay arrangement for attending this test. NO TA/DA will be provided for this TEST.",
  "No candidate will be allowed to enter the Examination Centre after the gate closing time.",
  "The candidate appearing in the entrance examination should, in his/her own interest, check their eligibility in all aspects so as to avoid disappointment at any later stage. Candidature for the examination is PROVISIONAL.",
  "Possession and use of electronic devices such as Mobile Phone, Micro Phone or any other associated accessories including Bluetooth devices, Calculator, Log Tables, Paper, Digital Diary Books etc. are strictly prohibited in the Examination Hall.",
  "Kindly refrain yourself from carrying any valuable item or bag as there will be no facility of safekeeping of your personal belongings including mobile phone/watches/Wallet etc.",
  "Friends & relatives accompanying the candidate will not be allowed in the campus.",
  "The Jharkhand Competitive Examination (Measures for Control and Prevention of Unfair Means in Recruitment) Act 2023 shall be applicable during examination process.",
  "In case of any discrepancy in the admit card, visit Commission Office after issuance of admit card.",
].map((text, index) => ({ order: index + 1, text }));

const buildTemplateConfig = (template) => ({
  templateId: template._id,
  baseLayout: template.baseLayout || "standard",
  logoUrl: template.logoUrl || "",
  watermarkUrl: template.watermarkUrl || "",
  primaryColor: template.primaryColor || "#f97316",
  instructions: template.instructions || "",
  organizationName: template.organizationName || "",
  organizationNameLocal: template.organizationNameLocal || "",
  documentTitle: template.documentTitle || "",
  sealText: template.sealText || "",
  provisionalNote: template.provisionalNote || "",
  instructionHeading: template.instructionHeading || "",
  photoBoxText: template.photoBoxText || "",
  controllerTitle: template.controllerTitle || "",
});

const TEMPLATE_DEFAULTS = {
  admit_card: {
    name: "Standard",
    baseLayout: "standard",
    primaryColor: "#f97316",
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "Admit Card",
    sealText: "JSSC",
    provisionalNote: DEFAULT_PROVISIONAL_NOTE,
    instructionHeading: "Please read the instructions carefully given below in the admit card before appearing for the examination.",
    photoBoxText: "Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature",
    controllerTitle: "Examination Controller",
    instructions: "",
  },
  attendance_sheet: {
    name: "Standard Attendance Sheet",
    baseLayout: "standard",
    primaryColor: "#f97316",
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "ATTENDANCE SHEET",
    sealText: "JSSC",
    instructions: "Candidate signature and thumb impression must be verified by the invigilator.",
  },
};

const resolveTemplateConfig = async (templateId, templateType = "admit_card") => {
  let template = null;

  if (templateId && mongoose.Types.ObjectId.isValid(String(templateId))) {
    template = await AdmitCardTemplate.findOne({ _id: templateId, templateType });
  }

  const fallback = TEMPLATE_DEFAULTS[templateType] || TEMPLATE_DEFAULTS.admit_card;
  if (!template) {
    template =
      (await AdmitCardTemplate.findOne({ name: fallback.name, templateType, isSystemDefault: true })) ||
      (await AdmitCardTemplate.findOne({ templateType, isSystemDefault: true }).sort({ createdAt: 1 })) ||
      (await AdmitCardTemplate.create({
        name: fallback.name,
        templateType,
        baseLayout: fallback.baseLayout,
        primaryColor: fallback.primaryColor,
        organizationName: fallback.organizationName,
        organizationNameLocal: fallback.organizationNameLocal,
        documentTitle: fallback.documentTitle,
        sealText: fallback.sealText,
        provisionalNote: fallback.provisionalNote,
        instructionHeading: fallback.instructionHeading,
        photoBoxText: fallback.photoBoxText,
        controllerTitle: fallback.controllerTitle,
        isSystemDefault: true,
        instructions: fallback.instructions,
      }));
  }

  return buildTemplateConfig(template);
};

const resolveAdmitCardTemplateConfig = (templateId) =>
  resolveTemplateConfig(templateId, "admit_card");

const resolveAttendanceSheetTemplateConfig = (templateId) =>
  resolveTemplateConfig(templateId, "attendance_sheet");

const TEMPLATE_TEXT_FIELDS = [
  "organizationName",
  "organizationNameLocal",
  "documentTitle",
  "sealText",
  "provisionalNote",
  "instructionHeading",
  "photoBoxText",
  "controllerTitle",
];

const toPlainTemplateConfig = (config = {}) => {
  if (!config) return {};
  if (typeof config.toObject === "function") return config.toObject();
  return { ...config };
};

const mergeTemplateDefaults = (templateType, config = {}) => {
  const fallback = TEMPLATE_DEFAULTS[templateType] || TEMPLATE_DEFAULTS.admit_card;
  const merged = {
    ...fallback,
    ...toPlainTemplateConfig(config),
    primaryColor: config.primaryColor || fallback.primaryColor || "#f97316",
    baseLayout: config.baseLayout || fallback.baseLayout || "standard",
    instructions: config.instructions || fallback.instructions || "",
  };

  TEMPLATE_TEXT_FIELDS.forEach((field) => {
    merged[field] = merged[field] || fallback[field] || "";
  });

  return merged;
};

const resolveScheduleTemplateConfig = async (schedule, templateType = "admit_card") => {
  const snapshotKey =
    templateType === "attendance_sheet"
      ? "attendanceSheetTemplateConfig"
      : "admitCardTemplateConfig";
  const snapshot = toPlainTemplateConfig(schedule?.[snapshotKey]);
  const templateId = snapshot.templateId;

  if (templateId && mongoose.Types.ObjectId.isValid(String(templateId))) {
    const template = await AdmitCardTemplate.findOne({ _id: templateId, templateType });
    if (template) {
      return mergeTemplateDefaults(templateType, buildTemplateConfig(template));
    }
  }

  return mergeTemplateDefaults(templateType, snapshot);
};

const emitExamRealtime = (event, payload = {}, options = {}) => {
  try {
    const eventPayload = { ...payload, timestamp: new Date() };
    emitToAdmins(event, eventPayload);
    if (options.public) emitBroadcast(event, eventPayload);
  } catch {
    // Socket.IO is initialized only in server runtime.
  }
};

const assertEditableSchedule = (schedule) => {
  if (schedule.status === "published") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Unpublish admit cards before changing date, timing, centers, rooms, or instructions for this schedule.",
    );
  }
};

const OPERATIONAL_SCHEDULE_FIELDS = [
  "jobId",
  "examName",
  "examCode",
  "advertisementNo",
  "shiftName",
  "examDate",
  "reportingTime",
  "gateClosingTime",
  "examStartTime",
  "examEndTime",
  "selectedCenterIds",
  "papers",
  "instructions",
  "provisionalNote",
];

const scheduleOperationalFieldsTouched = (data = {}) =>
  OPERATIONAL_SCHEDULE_FIELDS.some((field) => data[field] !== undefined);

const clearGeneratedScheduleState = async (schedule, data = {}) => {
  if (!["allocation_ready", "allocated", "locked"].includes(schedule.status)) return;
  if (!scheduleOperationalFieldsTouched(data)) return;

  await Promise.all([
    CandidateAllocation.deleteMany({ examScheduleId: schedule._id }),
    AdmitCard.deleteMany({
      examScheduleId: schedule._id,
      status: { $ne: "published" },
    }),
  ]);

  schedule.status = "draft";
  schedule.lockedAt = undefined;
  schedule.lockedBy = undefined;
  schedule.allocationSummary = {
    eligibleCandidates: 0,
    allocatedCandidates: 0,
    unallocatedCandidates: 0,
    totalCapacity: 0,
  };
};

const assertAllocatableSchedule = (schedule) => {
  if (["locked", "published", "cancelled"].includes(schedule.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Locked, published, or cancelled exam schedules cannot be allocated",
    );
  }
};

const normalizeCode = (value) => value?.trim().toUpperCase();

const buildRollNumber = (schedule, offset) => {
  const next = (schedule.rollNumberStart || 1) + offset;
  const padded = String(next).padStart(schedule.rollNumberPadding || 6, "0");
  return `${schedule.rollNumberPrefix || ""}${padded}`;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatDate = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
};

const getDocumentUrl = (application, type) =>
  application?.documents?.find((doc) => doc.type === type)?.cloudinaryUrl || "";

const normalizeDateOnly = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const timeToMinutes = (value) => {
  const text = String(value || "")
    .trim()
    .toUpperCase();
  const match = text.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2] || 0);
  const meridiem = match[3];
  if (meridiem === "PM" && hours < 12) hours += 12;
  if (meridiem === "AM" && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
};

const getScheduleWindow = (scheduleLike) => {
  const start = timeToMinutes(scheduleLike.examStartTime);
  let end = timeToMinutes(scheduleLike.examEndTime);
  if (start === null) return null;
  if (end === null) end = start + 180;
  if (end <= start) end += 24 * 60;
  return { start, end };
};

const hasOverlap = (a, b) => a && b && a.start < b.end && b.start < a.end;

const sameExamDate = (a, b) => normalizeDateOnly(a) === normalizeDateOnly(b);

const getSelectedCenterIds = (schedule, options = {}) => {
  const raw = options.centerIds?.length
    ? options.centerIds
    : schedule.selectedCenterIds || [];
  return raw.map((id) => id.toString());
};

const assertScheduleCenterConflicts = async (
  scheduleLike,
  excludeId = null,
) => {
  const selectedCenterIds = getSelectedCenterIds(scheduleLike);
  if (selectedCenterIds.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Select at least one center for this exam schedule",
    );
  }

  const window = getScheduleWindow(scheduleLike);
  if (!window) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Enter a valid exam start/end time",
    );
  }

  const filter = {
    examDate: {
      $gte: new Date(new Date(scheduleLike.examDate).setHours(0, 0, 0, 0)),
      $lte: new Date(new Date(scheduleLike.examDate).setHours(23, 59, 59, 999)),
    },
    status: { $ne: "cancelled" },
    selectedCenterIds: { $in: selectedCenterIds },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const conflicts = await ExamSchedule.find(filter).select(
    "examName examCode examDate examStartTime examEndTime selectedCenterIds",
  );

  const conflict = conflicts.find(
    (item) =>
      sameExamDate(item.examDate, scheduleLike.examDate) &&
      hasOverlap(window, getScheduleWindow(item)),
  );

  if (conflict) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Selected center already has overlapping exam schedule: ${conflict.examName} (${conflict.examCode})`,
    );
  }
};

const assertSameJobScheduleConflicts = async (
  scheduleLike,
  excludeId = null,
) => {
  const window = getScheduleWindow(scheduleLike);
  if (!window) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Enter a valid exam start/end time",
    );
  }

  const filter = {
    jobId: scheduleLike.jobId,
    examDate: {
      $gte: new Date(new Date(scheduleLike.examDate).setHours(0, 0, 0, 0)),
      $lte: new Date(new Date(scheduleLike.examDate).setHours(23, 59, 59, 999)),
    },
    status: { $ne: "cancelled" },
  };
  if (excludeId) filter._id = { $ne: excludeId };

  const schedules = await ExamSchedule.find(filter).select(
    "examName examCode examDate examStartTime examEndTime status",
  );

  const conflict = schedules.find(
    (item) =>
      sameExamDate(item.examDate, scheduleLike.examDate) &&
      hasOverlap(window, getScheduleWindow(item)),
  );

  if (conflict) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `This job already has an overlapping schedule: ${conflict.examName} (${conflict.examCode})`,
    );
  }
};

const assertCandidateAllocationConflicts = async (schedule, planned) => {
  if (!planned.length) return;
  const candidateIds = planned.map((item) => item.candidateId);
  const window = getScheduleWindow(schedule);
  const existing = await CandidateAllocation.find({
    candidateId: { $in: candidateIds },
    status: "allocated",
  }).populate(
    "examScheduleId",
    "examName examCode examDate examStartTime examEndTime status",
  );

  const conflict = existing.find((allocation) => {
    const other = allocation.examScheduleId;
    if (!other || other._id.toString() === schedule._id.toString())
      return false;
    if (other.status === "cancelled") return false;
    return (
      sameExamDate(other.examDate, schedule.examDate) &&
      hasOverlap(window, getScheduleWindow(other))
    );
  });

  if (conflict) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Candidate conflict found with overlapping schedule ${conflict.examScheduleId.examName} (${conflict.examScheduleId.examCode})`,
    );
  }
};

const barcodeBars = (value) => {
  const hash = crypto.createHash("sha256").update(String(value)).digest("hex");
  return hash
    .slice(0, 80)
    .split("")
    .map((char, index) => {
      const width = (parseInt(char, 16) % 3) + 1;
      const black = index % 2 === 0;
      return `<span style="display:inline-block;width:${width}px;height:38px;background:${black ? "#000" : "#fff"}"></span>`;
    })
    .join("");
};

const getEligibleApplicationFilter = (jobId) => ({
  jobId: jobId?._id || jobId,
  status: { $in: ["submitted", "under_review", "verified", "approved", "shortlisted"] },
  $or: [{ paymentStatus: "paid" }, { totalFee: 0 }],
});

const getAllocationInputs = async (schedule, options = {}) => {
  const centerFilter = { active: true, isSoftDeleted: { $ne: true } };
  const centerIds = getSelectedCenterIds(schedule, options);
  if (centerIds.length) centerFilter._id = { $in: centerIds };

  const [applications, centers, rooms] = await Promise.all([
    Application.find(getEligibleApplicationFilter(schedule.jobId))
      .select(
        "applicationId candidateId jobId personalDetails address submittedAt createdAt",
      )
      .sort({ submittedAt: 1, createdAt: 1, applicationId: 1 }),
    ExamCenter.find(centerFilter).sort({
      state: 1,
      district: 1,
      centerCode: 1,
    }),
    ExamRoom.find({ active: true }).sort({
      centerId: 1,
      block: 1,
      floor: 1,
      roomCode: 1,
    }),
  ]);

  const allowedCenterIds = new Set(
    centers.map((center) => center._id.toString()),
  );
  const roomsByCenter = rooms.reduce((map, room) => {
    const cid = room.centerId.toString();
    if (!allowedCenterIds.has(cid)) return map;
    if (!map.has(cid)) map.set(cid, []);
    map.get(cid).push(room);
    return map;
  }, new Map());

  const slots = [];
  for (const center of centers) {
    const centerRooms = roomsByCenter.get(center._id.toString()) || [];
    for (const room of centerRooms) {
      const usableCapacity = room.usableCapacity || room.capacity || 0;
      for (let seat = 1; seat <= usableCapacity; seat += 1) {
        slots.push({
          center,
          room,
          serialNumber: seat,
          seatNumber: `${room.seatPrefix || room.roomCode}-${String(seat).padStart(3, "0")}`,
        });
      }
    }
  }

  return { applications, centers, rooms, slots };
};

const buildAllocationPlan = async (schedule, options = {}) => {
  const { applications, centers, slots } = await getAllocationInputs(
    schedule,
    options,
  );
  const planned = [];
  const unallocated = [];

  for (let index = 0; index < applications.length; index += 1) {
    const application = applications[index];
    const slot = slots[index];
    if (!slot) {
      unallocated.push({
        applicationId: application._id,
        applicationNumber: application.applicationId,
        reason: "Insufficient active room capacity",
      });
      continue;
    }

    planned.push({
      examScheduleId: schedule._id,
      jobId: schedule.jobId,
      applicationId: application._id,
      candidateId: application.candidateId,
      centerId: slot.center._id,
      roomId: slot.room._id,
      rollNumber: buildRollNumber(schedule, index),
      seatNumber: slot.seatNumber,
      serialNumber: slot.serialNumber,
      status: "allocated",
    });
  }

  return {
    planned,
    unallocated,
    summary: {
      eligibleCandidates: applications.length,
      allocatedCandidates: planned.length,
      unallocatedCandidates: unallocated.length,
      totalCapacity: slots.length,
      activeCenters: centers.length,
    },
  };
};

const recomputeCenterCapacity = async (centerId) => {
  const result = await ExamRoom.aggregate([
    { $match: { centerId, active: true } },
    { $group: { _id: "$centerId", total: { $sum: "$usableCapacity" } } },
  ]);
  const totalCapacity = result[0]?.total || 0;
  await ExamCenter.findByIdAndUpdate(centerId, { totalCapacity });
  return totalCapacity;
};

const listCenters = async (query, user = {}) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  const isAdminOrSuperAdmin = user.role === "admin" || user.isSuperAdmin;
  if (!isAdminOrSuperAdmin) filter.isSoftDeleted = { $ne: true };
  if (query.active !== undefined) filter.active = query.active === "true";
  if (query.state) filter.state = new RegExp(query.state, "i");
  if (query.district) filter.district = new RegExp(query.district, "i");
  if (query.search) {
    filter.$or = [
      { centerCode: new RegExp(query.search, "i") },
      { name: new RegExp(query.search, "i") },
      { city: new RegExp(query.search, "i") },
      { district: new RegExp(query.search, "i") },
    ];
  }

  const [centers, total] = await Promise.all([
    ExamCenter.find(filter)
      .sort({ state: 1, district: 1, name: 1 })
      .skip(skip)
      .limit(limit),
    ExamCenter.countDocuments(filter),
  ]);

  return { centers, meta: paginationMeta(total, page, limit) };
};

const createCenter = async (data, userId) => {
  try {
    const center = await ExamCenter.create({
      ...data,
      centerCode: normalizeCode(data.centerCode),
      createdBy: userId,
      updatedBy: userId,
    });
    return center;
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, "This center code already exists. Use a unique center code.");
    }
    throw error;
  }
};

const updateCenter = async (id, data, userId) => {
  if (data.centerCode) data.centerCode = normalizeCode(data.centerCode);
  try {
    const center = await ExamCenter.findByIdAndUpdate(
      id,
      { ...data, updatedBy: userId },
      { new: true, runValidators: true },
    );
    if (!center)
      throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
    return center;
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, "This center code already exists. Use a unique center code.");
    }
    throw error;
  }
};

const deleteCenter = async (id, user = {}) => {
  const userId = user.id || user._id || user;
  const center = await ExamCenter.findById(id);
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");

  const isAdminOrSuperAdmin = user.role === "admin" || user.isSuperAdmin;

  if (!isAdminOrSuperAdmin) {
    center.isSoftDeleted = true;
    center.deletedBy = userId;
    center.deletedAt = new Date();
    center.active = false;
    center.updatedBy = userId;
    await center.save();
    await ExamRoom.updateMany({ centerId: id }, { active: false, updatedBy: userId });
    await recomputeCenterCapacity(center._id);
    return {
      center,
      deleted: false,
      softDeleted: true,
      deactivated: true,
      message: "Exam center hidden from employee portal and admin notified.",
    };
  }

  const [scheduleCount, allocationCount] = await Promise.all([
    ExamSchedule.countDocuments({ selectedCenterIds: id, status: { $ne: "cancelled" } }),
    CandidateAllocation.countDocuments({ centerId: id }),
  ]);

  if (scheduleCount > 0 || allocationCount > 0) {
    center.active = false;
    center.updatedBy = userId;
    await center.save();
    await ExamRoom.updateMany({ centerId: id }, { active: false, updatedBy: userId });
    await recomputeCenterCapacity(center._id);
    return {
      center,
      deleted: false,
      deactivated: true,
      message:
        "Center is used by exam schedules or allocations, so it has been deactivated instead of deleted.",
    };
  }

  await ExamRoom.deleteMany({ centerId: id });
  await ExamCenter.deleteOne({ _id: id });

  return {
    center,
    deleted: true,
    deactivated: false,
    message: "Exam center deleted successfully.",
  };
};

const getCenter = async (id, user = {}) => {
  const center = await ExamCenter.findById(id);
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  const isAdminOrSuperAdmin = user.role === "admin" || user.isSuperAdmin;
  if (center.isSoftDeleted && !isAdminOrSuperAdmin)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  const rooms = await ExamRoom.find({ centerId: id }).sort({
    block: 1,
    floor: 1,
    roomCode: 1,
  });
  return { center, rooms };
};

const listRooms = async (centerId, user = {}) => {
  const center = await ExamCenter.findById(centerId);
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  const isAdminOrSuperAdmin = user.role === "admin" || user.isSuperAdmin;
  if (center.isSoftDeleted && !isAdminOrSuperAdmin)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  const rooms = await ExamRoom.find({ centerId }).sort({
    block: 1,
    floor: 1,
    roomCode: 1,
  });
  return { center, rooms };
};

const createRoom = async (centerId, data, userId) => {
  const center = await ExamCenter.findById(centerId);
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  if (data.usableCapacity && data.usableCapacity > data.capacity) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Usable capacity cannot exceed room capacity",
    );
  }

  try {
    const room = await ExamRoom.create({
      ...data,
      centerId,
      roomCode: normalizeCode(data.roomCode),
      createdBy: userId,
      updatedBy: userId,
    });
    await recomputeCenterCapacity(center._id);
    return room;
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, "This room code already exists for the selected center.");
    }
    throw error;
  }
};

const updateRoom = async (roomId, data, userId) => {
  const room = await ExamRoom.findById(roomId);
  if (!room) throw new ApiError(StatusCodes.NOT_FOUND, "Exam room not found");
  const nextCapacity = data.capacity ?? room.capacity;
  const nextUsableCapacity = data.usableCapacity ?? room.usableCapacity ?? nextCapacity;
  if (Number(nextUsableCapacity) > Number(nextCapacity)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Usable capacity cannot exceed room capacity",
    );
  }
  if (data.roomCode) data.roomCode = normalizeCode(data.roomCode);
  try {
    Object.assign(room, data, { updatedBy: userId });
    await room.save();
    await recomputeCenterCapacity(room.centerId);
    return room;
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(StatusCodes.CONFLICT, "This room code already exists for the selected center.");
    }
    throw error;
  }
};

const listSchedules = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.jobId) filter.jobId = query.jobId;
  if (query.projectId) filter.projectId = query.projectId;
  if (query.status) filter.status = query.status;
  if (query.search) {
    filter.$or = [
      { examName: new RegExp(query.search, "i") },
      { examCode: new RegExp(query.search, "i") },
      { advertisementNo: new RegExp(query.search, "i") },
    ];
  }

  const [schedules, total] = await Promise.all([
    ExamSchedule.find(filter)
      .populate("projectId", "name department state")
      .populate("jobId", "title postCode department status")
      .sort({ examDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ExamSchedule.countDocuments(filter),
  ]);

  return { schedules, meta: paginationMeta(total, page, limit) };
};

const createSchedule = async (data, userId) => {
  const job = await Job.findById(data.jobId);
  if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");

  let project = null;
  if (data.projectId) {
    project = await Project.findById(data.projectId);
    if (!project)
      throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  } else {
    project = await Project.findById(job.projectId);
  }
  assertJobTimeline({ ...job.toObject(), examDate: data.examDate }, project);
  await assertSameJobScheduleConflicts(data);
  await assertScheduleCenterConflicts(data);

  const [admitCardTemplateConfig, attendanceSheetTemplateConfig] = await Promise.all([
    resolveAdmitCardTemplateConfig(data.admitCardTemplate),
    resolveAttendanceSheetTemplateConfig(data.attendanceSheetTemplate),
  ]);

  const schedule = await ExamSchedule.create({
    ...data,
    projectId: data.projectId || job.projectId,
    examCode: normalizeCode(data.examCode),
    examDate: new Date(data.examDate),
    provisionalNote: data.provisionalNote,
    instructions: data.instructions,
    selectedCenterIds: data.selectedCenterIds,
    admitCardTemplateConfig,
    attendanceSheetTemplateConfig,
    createdBy: userId,
    updatedBy: userId,
  });

  return schedule.populate([
    { path: "projectId", select: "name department state" },
    { path: "jobId", select: "title postCode department status" },
  ]);
};

const getSchedule = async (id) => {
  const schedule = await ExamSchedule.findById(id)
    .populate("projectId", "name department state")
    .populate("jobId", "title postCode department status");
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  return schedule;
};

const updateSchedule = async (id, data, userId) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  assertEditableSchedule(schedule);

  let job = await Job.findById(data.jobId || schedule.jobId);
  if (data.jobId) {
    if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
    if (!data.projectId) data.projectId = job.projectId;
  }
  if (!job) throw new ApiError(StatusCodes.NOT_FOUND, "Job not found");
  let project = null;
  if (data.projectId) {
    project = await Project.findById(data.projectId);
    if (!project)
      throw new ApiError(StatusCodes.NOT_FOUND, "Project not found");
  } else {
    project = await Project.findById(schedule.projectId || job.projectId);
  }
  assertJobTimeline(
    { ...job.toObject(), examDate: data.examDate || schedule.examDate },
    project,
  );
  await assertSameJobScheduleConflicts(
    { ...schedule.toObject(), ...data },
    schedule._id,
  );
  await assertScheduleCenterConflicts(
    { ...schedule.toObject(), ...data },
    schedule._id,
  );
  if (data.examCode) data.examCode = normalizeCode(data.examCode);
  if (data.examDate) data.examDate = new Date(data.examDate);

  if (Object.prototype.hasOwnProperty.call(data, "admitCardTemplate")) {
    data.admitCardTemplateConfig = await resolveAdmitCardTemplateConfig(data.admitCardTemplate);
  }
  if (Object.prototype.hasOwnProperty.call(data, "attendanceSheetTemplate")) {
    data.attendanceSheetTemplateConfig = await resolveAttendanceSheetTemplateConfig(data.attendanceSheetTemplate);
  }

  await clearGeneratedScheduleState(schedule, data);
  Object.assign(schedule, data, { updatedBy: userId });
  await schedule.save();
  return getSchedule(schedule._id);
};

const getScheduleStats = async (id) => {
  const schedule = await getSchedule(id);
  const selectedCenterIds = getSelectedCenterIds(schedule);
  const [
    eligibleCandidates,
    allocatedCandidates,
    admitCards,
    totalCapacityResult,
    centerCount,
    pendingCorrections,
  ] = await Promise.all([
    Application.countDocuments({
      jobId: schedule.jobId._id,
      status: { $in: ["submitted", "under_review", "verified", "approved", "shortlisted"] },
      $or: [{ paymentStatus: "paid" }, { totalFee: 0 }],
    }),
    CandidateAllocation.countDocuments({
      examScheduleId: schedule._id,
      status: "allocated",
    }),
    AdmitCard.aggregate([
      { $match: { examScheduleId: schedule._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    ExamRoom.aggregate([
      {
        $match: {
          active: true,
          ...(selectedCenterIds.length && {
            centerId: {
              $in: selectedCenterIds.map(
                (centerId) => new mongoose.Types.ObjectId(centerId),
              ),
            },
          }),
        },
      },
      { $group: { _id: null, total: { $sum: "$usableCapacity" } } },
    ]),
    ExamCenter.countDocuments({
      active: true,
      ...(selectedCenterIds.length && { _id: { $in: selectedCenterIds } }),
    }),
    Application.countDocuments({
      jobId: schedule.jobId._id,
      $or: [
        { status: "clarification_required" },
        { "correction.status": { $in: ["requested", "in_progress", "submitted"] } },
        { "corrections.status": { $in: ["pending", "more_info_needed"] } },
      ],
    }),
  ]);

  const totalCapacity = totalCapacityResult[0]?.total || 0;
  return {
    schedule,
    stats: {
      eligibleCandidates,
      allocatedCandidates,
      unallocatedCandidates: Math.max(
        eligibleCandidates - allocatedCandidates,
        0,
      ),
      totalCapacity,
      activeCenters: centerCount,
      pendingCorrections,
      admitCards,
    },
  };
};

const previewAllocation = async (id, options = {}) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  assertAllocatableSchedule(schedule);
  const plan = await buildAllocationPlan(schedule, options);
  return {
    scheduleId: schedule._id,
    summary: plan.summary,
    sample: plan.planned.slice(0, 10),
    unallocatedSample: plan.unallocated.slice(0, 25),
  };
};

const allocateCandidates = async (id, options = {}, userId) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  assertAllocatableSchedule(schedule);

  const [existingAllocations, existingAdmitCards] = await Promise.all([
    CandidateAllocation.countDocuments({
      examScheduleId: schedule._id,
      status: "allocated",
    }),
    AdmitCard.countDocuments({ examScheduleId: schedule._id }),
  ]);
  if ((existingAllocations > 0 || existingAdmitCards > 0) && !options.forceReallocate) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      "This exam already has committed seat allocations or admit cards. Bulk reallocation is disabled to protect issued seats.",
      { existingAllocations, existingAdmitCards },
    );
  }

  const plan = await buildAllocationPlan(schedule, options);
  await assertCandidateAllocationConflicts(schedule, plan.planned);
  if (plan.summary.eligibleCandidates === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No eligible candidates found for allocation",
    );
  }
  if (plan.unallocated.length > 0 && !options.allowPartial) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Insufficient capacity for all eligible candidates. Eligible: ${plan.summary.eligibleCandidates}, active room capacity: ${plan.summary.totalCapacity}, unallocated: ${plan.summary.unallocatedCandidates}. Add active rooms under centers or pass allowPartial=true.`,
      plan.summary,
    );
  }

  const allocationBatchId = `ALLOC-${Date.now()}`;
  const docs = plan.planned.map((item) => ({
    ...item,
    allocationBatchId,
    allocatedBy: userId,
    allocatedAt: new Date(),
  }));

  await CandidateAllocation.deleteMany({ examScheduleId: schedule._id });
  if (docs.length)
    await CandidateAllocation.insertMany(docs, { ordered: true });

  schedule.status = "allocated";
  schedule.allocationSummary = {
    ...plan.summary,
    lastAllocatedAt: new Date(),
  };
  schedule.updatedBy = userId;
  await schedule.save();

  return {
    schedule,
    allocationBatchId,
    summary: plan.summary,
    unallocatedSample: plan.unallocated.slice(0, 100),
  };
};

const lockAllocation = async (id, userId) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  if (schedule.status === "published") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Published schedules are already locked",
    );
  }
  if (schedule.status === "locked") return schedule;

  const allocatedCandidates = await CandidateAllocation.countDocuments({
    examScheduleId: schedule._id,
    status: "allocated",
  });
  if (allocatedCandidates === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Run allocation before locking this schedule",
    );
  }

  schedule.status = "locked";
  schedule.lockedAt = new Date();
  schedule.lockedBy = userId;
  schedule.allocationSummary = {
    ...(schedule.allocationSummary?.toObject?.() ||
      schedule.allocationSummary ||
      {}),
    allocatedCandidates,
  };
  await schedule.save();
  return schedule;
};

const listAllocations = async (id, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = { examScheduleId: id };
  if (query.centerId) filter.centerId = query.centerId;
  if (query.roomId) filter.roomId = query.roomId;
  if (query.search) filter.rollNumber = new RegExp(query.search, "i");

  const [allocations, total] = await Promise.all([
    CandidateAllocation.find(filter)
      .populate("applicationId", "applicationId personalDetails")
      .populate("centerId", "centerCode name district state")
      .populate("roomId", "roomCode roomName block floor")
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit),
    CandidateAllocation.countDocuments(filter),
  ]);

  return { allocations, meta: paginationMeta(total, page, limit) };
};

const getAdmitCardPopulate = () => [
  {
    path: "examScheduleId",
    populate: [
      {
        path: "jobId",
        select: "title postCode department admitCardReleaseDate",
      },
      { path: "projectId", select: "name department state" },
    ],
  },
  {
    path: "allocationId",
    populate: [{ path: "centerId" }, { path: "roomId" }],
  },
  {
    path: "applicationId",
    populate: {
      path: "candidateId",
      select: "fullName email registeredMobile",
    },
  },
];

const formatOfficialDate = (value) => {
  const date = parseDate(value);
  if (!date) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isAdmitCardReleased = (admitCard) => {
  if (admitCard?.examScheduleId?.status !== "published") return false;
  const releaseDate = admitCard.examScheduleId?.jobId?.admitCardReleaseDate;
  const releaseDay = startOfDay(releaseDate);
  if (!releaseDay) return true;
  return startOfDay(new Date()) >= releaseDay;
};

const normalizeMobile = (value) =>
  String(value || "")
    .replace(/\D/g, "")
    .replace(/^91(?=\d{10}$)/, "");

const getApplicationMobile = (application) =>
  normalizeMobile(
    application?.candidateId?.registeredMobile ||
      application?.contactMobile ||
      application?.personalDetails?.registeredMobile,
  );

const hasPendingCorrection = (application) => {
  const correctionStatus = application.correction?.status || "none";
  const hasActivePublicRequest = (application.corrections || []).some((item) =>
    ["pending", "more_info_needed"].includes(item.status),
  );

  if (["none", "resolved", "approved", "rejected"].includes(correctionStatus)) {
    return hasActivePublicRequest;
  }

  if (application.status === "clarification_required") return true;
  if (["requested", "in_progress"].includes(correctionStatus)) return true;
  if (correctionStatus !== "submitted") return false;

  const issues = application.correction?.issues || [];
  if (!issues.length) return true;
  return (
    issues.some((issue) => issue.status !== "resolved") ||
    hasActivePublicRequest
  );
};

const assertApplicationReadyForAdmitCard = (application) => {
  if (!application) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Application not found");
  }
  if (application.status === "draft") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Application is not submitted yet",
    );
  }
  if (application.status === "rejected") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Application is not eligible for admit card",
    );
  }
  if (hasPendingCorrection(application)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Correction is pending. Admit card will be available after correction review",
    );
  }
  if (application.paymentStatus !== "paid" && Number(application.totalFee || 0) > 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Payment is pending for this application",
    );
  }
};

const findPublishedScheduleForApplication = async (application) => {
  const schedule = await ExamSchedule.findOne({
    jobId: application.jobId,
    status: "published",
  })
    .sort({ examDate: 1, createdAt: 1 })
    .populate("jobId", "title postCode department admitCardReleaseDate")
    .populate("projectId", "name department state");

  if (!schedule) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
  }

  const releaseDay = startOfDay(schedule.jobId?.admitCardReleaseDate);
  if (releaseDay && startOfDay(new Date()) < releaseDay) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Admit card download opens on ${formatOfficialDate(releaseDay)}`,
    );
  }

  return schedule;
};

const getSeatCapacitySnapshot = async (schedule) => {
  const selectedCenterIds = getSelectedCenterIds(schedule);
  if (!selectedCenterIds.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No centers selected for this exam schedule",
    );
  }

  const [centers, rooms, counts] = await Promise.all([
    ExamCenter.find({
      _id: { $in: selectedCenterIds },
      active: true,
      isSoftDeleted: { $ne: true },
    }).sort({
      centerCode: 1,
    }),
    ExamRoom.find({
      centerId: { $in: selectedCenterIds },
      active: true,
    }).sort({ centerId: 1, roomCode: 1 }),
    CandidateAllocation.aggregate([
      {
        $match: {
          examScheduleId: schedule._id,
          status: "allocated",
        },
      },
      {
        $group: {
          _id: { centerId: "$centerId", roomId: "$roomId" },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const countByRoom = new Map(
    counts.map((item) => [String(item._id.roomId), item.count]),
  );
  const roomsByCenter = rooms.reduce((map, room) => {
    const centerId = room.centerId.toString();
    if (!map.has(centerId)) map.set(centerId, []);
    const capacity = Number(room.usableCapacity || room.capacity || 0);
    const allocated = countByRoom.get(room._id.toString()) || 0;
    map.get(centerId).push({
      room,
      capacity,
      allocated,
      available: Math.max(capacity - allocated, 0),
    });
    return map;
  }, new Map());

  return centers
    .map((center) => {
      const centerRooms = roomsByCenter.get(center._id.toString()) || [];
      const totalCapacity = centerRooms.reduce((sum, item) => sum + item.capacity, 0);
      const allocated = centerRooms.reduce((sum, item) => sum + item.allocated, 0);
      const available = Math.max(totalCapacity - allocated, 0);
      return {
        center,
        rooms: centerRooms
          .filter((item) => item.available > 0)
          .sort(
            (a, b) =>
              b.available - a.available ||
              String(a.room.roomCode || "").localeCompare(String(b.room.roomCode || "")),
          ),
        totalCapacity,
        allocated,
        available,
      };
    })
    .filter((item) => item.available > 0)
    .sort(
      (a, b) =>
        b.available - a.available ||
        String(a.center.centerCode || "").localeCompare(
          String(b.center.centerCode || ""),
        ),
    );
};

const findFirstAvailableSerial = async (scheduleId, room, capacity) => {
  const used = await CandidateAllocation.find({
    examScheduleId: scheduleId,
    roomId: room._id,
    status: "allocated",
  }).distinct("serialNumber");
  const usedSet = new Set(used.map(Number));
  for (let serial = 1; serial <= capacity; serial += 1) {
    if (!usedSet.has(serial)) return serial;
  }
  return null;
};

const refreshAllocationSummary = async (schedule) => {
  const [eligibleCandidates, allocatedCandidates, capacitySnapshot, admitCards] =
    await Promise.all([
      Application.countDocuments(getEligibleApplicationFilter(schedule.jobId)),
      CandidateAllocation.countDocuments({
        examScheduleId: schedule._id,
        status: "allocated",
      }),
      getAllocationInputs(schedule).catch(() => ({
        slots: [],
      })),
      AdmitCard.countDocuments({ examScheduleId: schedule._id }),
    ]);

  const totalCapacity = capacitySnapshot.slots?.length || 0;
  schedule.allocationSummary = {
    eligibleCandidates,
    allocatedCandidates,
    unallocatedCandidates: Math.max(eligibleCandidates - allocatedCandidates, 0),
    totalCapacity,
    admitCards,
    lastAllocatedAt: new Date(),
  };
  await schedule.save();
};

const assertCandidateScheduleConflict = async (schedule, candidateId) => {
  const existing = await CandidateAllocation.find({
    candidateId,
    status: "allocated",
  }).populate(
    "examScheduleId",
    "examName examCode examDate examStartTime examEndTime status",
  );
  const window = getScheduleWindow(schedule);
  const conflict = existing.find((allocation) => {
    const other = allocation.examScheduleId;
    if (!other || other._id.toString() === schedule._id.toString()) return false;
    if (other.status === "cancelled") return false;
    return (
      sameExamDate(other.examDate, schedule.examDate) &&
      hasOverlap(window, getScheduleWindow(other))
    );
  });

  if (conflict) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `Candidate already has an admit card for overlapping exam ${conflict.examScheduleId.examName}`,
    );
  }
};

const allocateSeatOnDemand = async (schedule, application) => {
  const existing = await CandidateAllocation.findOne({
    examScheduleId: schedule._id,
    applicationId: application._id,
    status: "allocated",
  });
  if (existing) return existing;

  await assertCandidateScheduleConflict(schedule, application.candidateId);

  const allocationBatchId = `ONDEMAND-${Date.now()}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const centers = await getSeatCapacitySnapshot(schedule);
    if (!centers.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "No seats available. Please contact the recruitment authority",
      );
    }

    for (const centerItem of centers) {
      for (const roomItem of centerItem.rooms) {
        const serialNumber = await findFirstAvailableSerial(
          schedule._id,
          roomItem.room,
          roomItem.capacity,
        );
        if (!serialNumber) continue;

        const allocationCount = await CandidateAllocation.countDocuments({
          examScheduleId: schedule._id,
        });
        const rollNumber = buildRollNumber(schedule, allocationCount + attempt);
        const seatNumber = `${roomItem.room.seatPrefix || roomItem.room.roomCode || "SEAT"}-${String(serialNumber).padStart(3, "0")}`;

        try {
          return await CandidateAllocation.create({
            examScheduleId: schedule._id,
            jobId: schedule.jobId?._id || schedule.jobId,
            applicationId: application._id,
            candidateId: application.candidateId?._id || application.candidateId,
            centerId: centerItem.center._id,
            roomId: roomItem.room._id,
            rollNumber,
            seatNumber,
            serialNumber,
            allocationBatchId,
            allocationReason: "On-demand public admit card request",
            allocatedAt: new Date(),
          });
        } catch (error) {
          if (error?.code === 11000) continue;
          throw error;
        }
      }
    }
  }

  throw new ApiError(
    StatusCodes.CONFLICT,
    "Seat allocation is busy. Please retry in a few seconds",
  );
};

const createOrPublishAdmitCard = async (schedule, allocation, application) => {
  const admitCardNumber = `AC-${schedule.examCode}-${allocation.rollNumber}`;
  const barcodeValue = `${schedule.examCode}|${allocation.rollNumber}|${allocation.applicationId}`;
  const checksum = crypto
    .createHash("sha256")
    .update(barcodeValue)
    .digest("hex");

  let admitCard = await AdmitCard.findOne({
    examScheduleId: schedule._id,
    applicationId: application._id,
  });

  if (admitCard) {
    if (admitCard.status !== "published") {
      admitCard.status = "published";
      admitCard.publishedAt = new Date();
    }
    admitCard.allocationId = allocation._id;
    admitCard.candidateId = application.candidateId?._id || application.candidateId;
    admitCard.admitCardNumber = admitCardNumber;
    admitCard.rollNumber = allocation.rollNumber;
    admitCard.barcodeValue = barcodeValue;
    admitCard.qrPayload = barcodeValue;
    admitCard.pdfChecksum = checksum;
    await admitCard.save();
  } else {
    admitCard = await AdmitCard.create({
      examScheduleId: schedule._id,
      allocationId: allocation._id,
      applicationId: application._id,
      candidateId: application.candidateId?._id || application.candidateId,
      admitCardNumber,
      rollNumber: allocation.rollNumber,
      barcodeValue,
      qrPayload: barcodeValue,
      pdfChecksum: checksum,
      status: "published",
      generatedAt: new Date(),
      publishedAt: new Date(),
    });
  }

  const center = await ExamCenter.findById(allocation.centerId).lean();

  await Application.updateOne(
    { _id: application._id },
    {
      $set: {
        "examAllocation.examScheduleId": schedule._id,
        "examAllocation.allocatedDate": schedule.examDate,
        "examAllocation.allocatedShift": schedule.shiftName,
        "examAllocation.admitCardGenerated": true,
        "examAllocation.admitCardGeneratedAt": new Date(),
        "examAllocation.rollNumber": allocation.rollNumber,
        "examAllocation.seatNumber": allocation.seatNumber,
        "examAllocation.examCenter": center
          ? {
              centerId: center._id,
              centerCode: center.centerCode,
              name: center.name,
              addressLine1: center.addressLine1,
              addressLine2: center.addressLine2,
              city: center.city,
              district: center.district,
              state: center.state,
              pincode: center.pincode,
            }
          : undefined,
      },
    },
  );

  return AdmitCard.findById(admitCard._id).populate(getAdmitCardPopulate());
};

const serializePublicAdmitCard = (admitCard, application, fromCache = false) => ({
  admitCardId: admitCard._id,
  admitCardNumber: admitCard.admitCardNumber,
  rollNumber: admitCard.rollNumber,
  applicationId: application.applicationId,
  registrationNumber: application.registrationNumber,
  candidateName: application.personalDetails?.fullName,
  examName: admitCard.examScheduleId?.examName,
  examDate: admitCard.examScheduleId?.examDate,
  reportingTime: admitCard.examScheduleId?.reportingTime,
  gateClosingTime: admitCard.examScheduleId?.gateClosingTime,
  examTime: `${admitCard.examScheduleId?.examStartTime || ""}${admitCard.examScheduleId?.examEndTime ? ` to ${admitCard.examScheduleId.examEndTime}` : ""}`,
  centerName: admitCard.allocationId?.centerId?.name,
  centerDistrict: admitCard.allocationId?.centerId?.district,
  seatNumber: admitCard.allocationId?.seatNumber,
  verificationToken: admitCard.barcodeValue,
  alreadyGenerated: fromCache,
  message: fromCache
    ? "Already generated, downloading existing admit card"
    : "Admit card generated and seat allocated successfully",
});

const generateAdmitCardOnDemand = async (application) => {
  assertApplicationReadyForAdmitCard(application);

  const existing = await AdmitCard.findOne({
    applicationId: application._id,
    status: "published",
  })
    .populate(getAdmitCardPopulate())
    .sort({ publishedAt: -1, createdAt: -1 });
  if (existing) {
    if (!isAdmitCardReleased(existing)) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
    }
    return serializePublicAdmitCard(existing, application, true);
  }

  const schedule = await findPublishedScheduleForApplication(application);
  const allocation = await allocateSeatOnDemand(schedule, application);
  const admitCard = await createOrPublishAdmitCard(
    schedule,
    allocation,
    application,
  );
  await refreshAllocationSummary(schedule).catch(() => {});
  emitExamRealtime(SOCKET_EVENTS.EXAM_ADMIT_CARD_GENERATED, {
    action: "on_demand_generated",
    applicationId: application._id,
    publicApplicationId: application.applicationId,
    registrationNumber: application.registrationNumber,
    scheduleId: schedule._id,
    jobId: schedule.jobId?._id || schedule.jobId,
    allocationId: allocation._id,
    admitCardId: admitCard._id,
    rollNumber: allocation.rollNumber,
  }, { public: true });
  return serializePublicAdmitCard(admitCard, application, false);
};

const generateAdmitCards = async (id, userId) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  if (schedule.status !== "locked") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Lock allocation before generating admit cards",
    );
  }

  const allocations = await CandidateAllocation.find({
    examScheduleId: schedule._id,
    status: "allocated",
  }).sort({ rollNumber: 1 });

  if (allocations.length === 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "No allocations found for admit card generation",
    );
  }

  let created = 0;
  let updated = 0;
  for (const allocation of allocations) {
    const admitCardNumber = `AC-${schedule.examCode}-${allocation.rollNumber}`;
    const barcodeValue = `${schedule.examCode}|${allocation.rollNumber}|${allocation.applicationId}`;
    const checksum = crypto
      .createHash("sha256")
      .update(barcodeValue)
      .digest("hex");
    const existing = await AdmitCard.findOne({
      examScheduleId: schedule._id,
      applicationId: allocation.applicationId,
    });

    if (existing) {
      if (existing.status !== "published") {
        existing.allocationId = allocation._id;
        existing.candidateId = allocation.candidateId;
        existing.admitCardNumber = admitCardNumber;
        existing.rollNumber = allocation.rollNumber;
        existing.barcodeValue = barcodeValue;
        existing.qrPayload = barcodeValue;
        existing.pdfChecksum = checksum;
        existing.status = "generated";
        existing.version += 1;
        existing.generatedAt = new Date();
        existing.generatedBy = userId;
        await existing.save();
        updated += 1;
      }
    } else {
      await AdmitCard.create({
        examScheduleId: schedule._id,
        allocationId: allocation._id,
        applicationId: allocation.applicationId,
        candidateId: allocation.candidateId,
        admitCardNumber,
        rollNumber: allocation.rollNumber,
        barcodeValue,
        qrPayload: barcodeValue,
        pdfChecksum: checksum,
        status: "generated",
        generatedAt: new Date(),
        generatedBy: userId,
      });
      created += 1;
    }
  }

  return {
    schedule,
    summary: {
      allocations: allocations.length,
      created,
      updated,
      skippedPublished: allocations.length - created - updated,
    },
  };
};

const publishAdmitCards = async (id, userId) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  if (schedule.status === "cancelled") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Cancelled schedules cannot publish admit cards",
    );
  }
  if (schedule.status === "published") {
    await refreshAllocationSummary(schedule).catch(() => {});
    return { schedule, publishedCount: 0, alreadyPublished: true };
  }
  const hasCenters = getSelectedCenterIds(schedule).length > 0;
  if (!hasCenters) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Select centers and rooms before publishing the admit-card window",
    );
  }
  const { slots } = await getAllocationInputs(schedule);
  if (!slots.length) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Selected centers do not have active usable room capacity",
    );
  }

  const result = await AdmitCard.updateMany(
    { examScheduleId: schedule._id, status: "generated" },
    { status: "published", publishedAt: new Date(), publishedBy: userId },
  );

  schedule.status = "published";
  schedule.publishedAt = schedule.publishedAt || new Date();
  schedule.publishedBy = schedule.publishedBy || userId;
  schedule.updatedBy = userId;
  await schedule.save();

  return { schedule, publishedCount: result.modifiedCount || 0 };
};

const unpublishAdmitCards = async (
  id,
  userId,
  reason = "Unpublished by admin",
) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  if (schedule.status !== "published") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only published schedules can be unpublished",
    );
  }

  const result = await AdmitCard.updateMany(
    { examScheduleId: schedule._id, status: "published" },
    {
      status: "generated",
      revokedAt: new Date(),
      revokedBy: userId,
      revokeReason: reason,
    },
  );

  schedule.status = "locked";
  schedule.publishedAt = undefined;
  schedule.publishedBy = undefined;
  schedule.updatedBy = userId;
  await schedule.save();

  return { schedule, unpublishedCount: result.modifiedCount || 0 };
};

const regenerateAdmitCards = async (id, userId, options = {}) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");
  if (!["locked", "published"].includes(schedule.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only locked or published schedules can regenerate admit cards",
    );
  }

  if (schedule.status === "published") {
    await unpublishAdmitCards(
      id,
      userId,
      options.reason || "Regenerated by admin",
    );
  }

  return generateAdmitCards(id, userId);
};

const listAdmitCards = async (id, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = { examScheduleId: id };
  if (query.status) filter.status = query.status;
  if (query.centerId) {
    const allocationIds = await CandidateAllocation.find({
      examScheduleId: id,
      centerId: query.centerId,
    }).distinct("_id");
    filter.allocationId = { $in: allocationIds };
  }
  if (query.search) {
    filter.$or = [
      { rollNumber: new RegExp(query.search, "i") },
      { admitCardNumber: new RegExp(query.search, "i") },
    ];
  }

  const [admitCards, total] = await Promise.all([
    AdmitCard.find(filter)
      .populate("applicationId", "applicationId personalDetails")
      .populate({
        path: "allocationId",
        populate: {
          path: "centerId",
          select: "centerCode name district state",
        },
      })
      .sort({ rollNumber: 1 })
      .skip(skip)
      .limit(limit),
    AdmitCard.countDocuments(filter),
  ]);

  return { admitCards, meta: paginationMeta(total, page, limit) };
};

const lookupPublicAdmitCard = async ({
  applicationId,
  dateOfBirth,
  registrationNumber,
  mobile,
}) => {
  // Support both old lookup (applicationId + DOB) and new no-login flow
  // (registrationNumber + mobile OTP). The new flow generates the admit card
  // on-demand and persists the allocation/card for all future downloads.
  let application;

  if (registrationNumber) {
    application = await Application.findOne({
      registrationNumber: String(registrationNumber || "")
        .trim()
        .toUpperCase(),
    })
      .select(
        "applicationId registrationNumber personalDetails candidateId contactMobile jobId status paymentStatus totalFee correction corrections",
      )
      .populate("candidateId", "email registeredMobile");

    if (!application)
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No application found for this registration number",
      );

    const storedMobile = getApplicationMobile(application);
    if (mobile && storedMobile && storedMobile !== normalizeMobile(mobile)) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Mobile number does not match our records",
      );
    }

    return generateAdmitCardOnDemand(application);
  } else {
    application = await Application.findOne({
      applicationId: String(applicationId || "").trim(),
    })
      .select("applicationId personalDetails candidateId")
      .populate("candidateId", "email registeredMobile");
    if (!application)
      throw new ApiError(StatusCodes.NOT_FOUND, "No released admit card found");
    if (
      normalizeDateOnly(application.personalDetails?.dateOfBirth) !==
      normalizeDateOnly(dateOfBirth)
    ) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No released admit card found");
    }
  }

  const admitCard = await AdmitCard.findOne({
    applicationId: application._id,
    status: "published",
  })
    .populate(getAdmitCardPopulate())
    .sort({ publishedAt: -1, createdAt: -1 });

  if (!admitCard)
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
  if (!isAdmitCardReleased(admitCard)) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
  }

  return {
    admitCardId: admitCard._id,
    admitCardNumber: admitCard.admitCardNumber,
    rollNumber: admitCard.rollNumber,
    applicationId: application.applicationId,
    candidateName: application.personalDetails?.fullName,
    examName: admitCard.examScheduleId?.examName,
    examDate: admitCard.examScheduleId?.examDate,
    reportingTime: admitCard.examScheduleId?.reportingTime,
    gateClosingTime: admitCard.examScheduleId?.gateClosingTime,
    examTime: `${admitCard.examScheduleId?.examStartTime || ""}${admitCard.examScheduleId?.examEndTime ? ` to ${admitCard.examScheduleId.examEndTime}` : ""}`,
    centerName: admitCard.allocationId?.centerId?.name,
    centerDistrict: admitCard.allocationId?.centerId?.district,
    verificationToken: admitCard.barcodeValue,
  };
};

const verifyAdmitCard = async (token) => {
  const normalizedToken = decodeURIComponent(String(token || "")).trim();
  if (!normalizedToken)
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Verification token is required",
    );

  const admitCard = await AdmitCard.findOne({
    $or: [
      { barcodeValue: normalizedToken },
      { qrPayload: normalizedToken },
      { admitCardNumber: normalizedToken },
    ],
  }).populate(getAdmitCardPopulate());

  if (!admitCard || admitCard.status !== "published") {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Admit card could not be verified",
    );
  }
  if (!isAdmitCardReleased(admitCard)) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "Admit card could not be verified",
    );
  }

  return {
    valid: true,
    admitCardNumber: admitCard.admitCardNumber,
    rollNumber: admitCard.rollNumber,
    applicationId: admitCard.applicationId?.applicationId,
    candidateName: admitCard.applicationId?.personalDetails?.fullName,
    examName: admitCard.examScheduleId?.examName,
    examDate: admitCard.examScheduleId?.examDate,
    centerName: admitCard.allocationId?.centerId?.name,
    centerDistrict: admitCard.allocationId?.centerId?.district,
    status: admitCard.status,
    publishedAt: admitCard.publishedAt,
    checksum: admitCard.pdfChecksum,
  };
};

const getCandidateAdmitCards = async (candidateId) => {
  const admitCards = await AdmitCard.find({ candidateId, status: "published" })
    .populate(getAdmitCardPopulate())
    .sort({ publishedAt: -1, createdAt: -1 });
  return admitCards.filter(isAdmitCardReleased);
};

const getAdmitCardForHtml = async (id, options = {}) => {
  const filter = { _id: id };
  if (options.candidateId) {
    filter.candidateId = options.candidateId;
    filter.status = "published";
  }

  const admitCard = await AdmitCard.findOne(filter).populate(
    getAdmitCardPopulate(),
  );
  if (!admitCard)
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card not found");
  if (options.publicAccess && admitCard.status !== "published") {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
  }
  if ((options.candidateId || options.publicAccess) && !isAdmitCardReleased(admitCard)) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Admit card is not released yet");
  }
  return admitCard;
};

const renderAdmitCardHtml = async (id, options = {}) => {
  const admitCard = await getAdmitCardForHtml(id, options);
  if (options.trackDownload !== false) {
    await AdmitCard.updateOne(
      { _id: admitCard._id },
      { $inc: { downloadCount: 1 }, lastDownloadedAt: new Date() },
    );
  }
  const schedule = admitCard.examScheduleId;
  const allocation = admitCard.allocationId;
  const application = admitCard.applicationId;
  const center = allocation.centerId;
  const personal = application.personalDetails || {};
  const photoUrl = getDocumentUrl(application, "passport_photo");
  const signatureUrl = getDocumentUrl(application, "signature");
  const tplConfig = await resolveScheduleTemplateConfig(schedule, "admit_card");
  const baseLayout = tplConfig.baseLayout || "standard";
  const logoUrl = tplConfig.logoUrl || schedule.admitCardLogoUrl;
  const watermarkUrl = tplConfig.watermarkUrl;
  const primaryColor = tplConfig.primaryColor || "#f97316";
  const organizationName = tplConfig.organizationName || schedule.commissionName || "Jharkhand Staff Selection Commission";
  const organizationNameLocal = tplConfig.organizationNameLocal || schedule.commissionNameLocal || "Jharkhand Staff Selection Commission";
  const documentTitle = tplConfig.documentTitle || "Admit Card";
  const sealText = tplConfig.sealText || "JSSC";
  const provisionalNote = tplConfig.provisionalNote || schedule.provisionalNote || DEFAULT_PROVISIONAL_NOTE;
  const instructionHeading =
    tplConfig.instructionHeading ||
    "Please read the instructions carefully given below in the admit card before appearing for the examination.";
  const photoBoxText = String(
    tplConfig.photoBoxText ||
      "Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature",
  )
    .split("\n")
    .filter(Boolean)
    .map((line) => escapeHtml(line))
    .join("<br/>");
  const controllerTitle = tplConfig.controllerTitle || "Examination Controller";

  const templateInstructions = tplConfig.instructions
    ? tplConfig.instructions.split('\n').filter(line => line.trim().length > 0).map((text, i) => ({ order: i + 1, text: text.trim() }))
    : null;

  const papers = schedule.papers?.length
    ? schedule.papers
    : [{ name: "Paper I", numberOfQuestions: 100 }];
  const instructions =
    templateInstructions ||
    (schedule.instructions?.length
      ? [...schedule.instructions].sort((a, b) => a.order - b.order)
      : DEFAULT_INSTRUCTIONS);
  const verificationPath = `/admit-cards/verify/${encodeURIComponent(admitCard.barcodeValue)}`;

  const venue = [
    center?.name,
    center?.addressLine1,
    center?.addressLine2,
    center?.city,
    center?.district,
    center?.state,
    center?.pincode ? `PIN: ${center.pincode}` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const localCommission =
    schedule.commissionNameLocal &&
    !String(schedule.commissionNameLocal).includes("à¤")
      ? schedule.commissionNameLocal
      : "झारखंड कर्मचारी चयन आयोग";

  const rows = papers
    .map(
      (paper) => `
    <tr>
      <td>${escapeHtml(paper.name)}</td>
      <td>${escapeHtml(paper.numberOfQuestions)}</td>
      <td></td>
      <td></td>
    </tr>
  `,
    )
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Admit Card ${escapeHtml(admitCard.rollNumber)}</title>
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 28px 38px 24px; page-break-after: always; break-after: page; background: #fff; }
    .page:last-of-type { page-break-after: auto; }
    .sheet { width: 574px; margin: 0 auto; }
    .header { text-align: center; line-height: 1.02; margin-bottom: 5px; }
    .seal { width: 42px; height: 42px; border: 2px solid #75a887; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 6px; color: #1f6b43; font-family: "Times New Roman", Georgia, serif; font-size: 9px; font-weight: 700; box-shadow: inset 0 0 0 3px #eef7f1, inset 0 0 0 5px #c7ded0; }
    .commission { font-family: "Times New Roman", Georgia, serif; font-size: 22px; font-weight: 700; line-height: 1.05; }
    .local { font-size: 15px; font-weight: 700; line-height: 1.05; }
    .exam { font-size: 10px; font-weight: 700; line-height: 1.05; margin-top: 2px; }
    .title { font-size: 13px; font-weight: 700; line-height: 1.05; }
    .barcode { height: 27px; margin: 4px auto 5px; line-height: 0; overflow: hidden; white-space: nowrap; text-align: center; }
    .verify { font-size: 8px; font-weight: 700; margin-top: 2px; word-break: break-all; }
    .barcode span { height: 28px !important; vertical-align: top; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; border: 1px solid ${primaryColor}; }
    th, td { border: 1px solid ${primaryColor}; padding: 4px 7px; vertical-align: middle; line-height: 1.12; }
    th { text-align: center; font-weight: 700; }
    .label { width: 25%; font-weight: 700; }
    .value { font-weight: 500; }
    .photo-cell { width: 25%; text-align: center; padding: 0; vertical-align: top; }
    .candidate td { height: 34px; }
    .photo-box { height: 70px; display: flex; align-items: center; justify-content: center; border-bottom: 1px solid #9aa8bd; }
    .photo-box img { max-width: 66px; max-height: 66px; object-fit: cover; }
    .photo-placeholder { width: 58px; height: 58px; border-radius: 50%; background: #f1f3f5; color: #8a93a3; display: inline-flex; align-items: center; justify-content: center; font-size: 10px; }
    .paste-text { height: 112px; display: flex; align-items: center; justify-content: center; padding: 8px; font-size: 10px; font-weight: 700; line-height: 1.16; }
    .paste-text small { display: block; margin-top: 5px; font-size: 8px; line-height: 1.1; }
    .sign-box { height: 52px; display: flex; align-items: center; justify-content: center; border-top: 1px solid #9aa8bd; background: #fafafa; }
    .sign-box img { max-width: 105px; max-height: 46px; object-fit: contain; }
    .section-title { text-align: center; font-weight: 700; font-size: 14px; background: #fff; padding: 3px 6px; }
    .paper th { font-size: 12px; padding: 5px 6px; }
    .paper td { height: 36px; font-weight: 700; }
    .venue td { padding: 4px 8px; height: 27px; }
    .spacer { height: 7px; }
    .controller { margin-top: 47px; text-align: right; padding-right: 78px; font-size: 12px; font-weight: 700; }
    .instructions-page { padding-top: 29px; }
    .instruction-sheet { width: 574px; margin: 0 auto; }
    .instruction-box { border: 1px solid ${primaryColor}; min-height: 627px; }
    .note { border-bottom: 1px solid ${primaryColor}; padding: 7px 8px; font-size: 10px; font-weight: 700; line-height: 1.25; text-align: justify; }
    .instruction-head { border-bottom: 1px solid ${primaryColor}; text-align: center; padding: 8px; font-size: 14px; font-weight: 700; line-height: 1.15; }
    ol { margin: 12px 12px 24px 45px; padding: 0; font-size: 10px; font-weight: 700; line-height: 1.25; }
    li { padding: 8px 0 9px; border-bottom: 1px solid #aaa; }
    li:last-child { border-bottom: 1px solid #aaa; }
    .actions { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
    .actions button { border: 0; background: #ea580c; color: #fff; padding: 8px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    @media print { .actions { display: none; } .page { margin: 0; } }
    /* Template styles */
    body.template-modern { font-family: "Segoe UI", Roboto, sans-serif; }
    body.template-modern table { border-color: #334155; }
    body.template-modern th { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }
    body.template-modern td { border-color: #cbd5e1; }
    body.template-compact .page { padding: 15px 20px 10px; }
    body.template-compact table { font-size: 10px; }
    body.template-compact th, body.template-compact td { padding: 2px 4px; }
    body.template-compact .photo-box { height: 50px; }
    body.template-compact .photo-box img { max-height: 46px; max-width: 46px; }
    body.template-compact .paste-text { height: 80px; font-size: 9px; }
    body.template-compact .candidate td { height: 26px; }
    .logo-container { margin: 0 auto 6px; display: flex; align-items: center; justify-content: center; height: 50px; }
    .logo-container img { max-width: 50px; max-height: 50px; object-fit: contain; }
  </style>
</head>
<body class="template-${baseLayout}" ${watermarkUrl ? `style="background-image: url('${watermarkUrl}'); background-size: cover; background-position: center; background-repeat: no-repeat;"` : ""}>
  ${
    options.embed
      ? ""
      : `<div class="actions">
    <button onclick="window.print()">Print</button>
    <button onclick="downloadPdf()">Download PDF</button>
  </div>`
  }
  <script>
    function downloadPdf() {
      window.location.href = window.location.pathname.replace(/\\/html$/, "/pdf") + window.location.search;
    }
  </script>
  <section class="page">
    <div class="sheet">
      <div class="header">
        ${logoUrl ? `<div class="logo-container"><img src="${escapeHtml(logoUrl)}" alt="Logo" /></div>` : `<div class="seal" style="border-color: ${primaryColor}80; color: ${primaryColor}; box-shadow: inset 0 0 0 3px ${primaryColor}10, inset 0 0 0 5px ${primaryColor}20;">${escapeHtml(sealText)}</div>`}
        <div class="commission">${escapeHtml(organizationName)}</div>
        <div class="local">${escapeHtml(organizationNameLocal)}</div>
        <div class="exam">${escapeHtml(schedule.advertisementNo || "")}</div>
        <div class="exam">${escapeHtml(schedule.examName || schedule.examCode)}</div>
        <div class="title">${escapeHtml(documentTitle)}</div>
        <div class="barcode">${barcodeBars(admitCard.barcodeValue)}</div>
        <div class="verify">Verify: ${escapeHtml(verificationPath)}</div>
      </div>

    <table class="candidate">
      <tr><th colspan="3" class="section-title">Candidate's Details</th></tr>
      <tr>
        <td class="label">Application Number</td><td class="value">${escapeHtml(application.applicationId)}</td>
        <td class="photo-cell" rowspan="8">
          <div class="photo-box">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" />` : `<span class="photo-placeholder">Photo</span>`}</div>
          <div class="paste-text"><div>${photoBoxText}</div></div>
          <div class="sign-box">${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" />` : ""}</div>
        </td>
      </tr>
      <tr><td class="label">Roll Number</td><td class="value">${escapeHtml(admitCard.rollNumber)}</td></tr>
      <tr><td class="label">Name</td><td class="value">${escapeHtml(personal.fullName || application.candidateId?.fullName)}</td></tr>
      <tr><td class="label">Father's Name</td><td class="value">${escapeHtml(personal.fatherName)}</td></tr>
      <tr><td class="label">Gender</td><td class="value">${escapeHtml(personal.gender)}</td></tr>
      <tr><td class="label">Category</td><td class="value">${escapeHtml(personal.category)}</td></tr>
      <tr><td class="label">Date of Birth</td><td class="value">${escapeHtml(formatDate(personal.dateOfBirth))}</td></tr>
      <tr><td class="label">Identification Mark</td><td class="value">${escapeHtml(personal.identificationMark)}</td></tr>
    </table>

    <div class="spacer"></div>
    <table class="paper">
      <tr><th colspan="4" class="section-title">Examination Details</th></tr>
      <tr><th>Details of paper</th><th>Number of questions</th><th>Candidate's Signature</th><th>Invigilator's Signature</th></tr>
      ${rows}
    </table>

    <div class="spacer"></div>
    <table class="venue">
      <tr><th colspan="2" class="section-title">Venue/ Time Details</th></tr>
      <tr><td class="label">Examination Center</td><td><strong>${escapeHtml(venue)}</strong></td></tr>
      <tr><td class="label">Exam Date</td><td>${escapeHtml(formatDate(schedule.examDate))}</td></tr>
      <tr><td class="label">Reporting Time</td><td>${escapeHtml(schedule.reportingTime)}</td></tr>
      ${schedule.gateClosingTime ? `<tr><td class="label">Gate Closing Time</td><td>${escapeHtml(schedule.gateClosingTime)}</td></tr>` : ""}
      <tr><td class="label">Exam Time</td><td>${escapeHtml(schedule.examStartTime)}${schedule.examEndTime ? ` to ${escapeHtml(schedule.examEndTime)}` : ""}</td></tr>

    <div class="controller">${escapeHtml(controllerTitle)}</div>
    </div>
  </section>

  <section class="page instructions-page">
    <div class="instruction-sheet">
      <div class="instruction-box">
        <div class="note">${escapeHtml(provisionalNote)}</div>
        <div class="instruction-head">${escapeHtml(instructionHeading)}</div>
        <ol>
          ${instructions.map((item) => `<li>${escapeHtml(item.text)}</li>`).join("")}
        </ol>
      </div>
    </div>
  </section>
</body>
</html>`;
};

const chunk = (items, size) => {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const renderAttendanceSheetHtml = async (id, options = {}) => {
  const schedule = await ExamSchedule.findById(id);
  if (!schedule)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam schedule not found");

  const filter = { examScheduleId: schedule._id, status: "allocated" };
  if (options.centerId) filter.centerId = options.centerId;

  const allocations = await CandidateAllocation.find(filter)
    .populate("centerId")
    .populate("roomId")
    .populate("applicationId", "applicationId personalDetails documents")
    .sort({ centerId: 1, rollNumber: 1 });

  if (allocations.length === 0) {
    throw new ApiError(
      StatusCodes.NOT_FOUND,
      "No allocations found for attendance sheet",
    );
  }

  const tplConfig = await resolveScheduleTemplateConfig(schedule, "attendance_sheet");
  const primaryColor = tplConfig.primaryColor || "#f97316";
  const baseLayout = tplConfig.baseLayout || "standard";
  const logoUrl = tplConfig.logoUrl || "";
  const watermarkUrl = tplConfig.watermarkUrl || "";
  const organizationName = tplConfig.organizationName || schedule.commissionName || "Jharkhand Staff Selection Commission";
  const organizationNameLocal = tplConfig.organizationNameLocal || schedule.commissionNameLocal || "Jharkhand Staff Selection Commission";
  const documentTitle = tplConfig.documentTitle || "ATTENDANCE SHEET";
  const sealText = tplConfig.sealText || "JSSC";
  const templateInstructions = String(tplConfig.instructions || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const isLandscape = tplConfig.orientation === "landscape";

  const chunks = chunk(allocations, 6);
  const totalPages = chunks.length;

  const pages = chunks
    .map((items, pageIndex) => {
      const first = items[0];
      const center = first.centerId;
      const venueAddress = [
        center?.name,
        center?.addressLine1,
        center?.city,
        center?.district,
        center?.state,
        center?.pincode ? `PIN: ${center.pincode}` : "",
      ]
        .filter(Boolean)
        .join(", ");

      const rows = Array.from({ length: 6 }, (_, index) => {
        const allocation = items[index];
        const application = allocation?.applicationId;
        const personal = application?.personalDetails || {};
        const photoUrl = application
          ? getDocumentUrl(application, "passport_photo")
          : "";
        const signatureUrl = application
          ? getDocumentUrl(application, "signature")
          : "";
        return `
        <tr class="top-row">
          <td class="sl-label">Sl. No.</td>
          <td>Name: <strong>${escapeHtml(personal.fullName)}</strong></td>
          <td>Roll No.: <strong>${escapeHtml(allocation?.rollNumber)}</strong></td>
          <td class="photo" rowspan="3">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" />` : `<span></span>`}</td>
          <td class="thumb" rowspan="4"><strong>Thumb<br/>Impression</strong><br/><br/><small>(Left Hand)</small></td>
        </tr>
        <tr>
          <td class="serial" rowspan="3">${allocation ? index + 1 : ""}</td>
          <td>Gender: <strong>${escapeHtml(personal.gender)}</strong></td><td class="mark">Present <span></span></td></tr>
        <tr><td>Registration No.: <strong>${escapeHtml(application?.applicationId)}</strong></td><td class="mark">Absent <span></span></td></tr>
        <tr><td colspan="2">Signature of Candidate</td><td class="sign">${signatureUrl ? `<img src="${escapeHtml(signatureUrl)}" />` : ""}</td></tr>
      `;
      }).join("");

      return `
      <section class="page template-${escapeHtml(baseLayout)}">
        ${watermarkUrl ? `<img class="watermark" src="${escapeHtml(watermarkUrl)}" alt="" />` : ""}
        <div class="head">
          <div class="seal">${logoUrl ? `<img src="${escapeHtml(logoUrl)}" alt="Logo" />` : escapeHtml(sealText)}</div>
          <div>
            <h1>${escapeHtml(organizationName)}</h1>
            <h2>${escapeHtml(organizationNameLocal)}</h2>
            <p>${escapeHtml(documentTitle)}</p>
          </div>
          <div></div>
        </div>
        <table class="venue-meta">
          <tr>
            <td>Venue of Examination: <strong>${escapeHtml(center?.name)}</strong></td>
            <td>Center: <strong>${escapeHtml(venueAddress)}</strong></td>
          </tr>
          <tr><td colspan="2">Venue Address: <strong>${escapeHtml(venueAddress)}</strong></td></tr>
          <tr>
            <td>Roll Nos.: <strong>${escapeHtml(items[0]?.rollNumber)} to ${escapeHtml(items[items.length - 1]?.rollNumber)}</strong> &nbsp;&nbsp;&nbsp;&nbsp; Total Candidates: <strong>${String(items.length).padStart(2, "0")}</strong></td>
            <td>Examination Date: <strong>${escapeHtml(formatDate(schedule.examDate))}</strong> &nbsp;&nbsp; Time: <strong>${escapeHtml(schedule.examStartTime)}${schedule.examEndTime ? ` to ${escapeHtml(schedule.examEndTime)}` : ""}</strong></td>
          </tr>
        </table>
        <table class="candidates">${rows}</table>
        ${
          templateInstructions.length
            ? `<div class="sheet-instructions"><strong>Instructions:</strong> ${templateInstructions
                .map((line) => escapeHtml(line))
                .join(" | ")}</div>`
            : ""
        }
        <table class="foot">
          <tr>
            <td>Total Candidates Present: __________________________</td>
            <td>Total Candidates Absent: __________________________</td>
          </tr>
          <tr>
            <td>Total Number of Candidates: ________________________</td>
            <td>Signature of Invigilator: __________________________</td>
          </tr>
        </table>
        <div class="page-number">Page ${pageIndex + 1} of ${totalPages}</div>
      </section>
    `;
    })
    .join("");

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Attendance Sheet ${escapeHtml(schedule.examCode)}</title>
  <style>
    @page { size: A4 ${isLandscape ? "landscape" : "portrait"}; margin: 0; }
    * { box-sizing: border-box; }
    :root { --primary: ${escapeHtml(primaryColor)}; }
    body { margin: 0; font-family: "Times New Roman", Times, serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { position: relative; width: ${isLandscape ? "297mm" : "210mm"}; min-height: ${isLandscape ? "210mm" : "297mm"}; margin: 0 auto; padding: 30px 46px 18px; page-break-after: always; background: #fff; overflow: hidden; }
    .page:last-of-type { page-break-after: auto; }
    .watermark { position: absolute; inset: 35% auto auto 50%; width: 290px; max-height: 290px; transform: translate(-50%, -50%); opacity: .06; object-fit: contain; pointer-events: none; }
    .head { display: grid; grid-template-columns: 82px 1fr 82px; align-items: center; text-align: center; margin-bottom: 5px; }
    .seal { width: 48px; height: 48px; border: 2px solid var(--primary); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--primary); font-family: Arial, sans-serif; font-size: 9px; font-weight: 700; box-shadow: inset 0 0 0 3px #fff7ed, inset 0 0 0 5px #fed7aa; overflow: hidden; }
    .seal img { width: 38px; height: 38px; object-fit: contain; }
    h1 { font-size: 16px; margin: 0; font-weight: 400; line-height: 1.05; }
    h2 { font-size: 16px; margin: 0; font-weight: 400; line-height: 1.05; }
    p { margin: 1px 0 0; font-size: 11px; line-height: 1.05; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10px; }
    td { border: 1px solid #000; padding: 3px 5px; vertical-align: middle; line-height: 1.08; }
    .venue-meta td { height: 22px; }
    .venue-meta td:first-child { width: 50%; }
    .candidates td { height: 26px; }
    .top-row td { height: 18px; }
    .sl-label { width: 36px; text-align: center; }
    .serial { width: 36px; text-align: center; font-size: 13px; }
    .photo { width: 66px; text-align: center; padding: 0; }
    .photo img { max-width: 56px; max-height: 64px; object-fit: cover; }
    .photo span { display: inline-block; width: 43px; height: 43px; border-radius: 50%; background: #e5e5e5; }
    .thumb { width: 92px; text-align: center; font-size: 12px; vertical-align: top; padding-top: 8px; }
    .thumb small { font-size: 9px; }
    .mark { width: 112px; text-align: center; }
    .mark span { display: inline-block; width: 1px; height: 22px; border-left: 1px solid #000; margin-left: 28px; vertical-align: middle; }
    .sign { width: 66px; text-align: center; padding: 0; background: #fafafa; }
    .sign img { max-width: 62px; max-height: 24px; object-fit: contain; }
    .sheet-instructions { border: 1px solid #000; border-top: 0; padding: 4px 6px; font-size: 9px; line-height: 1.2; }
    .foot td { border-top: 0; height: 22px; font-size: 9px; }
    .template-modern .head { border-bottom: 3px solid var(--primary); padding-bottom: 6px; margin-bottom: 8px; }
    .template-compact { padding: 22px 38px 14px; }
    .template-compact h1, .template-compact h2 { font-size: 14px; }
    .template-compact table { font-size: 9px; }
    .template-compact td { padding: 2px 4px; }
    .actions { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
    .actions button { border: 0; background: #111827; color: #fff; padding: 8px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    .page-number { position: absolute; bottom: 18px; right: 46px; font-size: 10px; font-weight: bold; }
    @media print { .actions { display: none; } .page { margin: 0; } }
  </style>
</head>
<body>
  <div class="actions">
    <button onclick="window.print()">Print</button>
    <button onclick="downloadPdf()">Download PDF</button>
  </div>
  <script>
    function downloadPdf() {
      window.location.href = window.location.pathname.replace(/\\/html$/, "/pdf") + window.location.search;
    }
  </script>
  ${pages}
</body>
</html>`;
};

const getExamOpsSummary = async () => {
  const eligibleFilter = {
    status: { $in: ["submitted", "approved", "auto_approved", "verified"] },
    paymentStatus: "paid",
  };
  const [
    totalSchedules,
    publishedSchedules,
    activeCenters,
    roomCapacity,
    allocations,
    admitCards,
    eligibleCandidates,
    pendingCorrections,
    centerUtilization,
    downloadStats,
  ] = await Promise.all([
    ExamSchedule.countDocuments({ status: { $ne: "cancelled" } }),
    ExamSchedule.countDocuments({ status: "published" }),
    ExamCenter.countDocuments({ active: true }),
    ExamRoom.aggregate([
      { $match: { active: true } },
      {
        $group: {
          _id: null,
          rooms: { $sum: 1 },
          usableSeats: {
            $sum: { $ifNull: ["$usableCapacity", "$capacity"] },
          },
        },
      },
    ]),
    CandidateAllocation.countDocuments({ status: "allocated" }),
    AdmitCard.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),
    Application.countDocuments(eligibleFilter),
    Application.countDocuments({
      $or: [
        { status: "clarification_required" },
        { "correction.status": { $in: ["requested", "in_progress", "submitted"] } },
        { "corrections.status": { $in: ["pending", "more_info_needed"] } },
      ],
    }),
    CandidateAllocation.aggregate([
      { $match: { status: "allocated" } },
      { $group: { _id: "$centerId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "examcenters",
          localField: "_id",
          foreignField: "_id",
          as: "center",
        },
      },
      { $unwind: { path: "$center", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          centerId: "$_id",
          centerCode: "$center.centerCode",
          name: "$center.name",
          allocated: "$count",
        },
      },
    ]),
    AdmitCard.aggregate([
      {
        $group: {
          _id: null,
          downloads: { $sum: { $ifNull: ["$downloadCount", 0] } },
          requested: { $sum: 1 },
        },
      },
    ]),
  ]);

  const cardCounts = admitCards.reduce(
    (acc, item) => ({ ...acc, [item._id || "unknown"]: item.count }),
    {},
  );
  const capacity = roomCapacity[0] || { rooms: 0, usableSeats: 0 };
  const downloadSummary = downloadStats[0] || { downloads: 0, requested: 0 };
  const remainingCapacity = Math.max(
    0,
    Number(capacity.usableSeats || 0) - Number(allocations || 0),
  );

  return {
    generatedAt: new Date(),
    schedules: {
      total: totalSchedules,
      published: publishedSchedules,
    },
    capacity: {
      centers: activeCenters,
      rooms: capacity.rooms || 0,
      usableSeats: capacity.usableSeats || 0,
      allocated: allocations,
      remaining: remainingCapacity,
    },
    candidates: {
      eligible: eligibleCandidates,
      pendingCorrections,
    },
    admitCards: {
      generated: cardCounts.generated || 0,
      published: cardCounts.published || 0,
      revoked: cardCounts.revoked || 0,
      downloads: downloadSummary.downloads || 0,
      requests: downloadSummary.requested || 0,
    },
    centerUtilization,
  };
};

const generateCenterTemplate = async () => {
  const ws = xlsx.utils.aoa_to_sheet([
    [
      "Center Code",
      "Center Name",
      "Address Line 1",
      "Address Line 2",
      "City",
      "District",
      "State",
      "Pincode",
      "Contact Name",
      "Contact Phone",
      "Contact Email",
      "Room Code",
      "Room Name",
      "Block",
      "Floor",
      "Room Capacity",
      "Wheelchair Access",
    ],
    [
      "CN-001",
      "Sample Exam Center",
      "123 Main Street",
      "",
      "Ranchi",
      "Ranchi",
      "Jharkhand",
      "834001",
      "John Doe",
      "9876543210",
      "john@example.com",
      "R-01",
      "Room 1",
      "A",
      "1st Floor",
      "50",
      "TRUE",
    ],
  ]);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Centers and Rooms");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });
  return { buffer, fileName: "exam-centers-template.xlsx" };
};

const createCenterWithRooms = async (payload, adminId) => {
  const { centerDetails, rooms } = payload;
  if (!centerDetails || !rooms || !Array.isArray(rooms)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid payload format. Expected centerDetails and rooms array.");
  }
  const centerCode = normalizeCode(centerDetails.centerCode);
  if (!centerCode) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Center code is required.");
  }
  if (rooms.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Add at least one room before saving the center.");
  }

  const session = await mongoose.startSession();
  let createdCenter;
  let createdRooms = [];

  try {
    session.startTransaction();

    // Check for existing center code
    const existing = await ExamCenter.findOne({ centerCode }).session(session);
    if (existing) {
      throw new ApiError(StatusCodes.CONFLICT, "This center code already exists. Use a unique center code.");
    }

    [createdCenter] = await ExamCenter.create([{ ...centerDetails, centerCode, createdBy: adminId, updatedBy: adminId }], { session });

    // Prepare rooms
    let totalCapacity = 0;
    const roomCodes = new Set();
    const roomDocs = rooms.map(room => {
      const roomCode = normalizeCode(room.roomCode);
      const capacity = Number(room.capacity || 0);
      const usableCapacity = room.usableCapacity ? Number(room.usableCapacity) : capacity;
      if (!roomCode || !room.roomName || capacity < 1) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Each room must have room code, room name, and capacity.");
      }
      if (roomCodes.has(roomCode)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, `Duplicate room code ${roomCode} in this center.`);
      }
      if (usableCapacity > capacity) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "Usable capacity cannot exceed room capacity.");
      }
      roomCodes.add(roomCode);
      totalCapacity += usableCapacity;
      return {
        ...room,
        roomCode,
        capacity,
        usableCapacity,
        centerId: createdCenter._id,
        createdBy: adminId,
        updatedBy: adminId,
      };
    });

    createdRooms = await ExamRoom.insertMany(roomDocs, { session });

    createdCenter.totalCapacity = totalCapacity;
    await createdCenter.save({ session });

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { center: createdCenter, rooms: createdRooms };
};

const bulkUploadCenters = async (fileBuffer, fileName, adminId) => {
  let workbook;
  try {
    workbook = xlsx.read(fileBuffer, { type: "buffer" });
  } catch (err) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid Excel/CSV file format");
  }

  const sheetName = workbook.SheetNames[0];
  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

  if (!rows || rows.length === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "The uploaded file is empty.");
  }

  // Group by Center Code
  const centersMap = new Map();

  for (const row of rows) {
    const centerCode = String(row["Center Code"] || "").trim().toUpperCase();
    if (!centerCode) continue;

    if (!centersMap.has(centerCode)) {
      centersMap.set(centerCode, {
        centerDetails: {
          centerCode,
          name: row["Center Name"] || "",
          addressLine1: row["Address Line 1"] || "",
          addressLine2: row["Address Line 2"] || "",
          city: row["City"] || "",
          district: row["District"] || "",
          state: row["State"] || "",
          pincode: String(row["Pincode"] || ""),
          contact: {
            name: row["Contact Name"] || "",
            phone: String(row["Contact Phone"] || ""),
            email: row["Contact Email"] || "",
          }
        },
        rooms: []
      });
    }

    const roomCode = String(row["Room Code"] || "").trim().toUpperCase();
    if (roomCode) {
      centersMap.get(centerCode).rooms.push({
        roomCode,
        roomName: row["Room Name"] || roomCode,
        block: row["Block"] || "",
        floor: String(row["Floor"] || ""),
        capacity: parseInt(row["Room Capacity"]) || 0,
        accessibility: {
          wheelchairAccess: String(row["Wheelchair Access"]).toLowerCase() === "true" || String(row["Wheelchair Access"]).toLowerCase() === "yes",
          groundFloor: String(row["Floor"]).toLowerCase().includes("ground") || String(row["Floor"]).trim() === "0",
        }
      });
    }
  }

  if (centersMap.size === 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "No valid center entries found in the file. Make sure 'Center Code' column exists.");
  }

  const session = await mongoose.startSession();
  const summary = {
    totalRows: rows.length,
    createdCenters: 0,
    createdRooms: 0,
    errors: []
  };

  try {
    session.startTransaction();

    for (const [centerCode, data] of centersMap.entries()) {
      try {
        // Validate required center fields
        const { name, addressLine1, city, district, state, pincode } = data.centerDetails;
        if (!name || !addressLine1 || !city || !district || !state || !pincode) {
          throw new Error(`Missing required center details for Center Code: ${centerCode}`);
        }

        // Upsert Center
        let center = await ExamCenter.findOne({ centerCode }).session(session);
        if (!center) {
          [center] = await ExamCenter.create([{ ...data.centerDetails, createdBy: adminId }], { session });
          summary.createdCenters++;
        } else {
          center.updatedBy = adminId;
        }

        let addedCapacity = 0;
        // Process rooms
        for (const roomData of data.rooms) {
          if (!roomData.capacity || roomData.capacity <= 0) {
            throw new Error(`Invalid capacity for Room Code: ${roomData.roomCode} in Center: ${centerCode}`);
          }

          let room = await ExamRoom.findOne({ centerId: center._id, roomCode: roomData.roomCode }).session(session);
          if (!room) {
            await ExamRoom.create([{ ...roomData, centerId: center._id, createdBy: adminId }], { session });
            summary.createdRooms++;
            addedCapacity += roomData.capacity;
          }
        }

        if (addedCapacity > 0) {
          center.totalCapacity = (center.totalCapacity || 0) + addedCapacity;
          await center.save({ session });
        }
      } catch (err) {
        summary.errors.push(`Row processing error for ${centerCode}: ${err.message}`);
      }
    }

    if (summary.errors.length > 0 && summary.createdCenters === 0 && summary.createdRooms === 0) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Failed to process any records due to errors: " + summary.errors.join("; "));
    }

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }

  return { summary };
};

module.exports = {
  listCenters,
  createCenter,
  updateCenter,
  deleteCenter,
  getCenter,
  listRooms,
  createRoom,
  updateRoom,
  listSchedules,
  createSchedule,
  getSchedule,
  updateSchedule,
  getScheduleStats,
  previewAllocation,
  allocateCandidates,
  lockAllocation,
  listAllocations,

  generateAdmitCards,
  publishAdmitCards,
  unpublishAdmitCards,
  regenerateAdmitCards,
  listAdmitCards,
  lookupPublicAdmitCard,
  verifyAdmitCard,
  getCandidateAdmitCards,
  renderAdmitCardHtml,
  renderAttendanceSheetHtml,
  getExamOpsSummary,
  generateCenterTemplate,
  createCenterWithRooms,
  bulkUploadCenters,
};
