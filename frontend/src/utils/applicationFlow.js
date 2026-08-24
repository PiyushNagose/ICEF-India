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

export const getPaymentTiming = (jobOrApplication, application = {}) => {
  const job = normaliseJob(jobOrApplication);
  const timing =
    job?.paymentConfig?.paymentTiming ||
    application?.paymentTiming ||
    job?.paymentTiming ||
    "final";
  return ["after_personal", "step1"].includes(timing)
    ? "after_personal"
    : "final";
};

export const buildApplicationSteps = (jobOrApplication, application = {}) => {
  const job = normaliseJob(jobOrApplication);
  const includePayment = hasPaymentStep(job, application);
  const paymentTiming = getPaymentTiming(job, application);

  const steps = [];
  const addStep = (step) => {
    steps.push({
      ...step,
      id: steps.length + 1,
    });
  };

  // All 9 fixed steps + dynamic custom form sections inserted between Address and Documents
  addStep({
    type: "personal-details",
    name: "Personal Details",
    path: "/application/personal-details",
  });

  if (includePayment && paymentTiming === "after_personal") {
    addStep({
      type: "payment",
      name: "Payment",
      path: "/application/payment",
    });
  }

  addStep({
    type: "education",
    name: "Educational Info",
    path: "/application/education",
  });
  addStep({
    type: "additional-info",
    name: "Additional Information",
    path: "/application/additional-info",
  });
  addStep({
    type: "address",
    name: "Address Details",
    path: "/application/address",
  });

  // Insert custom form sections if admin configured them (between Address and Documents)
  const formSections = getJobFormSections(job);
  if (formSections.length > 0) {
    formSections.forEach((section, index) => {
      addStep({
        type: "form-section",
        name: section.title || `Form Section ${index + 1}`,
        path: `/application/form-responses?section=${index}`,
        sectionIndex: index,
      });
    });
  }

  addStep({
    type: "documents",
    name: "Document Upload",
    path: "/application/documents",
  });

  // Step 6 (or 6+N): Review
  addStep({
    type: "review",
    name: "Review",
    path: "/application/review",
  });

  addStep({
    type: "post-selection",
    name: "Post Selection",
    path: "/application/post-selection",
  });

  if (includePayment && paymentTiming === "final") {
    addStep({
      type: "payment",
      name: "Payment",
      path: "/application/payment",
    });
  }

  // Step 9 (or 9+N): Submit
  addStep({
    type: "success",
    name: "Submit",
    path: "/application/success",
  });

  return steps;
};

export const getFirstApplicationRoute = (jobOrApplication) => {
  const steps = buildApplicationSteps(jobOrApplication, jobOrApplication);
  return steps[0]?.path || "/check-status";
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

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== "";

const normaliseKey = (value = "") =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const isApplicationStepComplete = (step, application = {}) => {
  const job = normaliseJob(application);
  const type = step?.type;

  if (!type) return false;
  if (["submitted", "approved"].includes(String(application?.status || "").toLowerCase())) {
    return true;
  }

  if (type === "personal-details") {
    const personal = application?.personalDetails || {};
    return Boolean(
      hasValue(personal.fullName) &&
        hasValue(personal.dateOfBirth) &&
        hasValue(personal.gender) &&
        hasValue(personal.category) &&
        hasValue(personal.registeredMobile),
    );
  }

  if (type === "payment") {
    return String(application?.paymentStatus || "").toLowerCase() === "paid";
  }

  if (type === "education") {
    const education = application?.education || {};
    return Boolean(
      Object.keys(education).length > 0 ||
        Number(application?.currentStep || 0) > Number(step.id || 0),
    );
  }

  if (type === "additional-info") {
    return Boolean(
      application?.additionalInfo &&
        (Object.keys(application.additionalInfo).length > 0 ||
          Number(application?.currentStep || 0) > Number(step.id || 0)),
    );
  }

  if (type === "address") {
    const permanent = application?.address?.permanent || {};
    return Boolean(
      hasValue(permanent.addressLine1) &&
        hasValue(permanent.state) &&
        hasValue(permanent.district) &&
        hasValue(permanent.pincode),
    );
  }

  if (type === "form-section") {
    const responses = application?.formResponses || {};
    const section = getJobFormSections(job)[step.sectionIndex];
    const requiredFields = Array.isArray(section?.fields)
      ? section.fields.filter((field) => field.required)
      : [];
    if (requiredFields.length === 0) {
      return Number(application?.currentStep || 0) > Number(step.id || 0);
    }
    return requiredFields.every((field) =>
      hasValue(responses[field.id] ?? responses[field.label]),
    );
  }

  if (type === "documents") {
    const requirements = getJobDocumentRequirements(job);
    const requiredDocs = requirements.filter((doc) => doc.required !== false);
    if (requiredDocs.length === 0) return true;
    const uploadedDocs = Array.isArray(application?.documents)
      ? application.documents
      : [];
    return requiredDocs.every((requiredDoc) =>
      uploadedDocs.some(
        (doc) =>
          normaliseKey(doc.type || doc.documentType || doc.id || "") ===
            normaliseKey(requiredDoc.id || requiredDoc.name || "") &&
          ["uploaded", "verified", "pending"].includes(
            String(doc.status || "uploaded").toLowerCase(),
          ),
      ),
    );
  }

  if (type === "review") {
    return (
      hasValue(application?.declaration) ||
      Number(application?.currentStep || 0) > Number(step.id || 0)
    );
  }

  if (type === "post-selection") {
    return Array.isArray(application?.appliedPosts) && application.appliedPosts.length > 0;
  }

  if (type === "success") {
    return ["submitted", "approved"].includes(String(application?.status || "").toLowerCase());
  }

  return Number(application?.currentStep || 0) > Number(step.id || 0);
};

export const getApplicationUnlockedStep = (application = {}, steps = []) => {
  const savedStep = Math.max(Number(application?.currentStep || 1), 1);
  const firstIncomplete = steps.find((step) => !isApplicationStepComplete(step, application));
  const inferredStep = firstIncomplete?.id || steps[steps.length - 1]?.id || savedStep;
  return Math.max(savedStep, inferredStep);
};

export const getNextPendingApplicationStep = (
  application = {},
  steps = [],
  fromStepId = 0,
) =>
  steps.find(
    (step) =>
      Number(step.id || 0) > Number(fromStepId || 0) &&
      !isApplicationStepComplete(step, application),
  ) ||
  steps.find((step) => !isApplicationStepComplete(step, application)) ||
  steps[steps.length - 1];

export const persistApplicationDraft = ({
  applicationId,
  jobId,
  declaration,
  supportTicketId,
  correctionMode,
}) => {
  let draft;
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
