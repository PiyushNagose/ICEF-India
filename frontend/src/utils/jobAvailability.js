const MS_PER_DAY = 1000 * 60 * 60 * 24;

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const getJobAvailability = (job = {}) => {
  if (job.availability) return job.availability;

  const now = new Date();
  const start = asDate(job.applicationStartDate);
  const deadline = asDate(job.applicationDeadline);

  if (job.status && job.status !== "active") {
    return {
      status: "inactive",
      label: "Inactive",
      canApply: false,
      reason: "This recruitment is not accepting applications.",
      daysLeft: null,
    };
  }

  if (start && now < start) {
    return {
      status: "not_open",
      label: "Not Open Yet",
      canApply: false,
      reason: "Application window has not opened yet.",
      daysUntilOpen: Math.max(0, Math.ceil((start - now) / MS_PER_DAY)),
      daysLeft: deadline ? Math.ceil((deadline - now) / MS_PER_DAY) : null,
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
    daysLeft: deadline ? Math.ceil((deadline - now) / MS_PER_DAY) : null,
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
      type: "view",
      label: "View Application",
      canClick: true,
      tone:
        status === "rejected"
          ? "red"
          : status === "approved" || status === "verified"
            ? "green"
            : "blue",
      reason: "Application already exists for this recruitment.",
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
  if (action.tone === "blue") return `${base} bg-blue-600 hover:bg-blue-700 text-white`;
  if (action.tone === "amber") return `${base} bg-amber-500 hover:bg-amber-600 text-white`;
  if (action.tone === "red") return `${base} bg-red-600 hover:bg-red-700 text-white`;
  return `${base} bg-[#f97316] hover:bg-orange-600 text-white`;
};

