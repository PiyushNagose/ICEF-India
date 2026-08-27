import { CheckCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent } from '../../components/ui/Card'
import ProjectFlowNav from '../../components/admin/ProjectFlowNav'
import { adminService } from '../../services/admin.service'
import {
  getJobWizardPath,
  inferJobWizardCompletedStep,
  readJobDraft,
} from '../../utils/jobDraft'

const steps = [
  { id: 1, name: 'Basic Info',    path: '/admin/jobs/create/basic-info' },
  { id: 2, name: 'Eligibility',  path: '/admin/jobs/create/eligibility' },
  { id: 3, name: 'Form Builder', path: '/admin/jobs/create/form-builder' },
  { id: 4, name: 'Documents',    path: '/admin/jobs/create/documents' },
  { id: 5, name: 'Payment',      path: '/admin/jobs/create/payment' },
  { id: 6, name: 'Review',       path: '/admin/jobs/create/review' },
]

const isJobAdvertisementConfigured = (job) => {
  if (!job?._id) return false
  const posts = Array.isArray(job.posts) ? job.posts : []
  const hasVacancies =
    Number(job.totalPosts || 0) > 0 ||
    posts.some((post) => Number(post.vacancies || 0) > 0)

  return Boolean(
    job.title &&
      job.postCode &&
      job.department &&
      hasVacancies &&
      job.applicationStartDate &&
      job.applicationDeadline,
  )
}

const getEntityId = (value) => String(value?._id || value?.id || value || '')

/**
 * Shared 6-step progress stepper for the Job creation flow.
 *
 * @param {number}  currentStep  - The current active step (1-6)
 * @param {string}  [projectId]  - Optional project query param, forwarded on navigation
 * @param {boolean} [clickable]  - If true, completed steps are clickable navigation links
 */
