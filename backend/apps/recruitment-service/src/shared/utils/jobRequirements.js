const isBlank = (value) =>
  value === undefined ||
  value === null ||
  value === "" ||
  (typeof value === "string" && value.trim() === "");

const hasAnyValue = (value) => {
  if (Array.isArray(value)) return value.some(hasAnyValue);
  if (value && typeof value === "object") {
    return Object.values(value).some(hasAnyValue);
  }
  return !isBlank(value);
};

const numberValue = (value) => {
  if (isBlank(value)) return undefined;
  const next = Number(value);
  return Number.isFinite(next) ? next : undefined;
};

const validateCriteriaGroup = (group = {}, label, errors) => {
  if (!group.required) return;
  const criteria = Array.isArray(group.criteria) ? group.criteria : [];
  if (!criteria.length) {
    errors.push(`${label}: add at least one criterion`);
    return;
  }

  criteria.forEach((criterion, index) => {
    const row = `${label} criterion ${index + 1}`;
    if (isBlank(criterion.label)) errors.push(`${row}: name is required`);
    if (
      isBlank(criterion.value) &&
      isBlank(criterion.male) &&
      isBlank(criterion.female)
    ) {
      errors.push(`${row}: value is required`);
    }
  });
};

const validateJobConfiguration = (jobLike = {}, { forPublish = true } = {}) => {
  const errors = [];
  const job = typeof jobLike.toObject === "function" ? jobLike.toObject() : jobLike;

  if (isBlank(job.projectId)) errors.push("Project is required");
  if (isBlank(job.title)) errors.push("Advertisement / exam title is required");
  if (isBlank(job.postCode)) errors.push("Advertisement / exam code is required");
  if (isBlank(job.department)) errors.push("Department is required");

  const posts = Array.isArray(job.posts) ? job.posts : [];
  if (!posts.length) {
    errors.push("At least one post/designation is required");
  } else {
    posts.forEach((post, index) => {
      const label = `Post ${index + 1}`;
      if (isBlank(post.title)) errors.push(`${label}: title is required`);
      if (isBlank(post.designation)) errors.push(`${label}: designation is required`);
      if ((numberValue(post.vacancies) || 0) < 1) {
        errors.push(`${label}: vacancies must be at least 1`);
      }
    });
  }

  if (forPublish) {
    [
      ["Application start date", job.applicationStartDate],
      ["Application deadline", job.applicationDeadline],
      ["Correction start date", job.correctionStartDate],
      ["Correction deadline", job.correctionDeadline],
      ["Admit card release date", job.admitCardReleaseDate],
      ["Tentative exam date", job.examDate],
      ["Result publish date", job.resultDate],
    ].forEach(([label, value]) => {
      if (isBlank(value)) errors.push(`${label} is required`);
    });
  }

  const minAge = numberValue(job.ageLimit?.min);
  const maxAge = numberValue(job.ageLimit?.max);
  if (minAge !== undefined || maxAge !== undefined) {
    if (minAge === undefined) errors.push("Minimum age is required");
    if (maxAge === undefined) errors.push("Maximum age is required");
    if (minAge !== undefined && maxAge !== undefined && maxAge < minAge) {
      errors.push("Maximum age cannot be less than minimum age");
    }
  }

  if (job.experience?.required) {
    if ((numberValue(job.experience.years) || 0) < 1) {
      errors.push("Experience years is required");
    }
    if (isBlank(job.experience.type)) errors.push("Experience type is required");
  }

  validateCriteriaGroup(job.physicalStandards, "Physical standards", errors);
  validateCriteriaGroup(job.medicalStandards, "Medical standards", errors);

  const formSections = Array.isArray(job.formSections) ? job.formSections : [];
  formSections.forEach((section, sectionIndex) => {
    const sectionLabel = section.title || `Form section ${sectionIndex + 1}`;
    if (isBlank(section.title)) errors.push(`Form section ${sectionIndex + 1}: title is required`);

    const fields = Array.isArray(section.fields) ? section.fields : [];
    fields.forEach((field, fieldIndex) => {
      const fieldLabel = `${sectionLabel} field ${fieldIndex + 1}`;
      if (isBlank(field.label)) errors.push(`${fieldLabel}: label is required`);
      if (isBlank(field.type)) errors.push(`${fieldLabel}: type is required`);
      if (["select", "radio"].includes(field.type)) {
        const options = Array.isArray(field.options)
          ? field.options.filter((option) => !isBlank(option))
          : [];
        if (options.length < 2) {
          errors.push(`${field.label || fieldLabel}: add at least two options`);
        }
      }
      if (field.type === "file") {
        const maxSizeKB = numberValue(field.validation?.maxSizeKB);
        if (!maxSizeKB || maxSizeKB < 1) {
          errors.push(`${field.label || fieldLabel}: max file size in KB is required`);
        }
      }
      const min = numberValue(field.validation?.min);
      const max = numberValue(field.validation?.max);
      if (min !== undefined && max !== undefined && max < min) {
        errors.push(`${field.label || fieldLabel}: validation max cannot be less than min`);
      }
    });
  });

  const documents = Array.isArray(job.documentRequirements)
    ? job.documentRequirements
    : [];
  documents.forEach((doc, index) => {
    const label = doc.name || `Document ${index + 1}`;
    if (isBlank(doc.name)) errors.push(`Document ${index + 1}: name is required`);
    if (!Array.isArray(doc.formats) || doc.formats.length === 0) {
      errors.push(`${label}: allowed formats are required`);
    }
    const maxSizeKB = numberValue(doc.maxSizeKB);
    if (!maxSizeKB || maxSizeKB < 1) {
      errors.push(`${label}: max file size in KB is required`);
    }
  });

  const feeValues = [
    job.applicationFee?.general,
    job.applicationFee?.obc,
    job.applicationFee?.scSt,
    job.applicationFee?.ews,
    job.applicationFee?.pwd,
    job.paymentConfig?.applicationFee,
    job.paymentConfig?.processingFee,
  ].map((value) => numberValue(value) || 0);
  const payable = feeValues.some((value) => value > 0);
  if (forPublish && numberValue(job.applicationFee?.general) === undefined) {
    errors.push("General application fee is required");
  }
  if (payable) {
    const methods = Array.isArray(job.paymentConfig?.paymentMethods)
      ? job.paymentConfig.paymentMethods.filter(Boolean)
      : [];
    if (!methods.length) errors.push("At least one payment method is required");
    if (isBlank(job.paymentConfig?.paymentDeadline) && isBlank(job.applicationDeadline)) {
      errors.push("Payment deadline is required");
    }
  }

  return [...new Set(errors)];
};

