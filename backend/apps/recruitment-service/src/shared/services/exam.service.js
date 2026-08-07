const { StatusCodes } = require("http-status-codes");
const crypto = require("crypto");
const mongoose = require("mongoose");
const ExamCenter = require("../models/ExamCenter");
const ExamRoom = require("../models/ExamRoom");
const ExamSchedule = require("../models/ExamSchedule");
const CandidateAllocation = require("../models/CandidateAllocation");
const AdmitCard = require("../models/AdmitCard");
const Application = require("../models/Application");
const Job = require("../models/Job");
const Project = require("../models/Project");
const ApiError = require("../utils/ApiError");
const { getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const { assertJobTimeline, parseDate } = require("../utils/timeline");

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

const assertEditableSchedule = (schedule) => {
  if (["locked", "published"].includes(schedule.status)) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Locked or published exam schedules cannot be edited",
    );
  }
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
  jobId,
  status: { $in: ["submitted", "under_review", "approved", "shortlisted"] },
  $or: [{ paymentStatus: "paid" }, { totalFee: 0 }],
});

const getAllocationInputs = async (schedule, options = {}) => {
  const centerFilter = { active: true };
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

const listCenters = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
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
  const center = await ExamCenter.create({
    ...data,
    centerCode: normalizeCode(data.centerCode),
    createdBy: userId,
    updatedBy: userId,
  });
  return center;
};

const updateCenter = async (id, data, userId) => {
  if (data.centerCode) data.centerCode = normalizeCode(data.centerCode);
  const center = await ExamCenter.findByIdAndUpdate(
    id,
    { ...data, updatedBy: userId },
    { new: true, runValidators: true },
  );
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  return center;
};

const getCenter = async (id) => {
  const center = await ExamCenter.findById(id);
  if (!center)
    throw new ApiError(StatusCodes.NOT_FOUND, "Exam center not found");
  const rooms = await ExamRoom.find({ centerId: id }).sort({
    block: 1,
    floor: 1,
    roomCode: 1,
  });
  return { center, rooms };
};

const listRooms = async (centerId) => {
  const center = await ExamCenter.findById(centerId);
  if (!center)
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

  const room = await ExamRoom.create({
    ...data,
    centerId,
    roomCode: normalizeCode(data.roomCode),
    createdBy: userId,
    updatedBy: userId,
  });
  await recomputeCenterCapacity(center._id);
  return room;
};

