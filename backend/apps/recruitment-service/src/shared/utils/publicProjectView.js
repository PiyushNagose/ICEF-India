const { startOfDay, endOfDay } = require("./timeline");

const MS_PER_DAY = 1000 * 60 * 60 * 24;

// Jobs that the public landing page is allowed to render. Closed jobs remain
// visible for details, status, admit card, and result flows after applications end.
const PUBLIC_JOB_FILTER = {
  status: { $in: ["active", "closed"] },
  isSoftDeleted: { $ne: true },
};

// Job fields the public landing page (and its admin preview) needs
const PUBLIC_JOB_FIELDS =
  "title postCode department category totalPosts posts salaryRange " +
  "applicationFee applicationStartDate applicationDeadline correctionStartDate " +
  "correctionDeadline admitCardReleaseDate examDate resultDate ageLimit " +
  "education physicalStandards medicalStandards description status";

const buildAvailability = (job, now = new Date()) => {
  const currentDay = startOfDay(now);
  const start = startOfDay(job.applicationStartDate);
  const deadline = endOfDay(job.applicationDeadline);
  const deadlineDay = startOfDay(job.applicationDeadline);

  if (job.status === "closed") {
    return {
      status: "closed",
      label: "Closed",
      canApply: false,
      reason: "The application window for this post has ended.",
      daysLeft: 0,
    };
  }

  if (job.status !== "active") {
    return {
      status: "inactive",
      label: "Inactive",
      canApply: false,
      reason: "This recruitment is not accepting applications.",
      daysLeft: null,
    };
  }
  if (start && currentDay < start) {
    return {
      status: "not_open",
      label: "Not Open Yet",
      canApply: false,
      reason: "Application window has not opened yet.",
      daysUntilOpen: Math.max(0, Math.ceil((start - currentDay) / MS_PER_DAY)),
      daysLeft: deadlineDay
        ? Math.max(0, Math.ceil((deadlineDay - currentDay) / MS_PER_DAY) + 1)
        : null,
    };
  }
  if (deadline && now > deadline) {
    return {
      status: "closed",
      label: "Closed",
      canApply: false,
      reason: "Application deadline has passed.",
      daysLeft: 0,
    };
  }
  return {
    status: "open",
    label: "Open",
    canApply: true,
    reason: "Applications are open.",
    daysLeft: deadlineDay
      ? Math.max(0, Math.ceil((deadlineDay - currentDay) / MS_PER_DAY) + 1)
      : null,
  };
};

const enrichPublicJob = (job, now = new Date()) => {
  const availability = buildAvailability(job, now);
  return {
    ...job,
    availability,
    isApplicationOpen: availability.canApply,
    daysLeft: availability.daysLeft,
    isCorrectionOpen:
      job.correctionStartDate &&
      job.correctionDeadline &&
      startOfDay(job.correctionStartDate) <= startOfDay(now) &&
      endOfDay(job.correctionDeadline) >= now,
    isAdmitCardAvailable:
      job.admitCardReleaseDate &&
      startOfDay(job.admitCardReleaseDate) <= startOfDay(now),
  };
};

const enrichPublicJobs = (jobs = [], now = new Date()) =>
  jobs.map((job) => enrichPublicJob(job, now));

module.exports = {
  PUBLIC_JOB_FILTER,
  PUBLIC_JOB_FIELDS,
  buildAvailability,
  enrichPublicJob,
  enrichPublicJobs,
};