const validateCandidateApplicationForJob = (app) => {
  const errors = [];
  const personal = app.personalDetails || {};
  const education = app.education || {};
  const additionalInfo = app.additionalInfo || {};
  const address = app.address || {};
  const permanent = address.permanent || {};
  const correspondence = address.sameAsPermanent
    ? permanent
    : address.correspondence || {};

  [
    ["Full name", personal.fullName],
    ["Date of birth", personal.dateOfBirth],
    ["Gender", personal.gender],
    ["Category", personal.category],
    ["Registered mobile", personal.registeredMobile],
  ].forEach(([label, value]) => {
    if (isBlank(value)) errors.push(`${label} is required`);
  });

  ["addressLine1", "state", "district", "pincode"].forEach((key) => {
    if (isBlank(permanent[key])) errors.push(`Permanent ${key} is required`);
  });
  ["addressLine1", "state", "district", "pincode"].forEach((key) => {
    if (isBlank(correspondence[key])) errors.push(`Correspondence ${key} is required`);
  });

  const requiredEducation = app.jobId?.education?.essential || [];
  if (requiredEducation.length > 0 && !hasAnyValue(education)) {
    errors.push("Education details are required for this job");
  }
  [
    ["10th education", education.tenth, ["board", "school", "year", "percentage"]],
    ["12th education", education.twelfth, ["board", "school", "year", "percentage"]],
    ["Graduation", education.graduation, ["degree", "university", "year", "percentage"]],
  ].forEach(([label, section, fields]) => {
    if (!hasAnyValue(section)) return;
    fields.forEach((field) => {
      if (isBlank(section?.[field])) errors.push(`${label}: ${field} is required`);
    });
  });

  if (additionalInfo.isGovtEmployee) {
    if (isBlank(additionalInfo.departmentName)) {
      errors.push("Department name is required for government employees");
    }
    if ((numberValue(additionalInfo.yearsOfService) || 0) < 1) {
      errors.push("Years of service is required for government employees");
    }
  }

  if (additionalInfo.isPwD) {
    if (isBlank(additionalInfo.disabilityType)) {
      errors.push("Disability type is required for PwD candidates");
    }
    const disabilityPercentage = numberValue(additionalInfo.disabilityPercentage);
    if (!disabilityPercentage || disabilityPercentage < 1 || disabilityPercentage > 100) {
      errors.push("Valid disability percentage is required for PwD candidates");
    }
  }

  const posts = Array.isArray(app.jobId?.posts) ? app.jobId.posts : [];
  if (posts.length > 0 && (!Array.isArray(app.appliedPosts) || app.appliedPosts.length === 0)) {
    errors.push("Select at least one post");
  }

  if (isBlank(app.declaration)) errors.push("Declaration is required");

  return [...new Set(errors)];
};

module.exports = {
  validateJobConfiguration,
  validateCandidateApplicationForJob,
};
