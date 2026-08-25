import {
  BadgeCheck,
  Building2,
  Check,
  FileBadge,
  FileText,
  FolderKanban,
  Globe2,
  Send,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const getProjectId = (project) => project?._id || project?.id;

const getWorkflowCompleteMap = (project) => {
  const checks = project?.workflowReadiness?.checks || [];
  return new Map(checks.map((check) => [check.key, Boolean(check.complete)]));
};

const getWorkflowOptionalMap = (project) => {
  const checks = project?.workflowReadiness?.checks || [];
  return new Map(checks.map((check) => [check.key, Boolean(check.optional)]));
};

const DO_LATER_TARGETS = {
  "admit-format": "centers",
  centers: "review",
};

const buildSteps = (
  project,
  { workflowScope = "project", publishComplete = false, jobId = "" } = {},
) => {
  const projectId = getProjectId(project);
  const state = encodeURIComponent(project?.state || "All");
  const completeMap = getWorkflowCompleteMap(project);
  const optionalMap = getWorkflowOptionalMap(project);
  const isJobWorkflow = workflowScope === "job";
  const projectPublished = isJobWorkflow
    ? Boolean(publishComplete)
    : Boolean(project?.isPublished);
  const jobQuery = jobId ? `&job=${jobId}` : "";
  const jobStepComplete = completeMap.get("job");
  const admitFormatComplete = completeMap.get("admit-format");
  const centersComplete = completeMap.get("centers");
  const reviewComplete = isJobWorkflow
    ? Boolean(completeMap.get("review"))
    : completeMap.has("review")
      ? completeMap.get("review")
      : Boolean(project?.workflowReadiness?.complete);

  return [
    {
      key: "project",
      label: "Project Details",
      helper: "Identity and timeline",
      icon: FolderKanban,
      path: `/admin/projects/${projectId}`,
      complete: true,
    },
    {
      key: "landing",
      label: "Landing CMS",
      helper: "Public project page",
      icon: Globe2,
      path: `/admin/cms/edit/${state}?project=${projectId}`,
      complete: completeMap.get("landing"),
      optional: optionalMap.get("landing"),
    },
    {
      key: "job",
      label: "Job Advertisement",
      helper: "Posts, form, fees, payment",
      icon: FileText,
      path: `/admin/jobs/create/basic-info?project=${projectId}${jobQuery}`,
      complete: Boolean(jobStepComplete),
      optional: optionalMap.get("job"),
    },
    {
      key: "admit-format",
      label: "Admit Format",
      helper: "Templates and schedule",
      icon: FileBadge,
      path: `/admin/admit-cards?project=${projectId}&focus=template${jobQuery}`,
      complete: Boolean(admitFormatComplete),
      optional: optionalMap.get("admit-format"),
    },
    {
      key: "centers",
      label: "Centers",
      helper: "Rooms and capacity",
      icon: Building2,
      path: `/admin/admit-cards?project=${projectId}&focus=centers${jobQuery}`,
      complete: Boolean(centersComplete),
      optional: optionalMap.get("centers"),
    },
    {
      key: "review",
      label: "Final Review",
      helper: "Verify every section",
      icon: BadgeCheck,
      path: `/admin/projects/${projectId}?review=1${jobQuery}`,
      complete: reviewComplete,
      optional: optionalMap.get("review"),
    },
    {
      key: "publish",
      label: workflowScope === "job" ? "Publish Job" : "Publish / Verify",
      helper:
        workflowScope === "job" ? "Make this job active" : "Release public URL",
      icon: Send,
      path: `/admin/projects/${projectId}?review=1${jobQuery}#publish`,
      complete: projectPublished,
      optional: optionalMap.get("publish"),
    },
  ];
};

const ProjectFlowNav = ({
  project,
  current = "project",
  className = "",
  onStepClick,
  workflowScope = "project",
  publishComplete = false,
  jobId = "",
  contextLabel = "",
  contextValue = "",
}) => {
  const navigate = useNavigate();
  const projectId = getProjectId(project);

  if (!projectId) return null;

  const steps = buildSteps(project, {
    workflowScope,
    publishComplete,
    jobId,
  });
  const completedCount = steps.filter((step) => step.complete).length;
  const currentIndex = steps.findIndex((step) => step.key === current);
  const currentStep = currentIndex >= 0 ? steps[currentIndex] : null;
  const doLaterTargetKey = currentStep ? DO_LATER_TARGETS[currentStep.key] : "";
  const doLaterStep = doLaterTargetKey
    ? steps.find((step) => step.key === doLaterTargetKey)
    : null;
  const nextStepCandidates =
    workflowScope === "project"
      ? steps.filter((step) => !step.optional)
      : steps;
  const nextStep =
    nextStepCandidates
      .slice(currentIndex >= 0 ? currentIndex + 1 : 0)
      .find((step) => !step.complete) ||
    nextStepCandidates.find((step) => !step.complete) ||
    null;
  const nextActionLabel =
    workflowScope === "project" && nextStep?.key === "publish"
      ? "Next: Publish / Verify"
      : workflowScope === "job" && nextStep?.key === "publish"
        ? "Resume Publish Job"
        : `Resume ${nextStep?.label || "Next Step"}`;
  const showDoLater = Boolean(
    currentStep && !currentStep.complete && doLaterStep,
  );

  return (
    <div
      className={`rounded-[24px] border border-orange-100 bg-white p-4 shadow-sm ${className}`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
            {workflowScope === "job" ? "Job workflow" : "Project workflow"}
          </p>
          <h2 className="mt-1 truncate text-lg font-bold text-gray-900">
            {project?.name || "Recruitment Project"}
          </h2>
          {project?.publicSlug && (
            <p className="mt-0.5 truncate font-mono text-xs font-semibold text-orange-500">
              /apply/{project.publicSlug}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {contextValue && (
            <div className="w-fit rounded-full border border-orange-100 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
              {contextLabel ? `${contextLabel}: ` : ""}
              <span className="font-mono">{contextValue}</span>
            </div>
          )}
          <div className="w-fit rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-600">
            {completedCount}/{steps.length} complete
          </div>
          {showDoLater && (
            <button
              type="button"
              onClick={() => {
                if (onStepClick?.(doLaterStep) === false) return;
                navigate(doLaterStep.path);
              }}
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 transition-colors hover:bg-orange-100"
            >
              Do Later
            </button>
          )}
          {nextStep && !nextStep.complete && nextStep.key !== current && (
            <button
              type="button"
              onClick={() => {
                if (onStepClick?.(nextStep) === false) return;
                navigate(nextStep.path);
              }}
              className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-700"
            >
              {nextActionLabel}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[repeat(7,minmax(0,1fr))]">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const active = step.key === current;

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => {
                if (onStepClick?.(step) === false) return;
                navigate(step.path);
              }}
              className={`group flex min-h-[136px] w-full flex-col rounded-2xl border p-4 text-left transition-all ${
                step.complete
                  ? "border-green-200 bg-green-50/50 hover:border-green-300 hover:bg-green-50"
                  : active
                    ? "border-orange-500 bg-orange-50 shadow-[0_12px_26px_rgba(234,88,12,0.12)]"
                    : "border-gray-200 bg-white hover:border-orange-200 hover:bg-orange-50/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none ${
                    step.complete
                      ? "bg-green-600 text-white"
                      : active
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {step.complete ? <Check className="h-4 w-4" /> : index + 1}
                </span>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    step.complete
                      ? "text-green-600"
                      : active
                        ? "text-orange-600"
                        : "text-gray-400 group-hover:text-orange-500"
                  }`}
                />
              </div>
              <div className="mt-4">
                <p className="min-h-10 text-[15px] font-bold leading-5 text-gray-900">
                  {step.label}
                </p>
                <p className="mt-1 text-sm font-normal leading-5 text-gray-500">
                  {step.helper}
                </p>
                <div className="mt-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${
                      step.complete
                        ? "bg-green-100 text-green-700"
                        : active
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {step.complete
                      ? "Completed"
                      : active
                        ? "In progress"
                        : "Pending"}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ProjectFlowNav;