const updateRoom = async (roomId, data, userId) => {
  const room = await ExamRoom.findById(roomId);
  if (!room) throw new ApiError(StatusCodes.NOT_FOUND, "Exam room not found");
  if (
    data.usableCapacity &&
    data.capacity &&
    data.usableCapacity > data.capacity
  ) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Usable capacity cannot exceed room capacity",
    );
  }
  if (data.roomCode) data.roomCode = normalizeCode(data.roomCode);
  Object.assign(room, data, { updatedBy: userId });
  await room.save();
  await recomputeCenterCapacity(room.centerId);
  return room;
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
  await assertScheduleCenterConflicts(data);

  const schedule = await ExamSchedule.create({
    ...data,
    projectId: data.projectId || job.projectId,
    examCode: normalizeCode(data.examCode),
    examDate: new Date(data.examDate),
    provisionalNote: data.provisionalNote,
    instructions: data.instructions,
    selectedCenterIds: data.selectedCenterIds,
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
  await assertScheduleCenterConflicts(
    { ...schedule.toObject(), ...data },
    schedule._id,
  );
  if (data.examCode) data.examCode = normalizeCode(data.examCode);
  if (data.examDate) data.examDate = new Date(data.examDate);

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
  ] = await Promise.all([
    Application.countDocuments({
      jobId: schedule.jobId._id,
      status: { $in: ["submitted", "under_review", "approved", "shortlisted"] },
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

const isAdmitCardReleased = (admitCard) => {
  const releaseDate = parseDate(
    admitCard?.examScheduleId?.jobId?.admitCardReleaseDate,
  );
  return !releaseDate || new Date() >= releaseDate;
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
  if (schedule.status !== "locked" && schedule.status !== "published") {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Only locked schedules can publish admit cards",
    );
  }

  const result = await AdmitCard.updateMany(
    { examScheduleId: schedule._id, status: "generated" },
    { status: "published", publishedAt: new Date(), publishedBy: userId },
  );

  schedule.status = "published";
  schedule.publishedAt = schedule.publishedAt || new Date();
  schedule.publishedBy = schedule.publishedBy || userId;
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
  // Support both old lookup (applicationId + DOB) and new (registrationNumber + mobile)
  let application;

  if (registrationNumber) {
    application = await Application.findOne({
      registrationNumber: String(registrationNumber || "")
        .trim()
        .toUpperCase(),
    })
      .select("applicationId personalDetails candidateId contactMobile")
      .populate("candidateId", "email registeredMobile");

    if (!application)
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "No admit card found for this registration number",
      );

    // Verify mobile matches
    const storedMobile =
      application.candidateId?.registeredMobile || application.contactMobile;
    if (
      mobile &&
      storedMobile &&
      storedMobile !== mobile &&
      storedMobile !== `+91${mobile}`
    ) {
      throw new ApiError(
        StatusCodes.NOT_FOUND,
        "Mobile number does not match our records",
      );
    }
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
  if (options.candidateId && !isAdmitCardReleased(admitCard)) {
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
  const papers = schedule.papers?.length
    ? schedule.papers
    : [{ name: "Paper I", numberOfQuestions: 100 }];
  const instructions = [...(schedule.instructions || [])].sort(
    (a, b) => a.order - b.order,
  );
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
    table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 12px; border: 1px solid #244a9b; }
    th, td { border: 1px solid #244a9b; padding: 4px 7px; vertical-align: middle; line-height: 1.12; }
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
    .instruction-box { border: 1px solid #244a9b; min-height: 627px; }
    .note { border-bottom: 1px solid #244a9b; padding: 7px 8px; font-size: 10px; font-weight: 700; line-height: 1.25; text-align: justify; }
    .instruction-head { border-bottom: 1px solid #244a9b; text-align: center; padding: 8px; font-size: 14px; font-weight: 700; line-height: 1.15; }
    ol { margin: 12px 12px 24px 45px; padding: 0; font-size: 10px; font-weight: 700; line-height: 1.25; }
    li { padding: 8px 0 9px; border-bottom: 1px solid #aaa; }
    li:last-child { border-bottom: 1px solid #aaa; }
    .actions { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
    .actions button { border: 0; background: #ea580c; color: #fff; padding: 8px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
    @media print { .actions { display: none; } .page { margin: 0; } }
  </style>
</head>
<body>
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
        <div class="seal">JSSC</div>
        <div class="commission">${escapeHtml(schedule.commissionName)}</div>
        <div class="local">${escapeHtml(localCommission)}</div>
        <div class="exam">${escapeHtml(schedule.advertisementNo || "")}</div>
        <div class="exam">${escapeHtml(schedule.examName || schedule.examCode)}</div>
        <div class="title">Admit Card</div>
        <div class="barcode">${barcodeBars(admitCard.barcodeValue)}</div>
        <div class="verify">Verify: ${escapeHtml(verificationPath)}</div>
      </div>

    <table class="candidate">
      <tr><th colspan="3" class="section-title">Candidate's Details</th></tr>
      <tr>
        <td class="label">Application Number</td><td class="value">${escapeHtml(application.applicationId)}</td>
        <td class="photo-cell" rowspan="8">
          <div class="photo-box">${photoUrl ? `<img src="${escapeHtml(photoUrl)}" />` : `<span class="photo-placeholder">Photo</span>`}</div>
          <div class="paste-text"><div>Paste Photo Here<br/>Signature of Candidate<br/>below pasted Photo same as<br/>Uploaded Signature<small>(उम्मीदवारों को अपना पास फोटो के नीचे अपलोड किए गए हस्ताक्षर के समान ही हस्ताक्षर करना है ।)</small></div></div>
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
    </table>
    <div class="controller">Examination Controller</div>
    </div>
  </section>

  <section class="page instructions-page">
    <div class="instruction-sheet">
      <div class="instruction-box">
        <div class="note">${escapeHtml(schedule.provisionalNote || DEFAULT_PROVISIONAL_NOTE)}</div>
        <div class="instruction-head">Please read the instructions carefully given below in the admit card before appearing for the examination.</div>
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

  const pages = chunk(allocations, 6)
    .map((items) => {
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
      <section class="page">
        <div class="head">
          <div class="seal">JSSC</div>
          <div>
            <h1>${escapeHtml(schedule.commissionName)}</h1>
            <h2>${escapeHtml(schedule.commissionNameLocal)}</h2>
            <p>ATTENDANCE SHEET</p>
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
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", Times, serif; color: #000; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 210mm; min-height: 297mm; margin: 0 auto; padding: 30px 46px 18px; page-break-after: always; background: #fff; }
    .page:last-of-type { page-break-after: auto; }
    .head { display: grid; grid-template-columns: 82px 1fr 82px; align-items: center; text-align: center; margin-bottom: 5px; }
    .seal { width: 48px; height: 48px; border: 2px solid #75a887; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1f6b43; font-family: Arial, sans-serif; font-size: 9px; font-weight: 700; box-shadow: inset 0 0 0 3px #eef7f1, inset 0 0 0 5px #c7ded0; }
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
    .foot td { border-top: 0; height: 22px; font-size: 9px; }
    .actions { position: fixed; top: 12px; right: 12px; display: flex; gap: 8px; }
    .actions button { border: 0; background: #111827; color: #fff; padding: 8px 12px; border-radius: 6px; font-weight: 700; cursor: pointer; }
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

module.exports = {
  listCenters,
  createCenter,
  updateCenter,
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
};
