const MS_PER_DAY = 1000 * 60 * 60 * 24;

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
  const date = asDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const endOfDay = (value) => {
  const date = asDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
};

const daysBetweenInclusive = (from, to) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (!start || !end) return null;
  return Math.max(0, Math.ceil((end - start) / MS_PER_DAY) + 1);
};

export const getEffectiveJobStatus = (job = {}) => {
  if (job.effectiveStatus) return String(job.effectiveStatus).toLowerCase();
  const status = String(job.status || "draft").toLowerCase();
  const deadline = endOfDay(job.applicationDeadline);
  if (status === "active" && deadline && new Date() > deadline) return "closed";
  return status;
};

export const formatJobStatus = (job = {}) => {
  const status = getEffectiveJobStatus(job);
  return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Draft";
};

export const getJobAvailability = (job = {}) => {
  if (job.availability) return job.availability;

  const now = new Date();
  const today = startOfDay(now);
  const start = startOfDay(job.applicationStartDate);
  const deadline = endOfDay(job.applicationDeadline);
  const deadlineDay = startOfDay(job.applicationDeadline);

  const effectiveStatus = getEffectiveJobStatus(job);

  if (effectiveStatus === "closed") {
    return {
      status: "closed",
      label: "Closed",
      canApply: false,
      reason: "The application window for this post has ended.",
      daysLeft: 0,
    };
  }

  if (effectiveStatus && effectiveStatus !== "active") {
    return {
      status: "inactive",
      label: "Inactive",
      canApply: false,
      reason: "This recruitment is not accepting applications.",
      daysLeft: null,
    };
  }

  if (start && today < start) {
    return {
      status: "not_open",
      label: "Not Open Yet",
      canApply: false,
      reason: "Application window has not opened yet.",
      daysUntilOpen: Math.max(0, Math.ceil((start - today) / MS_PER_DAY)),
      daysLeft: daysBetweenInclusive(today, deadlineDay),
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
    daysLeft: daysBetweenInclusive(today, deadlineDay),
  };
};

export const getApplicationAction = (job = {}, application = null) => {
  const availability = getJobAvailability(job);

  if (application) {
    const status = application.status;
    const correctionStatus = application.correction?.status;
    if (status === "draft") {
      return availability.canApply
        ? {
            type: "resume",
            label: "Resume Application",
            canClick: true,
            tone: "orange",
            reason: "Continue your saved draft.",
          }
        : {
            type: "expired_draft",
            label: availability.label,
            canClick: false,
            tone: "gray",
            reason: availability.reason,
          };
    }
    if (correctionStatus === "requested" || correctionStatus === "in_progress") {
      return {
        type: "correction",
        label: "Correction Needed",
        canClick: true,
        tone: "amber",
        reason: "Admin requested corrections.",
      };
    }
    return {
      type: "already_applied",
      label: "Already Applied",
      canClick: true,
      tone: status === "rejected" ? "red" : "green",
      reason: "Use your registration number and registered mobile OTP to check status.",
    };
  }

  return {
    type: availability.canApply ? "apply" : availability.status,
    label: availability.canApply ? "Apply Now" : availability.label,
    canClick: availability.canApply,
    tone: availability.canApply ? "orange" : "gray",
    reason: availability.reason,
  };
};

export const getActionButtonClass = (action) => {
  const base =
    "flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all";
  if (!action?.canClick) {
    return `${base} bg-gray-100 text-gray-400 cursor-not-allowed`;
  }
  if (action.tone === "green") return `${base} bg-green-600 hover:bg-green-700 text-white`;
  if (action.tone === "amber") return `${base} bg-amber-500 hover:bg-amber-600 text-white`;
  if (action.tone === "red") return `${base} bg-red-600 hover:bg-red-700 text-white`;
  return `${base} bg-[#f97316] hover:bg-orange-600 text-white`;
};
