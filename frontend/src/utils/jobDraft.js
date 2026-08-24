export const JOB_DRAFT_STORAGE_KEY = 'job_draft'

export const JOB_WIZARD_STEPS = [
  { id: 1, key: 'basic-info', path: '/admin/jobs/create/basic-info' },
  { id: 2, key: 'eligibility', path: '/admin/jobs/create/eligibility' },
  { id: 3, key: 'form-builder', path: '/admin/jobs/create/form-builder' },
  { id: 4, key: 'documents', path: '/admin/jobs/create/documents' },
  { id: 5, key: 'payment', path: '/admin/jobs/create/payment' },
  { id: 6, key: 'review', path: '/admin/jobs/create/review' },
]

const getStepById = (id) =>
  JOB_WIZARD_STEPS.find((step) => step.id === Number(id)) || JOB_WIZARD_STEPS[0]

const getStepByKey = (key) =>
  JOB_WIZARD_STEPS.find((step) => step.key === key) || JOB_WIZARD_STEPS[0]

const hasObjectValues = (value = {}) =>
  Object.values(value || {}).some((item) => {
    if (Array.isArray(item)) return item.length > 0
    if (item && typeof item === 'object') return hasObjectValues(item)
    return item !== undefined && item !== null && item !== ''
  })

export const readJobDraft = () => {
  try {
    return JSON.parse(sessionStorage.getItem(JOB_DRAFT_STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

export const writeJobDraft = (draft) => {
  const next = {
    ...draft,
    updatedAt: new Date().toISOString(),
  }
  sessionStorage.setItem(JOB_DRAFT_STORAGE_KEY, JSON.stringify(next))
  return next
}

export const getJobWizardPath = (stepKeyOrId = 'basic-info', projectId = '', jobId = '') => {
  const step =
    typeof stepKeyOrId === 'number' ? getStepById(stepKeyOrId) : getStepByKey(stepKeyOrId)
  const params = new URLSearchParams()
  if (projectId) params.set('project', projectId)
  if (jobId) params.set('job', jobId)
  const query = params.toString()
  return `${step.path}${query ? `?${query}` : ''}`
}

export const inferJobWizardCompletedStep = (draft = {}) => {
  if (!draft.projectId || !draft.title || !draft.postCode || !draft.department || !draft.posts?.length) {
    return 0
  }
  if (
    !hasObjectValues(draft.ageLimit) &&
    !hasObjectValues(draft.education) &&
    !hasObjectValues(draft.experience) &&
    !hasObjectValues(draft.physicalStandards) &&
    !hasObjectValues(draft.medicalStandards) &&
    !draft.otherRequirements?.length
  ) {
    return 1
  }
  if (!draft.formSections?.length) return 2
  if (!draft.documentRequirements?.length) return 3
  if (!hasObjectValues(draft.paymentConfig)) return 4
  return 5
}

export const getJobDraftResumeStep = (draft = {}) => {
  if (draft.resumeStep) return draft.resumeStep
  const completedStep = Math.max(
    Number(draft.completedStep) || 0,
    inferJobWizardCompletedStep(draft),
  )
  return getStepById(Math.min(completedStep + 1, JOB_WIZARD_STEPS.length)).key
}

export const getJobDraftResumePath = (draft = {}, { jobId } = {}) => {
  const path = getJobWizardPath(getJobDraftResumeStep(draft), draft.projectId)
  const nextJobId = jobId || draft._jobId || ''
  return `${path}${nextJobId ? `${path.includes('?') ? '&' : '?'}job=${encodeURIComponent(nextJobId)}` : ''}`
}

export const saveJobDraftProgress = (patch = {}, { currentStep, completedStep, projectId } = {}) => {
  const existing = readJobDraft()
  const previousCompleted = Number(existing.completedStep) || inferJobWizardCompletedStep(existing)
  const nextCompleted =
    completedStep !== undefined ? Math.max(previousCompleted, Number(completedStep) || 0) : previousCompleted
  const resumeStep = completedStep !== undefined
    ? getStepById(Math.min(nextCompleted + 1, JOB_WIZARD_STEPS.length)).key
    : getStepById(currentStep || Math.max(nextCompleted + 1, 1)).key

  return writeJobDraft({
    ...existing,
    ...patch,
    projectId: projectId || patch.projectId || existing.projectId,
    completedStep: nextCompleted,
    resumeStep,
  })
}

export const toJobDraftPayload = (job = {}) => {
  const projectId = job.projectId?._id || job.projectId || ''
  const draft = {
    _jobId: job._id,
    status: job.status || 'draft',
    projectId,
    title: job.title || '',
    postCode: job.postCode || '',
    department: job.department || '',
    category: job.category || 'General',
    jobType: job.jobType || 'Permanent',
    description: job.description || '',
    totalPosts: job.totalPosts || '',
    posts: Array.isArray(job.posts) ? job.posts : [],
    postSelectionMode: job.postSelectionMode || 'single',
    reservedPosts: job.reservedPosts || {},
    applicationFee: job.applicationFee || {},
    applicationStartDate: job.applicationStartDate || '',
    applicationDeadline: job.applicationDeadline || '',
    correctionStartDate: job.correctionStartDate || '',
    correctionDeadline: job.correctionDeadline || '',
    admitCardReleaseDate: job.admitCardReleaseDate || '',
    examDate: job.examDate || '',
    resultDate: job.resultDate || '',
    ageLimit: job.ageLimit || {},
    standardPresetId: job.standardPresetId?._id || job.standardPresetId || '',
    education: job.education || {},
    experience: job.experience || {},
    physicalStandards: job.physicalStandards || {},
    medicalStandards: job.medicalStandards || {},
    otherRequirements: job.otherRequirements || [],
    formSections: job.formSections || [],
    documentRequirements: job.documentRequirements || [],
    paymentConfig: job.paymentConfig || {},
  }

  return {
    ...draft,
    completedStep: inferJobWizardCompletedStep(draft),
    resumeStep: getJobDraftResumeStep(draft),
  }
}
