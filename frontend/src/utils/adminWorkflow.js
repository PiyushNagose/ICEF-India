import { formatJobStatus, getEffectiveJobStatus } from "./jobAvailability";

export const getEntityId = (value) =>
  String(value?._id || value?.id || value || "");

export const isJobAdvertisementConfigured = (job) => {
  if (!job?._id) return false;
  const posts = Array.isArray(job.posts) ? job.posts : [];
  const hasVacancies =
    Number(job.totalPosts || 0) > 0 ||
    posts.some((post) => Number(post.vacancies || 0) > 0);

  return Boolean(
    job.title &&
      job.postCode &&
      job.department &&
      hasVacancies &&
      job.applicationStartDate &&
      job.applicationDeadline,
  );
};

export const isAdmitFormatConfigured = (schedule) => {
  if (!schedule) return false;
  const hasTemplate = Boolean(
    schedule.admitCardTemplate ||
      schedule.admitCardTemplateConfig?.templateId ||
      schedule.admitCardTemplateConfig?.baseLayout,
  );

  return Boolean(
    schedule.examName &&
      schedule.examDate &&
      schedule.reportingTime &&
      schedule.examStartTime &&
      hasTemplate,
  );
};

export const isCenterSelectionConfigured = (schedule, centers = []) => {
  const selectedCenterIds = (schedule?.selectedCenterIds || []).map(getEntityId);
  if (!selectedCenterIds.length) return false;
  if (!centers.length) return true;

  const selected = centers.filter((center) =>
    selectedCenterIds.includes(getEntityId(center)),
  );
  return selected.some(
    (center) =>
      center.active !== false && Number(center.totalCapacity || center.capacity || 0) > 0,
  );
};

export const pickDefaultAdminJob = (jobs = []) => {
  const sorted = [...jobs].sort((a, b) => {
    const aTime = new Date(a?.updatedAt || a?.createdAt || 0).getTime() || 0;
    const bTime = new Date(b?.updatedAt || b?.createdAt || 0).getTime() || 0;
    return bTime - aTime;
  });

  return (
    sorted.find((job) => getEffectiveJobStatus(job) === "active") ||
    sorted.find(isJobAdvertisementConfigured) ||
    sorted[0] ||
    null
  );
};

export const buildAdminJobWorkflow = ({
  project,
  job,
  schedules = [],
  centers = [],
  admitPhaseActive = false,
} = {}) => {
  const landingComplete = Boolean(
    project?.workflowReadiness?.checks?.find((check) => check.key === "landing")?.complete ||
      project?.isPublished,
  );
  const jobComplete = isJobAdvertisementConfigured(job);
  const selectedSchedules = job?._id
    ? schedules.filter((schedule) => getEntityId(schedule.jobId) === getEntityId(job._id))
    : [];
  const admitFormatComplete = selectedSchedules.some(isAdmitFormatConfigured);
  const centersComplete = selectedSchedules.some((schedule) =>
    isCenterSelectionConfigured(schedule, centers),
  );
  const storedStatus = String(job?.status || "").toLowerCase();
  const wasPublished = ["active", "closed", "published"].includes(storedStatus);
  const effectiveStatus = getEffectiveJobStatus(job || {});
  const publishComplete = Boolean(
    project?.isPublished && job?._id && wasPublished && effectiveStatus === "active",
  );
  const amendmentMode = Boolean(
    project?.isPublished && job?._id && wasPublished && effectiveStatus === "closed",
  );
  const reviewReady = landingComplete && jobComplete;
  const admitOptional = !admitPhaseActive;

  const checks = [
    {
      key: "landing",
      label: "Landing CMS",
      complete: landingComplete,
      message: landingComplete
        ? "Project landing page is published."
        : "Publish the project landing CMS.",
    },
    {
      key: "job",
      label: "Job Advertisement",
      complete: jobComplete,
      message: jobComplete
        ? "Selected job advertisement is configured."
        : "Complete this job advertisement.",
    },
    {
      key: "admit-format",
      label: "Admit Format",
      complete: admitFormatComplete,
      optional: admitOptional,
      message: admitFormatComplete
        ? "Admit-card format and exam details are configured."
        : admitOptional
          ? "Can be configured later before admit-card release."
          : "Required before admit-card release or allocation.",
    },
    {
      key: "centers",
      label: "Centers",
      complete: centersComplete,
      optional: admitOptional,
      message: centersComplete
        ? "Centers with usable capacity are selected for this job."
        : admitOptional
          ? "Can be selected later before seat allocation."
          : "Select centers with usable capacity before allocation.",
    },
    {
      key: "review",
      label: "Final Review",
      complete: Boolean(reviewReady || publishComplete),
      message: reviewReady
        ? "Selected job is ready for publish."
        : "Verify the selected job before publishing.",
    },
    {
      key: "publish",
      label: amendmentMode ? "Verify Amendment" : "Publish Job",
      complete: publishComplete,
      message: publishComplete
        ? "This job is live on the project public URL."
        : amendmentMode
          ? "Verify the extended job window on the public URL."
          : "Publish this job after final review.",
    },
  ];
  const blockingChecks = checks.filter((check) => !check.optional);

  return {
    complete: blockingChecks.every((check) => check.complete),
    readyToPublish: reviewReady,
    publishComplete,
    amendmentMode,
    effectiveStatus,
    statusLabel: formatJobStatus(job),
    checks,
    completedCount: checks.filter((check) => check.complete).length,
    totalCount: checks.length,
    completedRequiredCount: blockingChecks.filter((check) => check.complete).length,
    totalRequiredCount: blockingChecks.length,
    missingRequired: blockingChecks.filter((check) => !check.complete),
    nextLabel: checks.find((check) => !check.complete)?.label || "Live",
  };
};