const JobStepProgress = ({ currentStep, projectId, clickable = false }) => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const draft = readJobDraft()
  const routeJobId = searchParams.get('job') || ''
  const draftMatchesProject =
    !projectId || !draft?.projectId || String(draft.projectId) === String(projectId)
  const draftMatchesJob =
    !routeJobId || !draft?._jobId || String(draft._jobId) === String(routeJobId)
  const draftMatchesContext = draftMatchesProject && draftMatchesJob
  const jobId = routeJobId || (draftMatchesContext ? draft?._jobId || null : null)
  const draftCompletedStep = draftMatchesContext
    ? Math.max(Number(draft.completedStep) || 0, inferJobWizardCompletedStep(draft))
    : 0
  const { data: projectData } = useQuery({
    queryKey: ['admin-project-flow', projectId],
    queryFn: () => adminService.getProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 30000,
  })
  const { data: jobData } = useQuery({
    queryKey: ['admin-job-flow', jobId],
    queryFn: () => adminService.getAdminJob(jobId),
    enabled: Boolean(jobId),
    staleTime: 30000,
  })
  const { data: selectedJobSchedulesData } = useQuery({
    queryKey: ['admin-project-job-schedules', projectId, jobId],
    queryFn: () =>
      adminService.getExamSchedules({
        projectId,
        ...(jobId ? { jobId } : {}),
        limit: 100,
      }),
    enabled: Boolean(projectId && jobId),
    staleTime: 30000,
  })

  const selectedJobSchedulesRaw = Array.isArray(selectedJobSchedulesData)
    ? selectedJobSchedulesData
    : selectedJobSchedulesData?.schedules || []

  const selectedJobSchedules = jobId
    ? selectedJobSchedulesRaw.filter(
        (schedule) => getEntityId(schedule.jobId) === getEntityId(jobId),
      )
    : selectedJobSchedulesRaw

  const project = projectData?.project || projectData
  const job = jobData?.job || jobData
  const landingComplete = Boolean(
    project?.workflowReadiness?.checks?.find((check) => check.key === 'landing')?.complete ||
      project?.isPublished,
  )
  const jobIsPublished = Boolean(
    job?._id &&
      String(job.status || '').toLowerCase() === 'active',
  )
  const jobComplete = isJobAdvertisementConfigured(job)

  const admitFormatComplete = selectedJobSchedules.some(
    (schedule) =>
      schedule?.examName &&
      schedule?.examDate &&
      Array.isArray(schedule?.instructions) &&
      schedule.instructions.length > 0,
  )

  const centersComplete = selectedJobSchedules.some(
    (schedule) => Array.isArray(schedule?.selectedCenterIds) && schedule.selectedCenterIds.length > 0,
  )

  const workflowProject = project
    ? {
        ...project,
        isPublished: jobIsPublished,
        workflowReadiness: {
          complete: false,
          checks: [
            {
              key: 'landing',
              label: 'Landing CMS',
              complete: landingComplete,
            },
            {
              key: 'job',
              label: 'Job Advertisement',
              complete: jobComplete,
            },
            {
              key: 'admit-format',
              label: 'Admit Format',
              complete: admitFormatComplete,
              optional: true,
            },
            {
              key: 'centers',
              label: 'Centers',
              complete: centersComplete,
              optional: true,
            },
            {
              key: 'review',
              label: 'Final Review',
              complete: false,
            },
            {
              key: 'publish',
              label: 'Publish Job',
              complete: jobIsPublished,
            },
          ],
        },
      }
    : project

  const handleStepClick = (step) => {
    if (!clickable) return
    if (step.id < currentStep) {
      navigate(
        getJobWizardPath(step.id, projectId, jobId, {
          returnToReview:
            currentStep === steps.length || searchParams.get('returnTo') === 'review',
        }),
      )
    }
  }

  return (
    <>
      {projectId && (
        <ProjectFlowNav
          project={workflowProject}
          current="job"
          className="mb-4"
          workflowScope="job"
          publishComplete={draftMatchesContext && jobIsPublished}
          jobId={job?._id}
          contextLabel="Current Job"
          contextValue={job
            ? `${job.title}${job.postCode ? ` - ${job.postCode}` : ''}`
            : draftMatchesContext && draft?.projectId
              ? 'Draft job'
              : 'New job'}
        />
      )}
      <Card>
        <CardContent className="p-4 sm:p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium text-gray-500">
              Step {currentStep} of {steps.length}
            </span>
          </div>

          {/* Steps */}
          <div className="grid w-full min-w-[760px] grid-cols-[repeat(11,minmax(0,1fr))] items-center gap-2 overflow-x-auto pb-1 sm:min-w-0">
            {steps.map((step, index) => {
              const isActive    = step.id === currentStep
              const isCompleted = step.id < currentStep || step.id <= draftCompletedStep
              const activeComplete = isActive && isCompleted
              const isClickable = clickable && isCompleted && !isActive

              return (
                <>
                  {/* Circle + label */}
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(step)}
                    disabled={!isClickable}
                    className={`group flex min-w-0 items-center gap-2 justify-self-start ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div
                      className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                        isCompleted
                          ? activeComplete
                            ? 'bg-orange-600 text-white shadow-md ring-4 ring-orange-100'
                            : 'bg-green-600 text-white shadow-sm'
                          : isActive
                          ? 'bg-orange-600 text-white shadow-md ring-4 ring-orange-100'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        step.id
                      )}
                    </div>
                    <span
                      className={`hidden min-w-0 truncate text-xs font-semibold transition-colors sm:block ${
                        isCompleted
                          ? activeComplete
                            ? 'text-orange-600'
                            : 'text-green-600'
                          : isActive
                          ? 'text-orange-600'
                          : 'text-gray-400'
                      } ${isClickable ? 'group-hover:text-orange-500' : ''}`}
                    >
                      {step.name}
                    </span>
                  </button>

                  {/* Connector line */}
                  {index < steps.length - 1 && (
                    <div
                      key={`${step.id}-line`}
                      className={`h-0.5 min-w-[18px] rounded-full transition-colors duration-200 ease-out ${
                        isCompleted ? 'bg-green-400' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </>
              )
            })}
          </div>

          {/* Mobile: show current step name below the bar */}
          <p className="sm:hidden text-xs font-medium text-orange-600 mt-3 text-center">
            {steps[currentStep - 1]?.name}
          </p>
        </CardContent>
      </Card>
    </>
  )
}

export default JobStepProgress
