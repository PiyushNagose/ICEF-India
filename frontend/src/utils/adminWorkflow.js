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

export const isAdmitSetupVerified = (schedule) => {
  if (!schedule?.admitSetupVerifiedAt) return false;
  const verifiedAt = new Date(schedule.admitSetupVerifiedAt).getTime();
  const updatedAt = new Date(schedule.updatedAt || schedule.createdAt || 0).getTime();
  if (!verifiedAt) return false;
  return !updatedAt || updatedAt - verifiedAt <= 2000;
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
  const admitSetupVerified = selectedSchedules.some(
    (schedule) =>
      isAdmitFormatConfigured(schedule) &&
      isCenterSelectionConfigured(schedule, centers) &&
      isAdmitSetupVerified(schedule),
  );
  const storedStatus = String(job?.status || "").toLowerCase();
  const wasPublished = ["active", "closed", "published"].includes(storedStatus);
  const effectiveStatus = getEffectiveJobStatus(job || {});
  
  // Unverified changes: if a published job is updated, its updatedAt will be greater than publishedAt
  // We use a 2000ms buffer to account for mongoose simultaneous save timing differences
  const updatedAt = new Date(job?.updatedAt || 0).getTime();
  const publishedAt = new Date(job?.publishedAt || 0).getTime();
  const hasUnverifiedChanges = wasPublished && (updatedAt - publishedAt > 2000);

  const publicJobLive = Boolean(
    project?.isPublished && job?._id && wasPublished && effectiveStatus === "active",
  );
  
  const amendmentMode = Boolean(
    hasUnverifiedChanges || 
    (project?.isPublished && job?._id && wasPublished && effectiveStatus === "closed")
  );

  const admitOptional = !admitPhaseActive;
  const requiredSetupComplete =
    landingComplete &&
    jobComplete &&
    (admitOptional || (admitFormatComplete && centersComplete));
  
  const reviewReady = requiredSetupComplete;
  
  const releaseVerified = admitPhaseActive ? admitSetupVerified : !hasUnverifiedChanges;
  const publishComplete = publicJobLive && requiredSetupComplete && releaseVerified;

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
      complete: publishComplete,
      message: reviewReady
        ? admitOptional
          ? "Selected job is ready for publish."
          : "Selected job is ready for admit-card review."
        : admitOptional
          ? "Verify the selected job before publishing."
          : "Complete admit format and centers before final review.",
    },
    {
      key: "publish",
      label: admitPhaseActive
        ? "Verify Admit Setup"
        : amendmentMode
          ? "Verify Amendment"
          : "Publish Job",
      complete: publishComplete,
      message: publishComplete
        ? admitPhaseActive
          ? "Latest admit-card setup is verified."
          : "This job is live on the project public URL."
        : admitPhaseActive
          ? "Verify the latest admit-card format and center setup."
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
    admitSetupVerified,
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
