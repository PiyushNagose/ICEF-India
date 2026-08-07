export const APP_DRAFT_KEY = "app_draft";

const normaliseJob = (jobOrApplication) => {
  const job =
    jobOrApplication?.jobId || jobOrApplication?.job || jobOrApplication;
  return job?.job || job;
};

const RESERVED_FORM_SECTION_TITLES = new Set([
  "personal information",
  "personal details",
  "personal info",
  "candidate details",
  "educational info",
  "educational information",
  "education",
  "additional information",
  "additional info",
  "address details",
  "address information",
  "address",
  "document upload",
  "documents",
  "payment",
  "review",
  "post selection",
]);

const normaliseTitle = (title = "") =>
  String(title).trim().toLowerCase().replace(/\s+/g, " ");

export const getJobFormSections = (jobOrApplication) => {
  const job = normaliseJob(jobOrApplication);
  return Array.isArray(job?.formSections)
    ? job.formSections.filter(
        (section) =>
          Array.isArray(section.fields) &&
          section.fields.length > 0 &&
          !section.systemSource &&
          !RESERVED_FORM_SECTION_TITLES.has(normaliseTitle(section.title)),
      )
    : [];
};

export const getJobDocumentRequirements = (jobOrApplication) => {
  const job = normaliseJob(jobOrApplication);
  return Array.isArray(job?.documentRequirements)
    ? job.documentRequirements.filter((doc) => doc?.name)
    : [];
};

export const isCorrectionMode = (application = {}) =>
  ["requested", "in_progress"].includes(application?.correction?.status);

export const hasPaymentStep = (jobOrApplication, application) => {
  if (isCorrectionMode(application)) return false;
  const job = normaliseJob(jobOrApplication);
  const fee =
    application?.totalFee ||
    job?.applicationFee?.general ||
    job?.paymentConfig?.applicationFee ||
    0;
  return Number(fee) >= 0;
};

export const buildApplicationSteps = (jobOrApplication, application = {}) => {
  const job = normaliseJob(jobOrApplication);

  // All 9 fixed steps + dynamic custom form sections inserted between Address and Documents
  const steps = [
    {
      id: 1,
      type: "personal-details",
      name: "Personal Details",
      path: "/application/personal-details",
    },
    {
      id: 2,
      type: "education",
      name: "Educational Info",
      path: "/application/education",
    },
    {
      id: 3,
      type: "additional-info",
      name: "Additional Information",
      path: "/application/additional-info",
    },
    {
      id: 4,
      type: "address",
      name: "Address Details",
      path: "/application/address",
    },
  ];

  // Insert custom form sections if admin configured them (between Address and Documents)
  const formSections = getJobFormSections(job);
  if (formSections.length > 0) {
    formSections.forEach((section, index) => {
      steps.push({
        id: steps.length + 1,
        type: "form-section",
        name: section.title || `Form Section ${index + 1}`,
        path: `/application/form-responses?section=${index}`,
        sectionIndex: index,
      });
    });
  }

  steps.push({
    id: steps.length + 1,
    type: "documents",
    name: "Document Upload",
    path: "/application/documents",
  });

  // Step 6 (or 6+N): Review
  steps.push({
    id: steps.length + 1,
    type: "review",
    name: "Review",
    path: "/application/review",
  });

  steps.push({
    id: steps.length + 1,
    type: "post-selection",
    name: "Post Selection",
    path: "/application/post-selection",
  });

  if (hasPaymentStep(job, application)) {
    steps.push({
      id: steps.length + 1,
      type: "payment",
      name: "Payment",
      path: "/application/payment",
    });
  }

  // Step 9 (or 9+N): Submit
  steps.push({
    id: steps.length + 1,
    type: "success",
    name: "Submit",
    path: "/application/success",
  });

  return steps;
};

export const getFirstApplicationRoute = (jobOrApplication) => {
  const steps = buildApplicationSteps(jobOrApplication, jobOrApplication);
  return steps[0]?.path || "/candidate/applications";
};

export const getRouteForApplicationStep = (
  jobOrApplication,
  currentStep = 1,
) => {
  const app = jobOrApplication?.jobId ? jobOrApplication : null;
  const job = app?.jobId || jobOrApplication;
  const steps = buildApplicationSteps(job, app || jobOrApplication);

  // For fixed 9-step flow, just return the step at currentStep
  // The step validation happens within each page component
  const stepIndex = Math.max(
    0,
    Math.min((currentStep || 1) - 1, steps.length - 1),
  );
  return steps[stepIndex]?.path || getFirstApplicationRoute(job);
};

export const persistApplicationDraft = ({
  applicationId,
  jobId,
  declaration,
  supportTicketId,
  correctionMode,
}) => {
  let draft = {};
  try {
    draft = JSON.parse(sessionStorage.getItem(APP_DRAFT_KEY) || "{}");
  } catch {
    draft = {};
  }
  sessionStorage.setItem(
    APP_DRAFT_KEY,
    JSON.stringify({
      ...draft,
      applicationId: applicationId || draft.applicationId,
      jobId: jobId || draft.jobId,
      declaration: declaration || draft.declaration,
      supportTicketId: supportTicketId || draft.supportTicketId,
      correctionMode:
        correctionMode !== undefined ? correctionMode : draft.correctionMode,
    }),
  );
};

export const readApplicationDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_DRAFT_KEY) || "{}");
  } catch {
    return {};
  }
};
