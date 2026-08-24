const { StatusCodes } = require("http-status-codes");
const ApiError = require("./ApiError");

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const endOfDay = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

const getProjectLifecycleStatus = (projectLike, now = new Date()) => {
  if (!projectLike) return "Upcoming";
  if (projectLike.status === "Cancelled") return "Cancelled";

  const start = startOfDay(projectLike.startDate);
  const closure = startOfDay(projectLike.endDate || projectLike.closureDate);
  const today = startOfDay(now);

  if (start && today < start) return "Upcoming";
  if (closure && today > closure) return "Completed";
  if (start && (!closure || today <= closure)) return "Active";

  return projectLike.status || "Upcoming";
};

const getProjectClosureDate = (project) =>
  parseDate(project?.endDate || project?.closureDate);

const getPaymentDeadline = (job) =>
  parseDate(job?.paymentConfig?.paymentDeadline || job?.applicationDeadline);

const assertOrder = (left, right, message) => {
  const a = parseDate(left);
  const b = parseDate(right);
  if (a && b && a > b) {
    throw new ApiError(StatusCodes.BAD_REQUEST, message);
  }
};

const assertWithinProject = (date, project, label) => {
  const value = startOfDay(date);
  if (!value || !project) return;

  const start = startOfDay(project.startDate);
  const closure = endOfDay(getProjectClosureDate(project));

  if (start && value < start) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${label} cannot be before project start date`,
    );
  }

  if (closure && value > closure) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      `${label} cannot be after project closure date`,
    );
  }
};

const assertProjectTimeline = (projectLike) => {
  const start = parseDate(projectLike.startDate);
  const closure = getProjectClosureDate(projectLike);
  if (start && closure && closure < start) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Project closure date must be after project start date",
    );
  }
};

const assertJobTimeline = (jobLike, project) => {
  assertOrder(
    jobLike.applicationStartDate,
    jobLike.applicationDeadline,
    "Application deadline must be after application start date",
  );
  assertOrder(
    jobLike.applicationDeadline,
    jobLike.paymentConfig?.paymentDeadline,
    "Payment deadline cannot be before application deadline",
  );
  assertOrder(
    jobLike.correctionStartDate,
    jobLike.correctionDeadline,
    "Correction deadline must be after correction start date",
  );
  assertOrder(
    jobLike.applicationDeadline,
    jobLike.examDate,
    "Exam date must be after application deadline",
  );
  assertOrder(
    jobLike.paymentConfig?.paymentDeadline || jobLike.applicationDeadline,
    jobLike.examDate,
    "Exam date must be after payment deadline",
  );
  assertOrder(
    jobLike.correctionDeadline,
    jobLike.examDate,
    "Exam date must be after correction deadline",
  );
  assertOrder(
    jobLike.admitCardReleaseDate,
    jobLike.examDate,
    "Admit card release date must be on or before exam date",
  );
  assertOrder(
    jobLike.examDate,
    jobLike.resultDate,
    "Result date must be after exam date",
  );

  [
    ["Application start date", jobLike.applicationStartDate],
    ["Application deadline", jobLike.applicationDeadline],
    ["Payment deadline", jobLike.paymentConfig?.paymentDeadline],
    ["Correction start date", jobLike.correctionStartDate],
    ["Correction deadline", jobLike.correctionDeadline],
    ["Admit card release date", jobLike.admitCardReleaseDate],
    ["Exam date", jobLike.examDate],
    ["Result date", jobLike.resultDate],
  ].forEach(([label, value]) => assertWithinProject(value, project, label));
};

const assertApplicationWindowOpen = (job) => {
  const now = new Date();
  const start = startOfDay(job?.applicationStartDate);
  const deadline = endOfDay(job?.applicationDeadline);

  if (start && now < start) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Application window has not opened yet",
    );
  }
  if (deadline && now > deadline) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Application deadline has passed");
  }
};

const assertCorrectionWindowOpen = (job) => {
  const now = new Date();
  const start = startOfDay(job?.correctionStartDate);
  const deadline = endOfDay(job?.correctionDeadline);

  if (start && now < start) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Correction window has not opened yet",
    );
  }
  if (deadline && now > deadline) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Correction deadline has passed");
  }
};

const assertPaymentWindowOpen = (job) => {
  const deadline = endOfDay(getPaymentDeadline(job));
  if (deadline && new Date() > deadline) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Payment deadline has passed");
  }
};

const assertAdmitCardReleaseOpen = (job) => {
  const releaseDate = startOfDay(job?.admitCardReleaseDate);
  if (releaseDate && new Date() < releaseDate) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      "Admit cards are not released yet",
    );
  }
};

module.exports = {
  parseDate,
  startOfDay,
  endOfDay,
  getProjectLifecycleStatus,
  getProjectClosureDate,
  getPaymentDeadline,
  assertProjectTimeline,
  assertJobTimeline,
  assertApplicationWindowOpen,
  assertCorrectionWindowOpen,
  assertPaymentWindowOpen,
  assertAdmitCardReleaseOpen,
};
