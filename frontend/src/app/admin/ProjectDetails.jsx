import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import {
  Plus,
  Eye,
  Edit,
  BarChart3,
  HeadphonesIcon,
  FileText,
  FileBadge,
  Loader2,
  Briefcase,
  Building2,
  Users,
  IndianRupee,
  CheckCircle2,
  ClipboardList,
  ArrowRight,
  Copy,
  ExternalLink,
  Globe2,
} from "lucide-react";

import AdminLayout from "../../components/layouts/AdminLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";

import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import CustomSelect from "../../components/ui/CustomSelect";
import { adminService } from "../../services/admin.service";
import ProjectFlowNav from "../../components/admin/ProjectFlowNav";
import {
  getProjectLifecycleStatus,
  getProjectStatusBadgeClass,
} from "../../utils/projectLifecycle";
import {
  JOB_DRAFT_STORAGE_KEY,
  getJobWizardPath,
  getJobDraftResumePath,
  toJobDraftPayload,
} from "../../utils/jobDraft";
import { openProjectPreview } from "../../utils/cmsPreview";

const isJobAdvertisementConfigured = (job) => {
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

const getJobTime = (job) =>
  new Date(job?.createdAt || job?.updatedAt || 0).getTime() || 0;

const getEntityId = (value) =>
  String(value?._id || value?.id || value || "");

const getMostRecentJob = (jobs = []) =>
  [...jobs].sort((a, b) => getJobTime(b) - getJobTime(a))[0] || null;

const getJobWorkflowSummary = (project, job) => {
  const workflows =
    project?.workflowReadiness?.jobWorkflowReadiness ||
    project?.jobWorkflowReadiness ||
    {};
  const workflow = workflows[String(job?._id || "")];
  if (!workflow) {
    return {
      completedCount: String(job?.status || "").toLowerCase() === "active" ? 6 : 0,
      totalCount: 6,
      nextLabel: String(job?.status || "").toLowerCase() === "active" ? "Live" : "Start",
      complete: String(job?.status || "").toLowerCase() === "active",
    };
  }
  const nextCheck = workflow.checks?.find((check) => !check.complete);
  return {
    completedCount: workflow.completedCount ?? workflow.checks?.filter((check) => check.complete).length ?? 0,
    totalCount: workflow.totalCount ?? workflow.checks?.length ?? 6,
    nextLabel: nextCheck?.label || "Live",
    complete: Boolean(workflow.complete || workflow.readyToPublish),
  };
};

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const reviewMode = searchParams.get("review") === "1";
  const [selectedJobId, setSelectedJobId] = useState(searchParams.get("job") || "");
  const [publishedJobIds, setPublishedJobIds] = useState(() => new Set());
  const [projectPublishedLocally, setProjectPublishedLocally] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-project", id],
    queryFn: () => adminService.getProject(id),
  });

  const rawProject = data?.project || data;
  const project = rawProject
    ? { ...rawProject, status: getProjectLifecycleStatus(rawProject) }
    : rawProject;

  const jobs = useMemo(() => project?.jobs || [], [project?.jobs]);
  const selectedJobSummary = useMemo(() => {
    if (jobs.length === 0) return null;
    const explicitJob =
      jobs.find((job) => String(job._id) === String(selectedJobId)) || null;
    if (explicitJob) return explicitJob;

    return getMostRecentJob(jobs);
  }, [jobs, selectedJobId]);
  const { data: selectedJobData } = useQuery({
    queryKey: ["admin-project-selected-job", selectedJobSummary?._id],
    queryFn: () => adminService.getAdminJob(selectedJobSummary._id),
    enabled: Boolean(selectedJobSummary?._id),
    staleTime: 30000,
  });
  const selectedJob = useMemo(() => {
    const hydratedJob = selectedJobData?.job || selectedJobData || null;
    if (
      hydratedJob?._id &&
      selectedJobSummary?._id &&
      String(hydratedJob._id) === String(selectedJobSummary._id)
    ) {
      return {
        ...selectedJobSummary,
        ...hydratedJob,
        status: hydratedJob.status || selectedJobSummary.status,
      };
    }
    return selectedJobSummary;
  }, [selectedJobData, selectedJobSummary]);
  const selectedJobStatus = String(selectedJob?.status || "").toLowerCase();
  const selectedJobIsActive =
    selectedJobStatus === "active" ||
    (selectedJob?._id && publishedJobIds.has(String(selectedJob._id)));
  const { data: selectedJobSchedulesData } = useQuery({
    queryKey: ["admin-project-job-schedules", id, selectedJob?._id],
    queryFn: () =>
      adminService.getExamSchedules({
        projectId: id,
        ...(selectedJob?._id ? { jobId: selectedJob._id } : {}),
        limit: 100,
      }),
    enabled: Boolean(id && selectedJob?._id),
    staleTime: 30000,
  });
  const selectedJobSchedulesRaw = Array.isArray(selectedJobSchedulesData)
    ? selectedJobSchedulesData
    : selectedJobSchedulesData?.schedules || [];
  const selectedJobSchedules = selectedJob?._id
    ? selectedJobSchedulesRaw.filter(
        (schedule) => getEntityId(schedule.jobId) === getEntityId(selectedJob._id),
      )
    : selectedJobSchedulesRaw;

  useEffect(() => {
    if (jobs.length === 0) return;

    const urlJobId = searchParams.get("job") || "";
    const urlJobIsValid = urlJobId
      ? jobs.some((job) => String(job._id) === String(urlJobId))
      : false;
    const selectedJobIdIsValid =
      selectedJobId && jobs.some((job) => String(job._id) === String(selectedJobId));
    const fallbackJob = getMostRecentJob(jobs);
    const syncJobParam = (jobId) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set("job", jobId);
      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString(),
          hash: location.hash,
        },
        { replace: true },
      );
    };

    if (urlJobIsValid) {
      if (selectedJobId !== urlJobId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSelectedJobId(urlJobId);
      }
      return;
    }

    if (selectedJobIdIsValid) {
      if (urlJobId !== String(selectedJobId)) syncJobParam(String(selectedJobId));
      return;
    }

    if (fallbackJob?._id) {
      const fallbackJobId = String(fallbackJob._id);
      if (selectedJobId !== fallbackJobId) {
        setSelectedJobId(fallbackJobId);
      }
      if (urlJobId !== fallbackJobId) syncJobParam(fallbackJobId);
      return;
    }

    if (urlJobId || selectedJobId) {
      setSelectedJobId("");
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("job");
      navigate(
        {
          pathname: location.pathname,
          search: nextParams.toString(),
          hash: location.hash,
        },
        { replace: true },
      );
    }
  }, [jobs, location.hash, location.pathname, location.search, navigate, searchParams, selectedJobId]);

  const isPublished = Boolean(rawProject?.isPublished || projectPublishedLocally);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!projectPublishReady) {
        throw new Error("Publish at least one job before releasing the project URL");
      }
      let publishedProject = rawProject;
      if (!isPublished) {
        const response = await adminService.publishProject(id);
        publishedProject = response?.project || response;
        if (!publishedProject?.isPublished) {
          throw new Error("Project publish did not save. Please try again.");
        }
      }
      return { project: publishedProject };
    },
    onSuccess: ({ project: publishedProject }) => {
      toast.success("Project public URL published");
      setProjectPublishedLocally(Boolean(publishedProject?.isPublished || isPublished));
      queryClient.invalidateQueries({ queryKey: ["admin-project", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["public-projects"] });
      navigate(`/admin/projects/${id}?review=1${selectedJob?._id ? `&job=${selectedJob._id}` : ''}#publish`, { replace: true });
    },
    onError: (error) => {
      toast.error(error?.message || "Unable to publish project");
    },
  });

  const publishSelectedJobMutation = useMutation({
    mutationFn: async () => {
      if (!selectedJob?._id) {
        throw new Error("Select a job before publishing");
      }
      if (!reviewReady) {
        throw new Error("Complete landing CMS and job advertisement first");
      }

      let publishedJob = selectedJob;
      if (!selectedJobIsActive) {
        const jobResponse = await adminService.publishJob(selectedJob._id);
        publishedJob = jobResponse?.job || jobResponse || selectedJob;
      }

      let publishedProject = rawProject;
      if (!isPublished) {
        const projectResponse = await adminService.publishProject(id);
        publishedProject = projectResponse?.project || projectResponse;
        if (!publishedProject?.isPublished) {
          throw new Error("Project publish did not save. Please try again.");
        }
      }

      return { project: publishedProject, job: publishedJob };
    },
    onSuccess: ({ project: publishedProject, job: publishedJob }) => {
      const publishedAt = new Date().toISOString();
      setProjectPublishedLocally(Boolean(publishedProject?.isPublished || isPublished));
      if (selectedJob?._id) {
        setPublishedJobIds((current) => {
          const next = new Set(current);
          next.add(String(selectedJob._id));
          return next;
        });
      }
      queryClient.setQueryData(["admin-project", id], (current) => {
        if (!current) return current;
        const currentProject = current.project || current;
        const nextProject = {
          ...currentProject,
          isPublished: true,
          status: "Active",
          publishedAt: currentProject.publishedAt || publishedAt,
          jobs: (currentProject.jobs || []).map((job) =>
            String(job._id) === String(selectedJob?._id)
              ? { ...job, ...publishedJob, status: "active", publishedAt: job.publishedAt || publishedAt }
              : job,
          ),
        };
        return current.project ? { ...current, project: nextProject } : nextProject;
      });
      queryClient.setQueryData(["admin-project-selected-job", selectedJob?._id], (current) => {
        if (!current) return current;
        const currentJob = current.job || current;
        const nextJob = {
          ...currentJob,
          status: "active",
          publishedAt: currentJob.publishedAt || publishedAt,
        };
        return current.job ? { ...current, job: nextJob } : nextJob;
      });
      toast.success(isPublished ? "Job published on public URL" : "Project and job published");
      queryClient.invalidateQueries({ queryKey: ["admin-project", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-projects"] });
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["admin-project-selected-job", selectedJob?._id] });
      queryClient.invalidateQueries({ queryKey: ["public-projects"] });
      navigate(`/admin/projects/${id}?review=1${selectedJob?._id ? `&job=${selectedJob._id}` : ''}#publish`, { replace: true });
    },
    onError: (error) => {
      toast.error(error?.message || "Unable to publish job");
    },
  });

  if (isLoading) {
    return (
      <AdminLayout title="Project Details">
        <div
          className="
          min-h-full
          flex items-center justify-center
          bg-[#f7f4ee]
        "
        >
          <Loader2
            className="
            w-8 h-8 animate-spin text-orange-600
          "
          />
        </div>
      </AdminLayout>
    );
  }

  if (!project) {
    return (
      <AdminLayout title="Project Details">
        <div className="p-6">
          <p className="text-gray-600">Project not found.</p>

          <Button
            variant="outline"
            onClick={() => navigate("/admin/projects")}
            className="mt-4"
          >
            Back to Projects
          </Button>
        </div>
      </AdminLayout>
    );
  }

  const openJobAdvertisement = async (job, options = {}) => {
    const normalizedOptions =
      typeof options === "string" ? { step: options } : options || {};
    const { mode = "resume", step = "" } = normalizedOptions;

    if (mode === "new") {
      sessionStorage.removeItem(JOB_DRAFT_STORAGE_KEY)
      sessionStorage.setItem(
        JOB_DRAFT_STORAGE_KEY,
        JSON.stringify({ projectId: id }),
      )
      navigate(`/admin/jobs/create/basic-info?project=${id}`)
      return
    }

    const targetJob = job || selectedJob || jobs[0]
    if (!targetJob?._id) {
      sessionStorage.removeItem(JOB_DRAFT_STORAGE_KEY)
      sessionStorage.setItem(
        JOB_DRAFT_STORAGE_KEY,
        JSON.stringify({ projectId: id }),
      )
      navigate(`/admin/jobs/create/basic-info?project=${id}`)
      return
    }

    try {
      const data = await adminService.getAdminJob(targetJob._id)
      const fullJob = data?.job || data
      const draft = toJobDraftPayload(fullJob)
      sessionStorage.setItem(
        JOB_DRAFT_STORAGE_KEY,
        JSON.stringify(draft),
      )
      if (step) {
        navigate(getJobWizardPath(step, id, draft._jobId))
      } else {
        navigate(getJobDraftResumePath(draft))
      }
    } catch (err) {
      toast.error(err.message || "Unable to open job advertisement")
    }
  }

  const statCards = [
    {
      title: "TOTAL JOBS",
      value: project.totalJobs || jobs.length,
      icon: Briefcase,
      bg: "bg-orange-50",
      color: "text-orange-600",
    },
    {
      title: "TOTAL APPLICANTS",
      value: (project.totalApplicants || 0).toLocaleString("en-IN"),
      icon: Users,
      bg: "bg-green-50",
      color: "text-green-600",
    },
    {
      title: "PAID APPLICANTS",
      value: (project.paidApplicants || 0).toLocaleString("en-IN"),
      icon: CheckCircle2,
      bg: "bg-blue-50",
      color: "text-blue-600",
    },
    {
      title: "REVENUE",
      value: `INR ${(project.totalRevenue || 0).toLocaleString("en-IN")}`,
      icon: IndianRupee,
      bg: "bg-purple-50",
      color: "text-purple-600",
    },
  ];

  const quickActions = [
    {
      title: "CREATE JOB",
      icon: Plus,
      color: "bg-orange-100 text-orange-600",
      action: () => openJobAdvertisement(null, { mode: "new" }),
    },
    {
      title: "VIEW APPS",
      icon: Eye,
      color: "bg-blue-100 text-blue-600",
      action: () =>
        navigate(`/admin/applications${selectedJob?._id ? `?job=${selectedJob._id}` : ""}`),
    },
    {
      title: "ANALYTICS",
      icon: BarChart3,
      color: "bg-green-100 text-green-600",
      action: () => navigate("/admin/analytics"),
    },
    {
      title: "SUPPORT",
      icon: HeadphonesIcon,
      color: "bg-purple-100 text-purple-600",
      action: () => navigate("/admin/support"),
    },
  ];

  // isPublished declared earlier
  const publishSectionOpen = location.hash === "#publish";
  const workflowReadiness = rawProject?.workflowReadiness || { complete: false, checks: [] };
  const workflowScope = selectedJob ? "job" : "project";
  const landingComplete = Boolean(
    workflowReadiness.checks?.find((check) => check.key === "landing")?.complete ||
      rawProject?.isPublished,
  );
  const configuredJobCount = jobs.filter((job) => isJobAdvertisementConfigured(job)).length;
  const activeJobCount = jobs.filter(
    (job) => String(job.status || "").toLowerCase() === "active",
  ).length;
  const jobComplete = isJobAdvertisementConfigured(selectedJob);
  const admitFormatComplete = selectedJobSchedules.some(
    (schedule) =>
      schedule?.examName &&
      schedule?.examDate &&
      Array.isArray(schedule?.instructions) &&
      schedule.instructions.length > 0,
  );
  const centersComplete = selectedJobSchedules.some(
    (schedule) => Array.isArray(schedule?.selectedCenterIds) && schedule.selectedCenterIds.length > 0,
  );
  const reviewReady = landingComplete && jobComplete;
  const jobPublishComplete = Boolean(
    selectedJob?._id &&
      selectedJobIsActive &&
      isPublished,
  );
  const publishComplete = selectedJob ? jobPublishComplete : isPublished;
  const projectPublishComplete = Boolean(isPublished && activeJobCount > 0);
  const projectPublishReady = Boolean(landingComplete && activeJobCount > 0);
  const selectedJobWorkflowReadiness = {
    complete: reviewReady && publishComplete,
    checks: [
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
        optional: true,
        message: admitFormatComplete
          ? "Admit-card format and exam details are configured."
          : "Can be configured later before admit-card release.",
      },
      {
        key: "centers",
        label: "Centers",
        complete: centersComplete,
        optional: true,
        message: centersComplete
          ? "Centers are selected for the selected job."
          : "Can be selected later before seat allocation.",
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
        label: "Publish Job",
        complete: publishComplete,
        message: publishComplete
          ? "This job is live on the project public URL."
          : "Publish this job after final review.",
      },
    ],
  };
  const projectWorkflowReadiness = {
    complete: false,
    checks: [
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
        complete: false,
        message: configuredJobCount > 0 || activeJobCount > 0
          ? "Select a job to view its advertisement progress."
          : "Create at least one job advertisement.",
      },
      {
        key: "admit-format",
        label: "Admit Format",
        complete: false,
        message: "Job-specific. Select a job.",
      },
      {
        key: "centers",
        label: "Centers",
        complete: false,
        message: "Job-specific. Select a job.",
      },
      {
        key: "review",
        label: "Final Review",
        complete: false,
        message: "Select a job and review it before publishing.",
      },
      {
        key: "publish",
        label: "Publish / Verify",
        complete: false,
        message: projectPublishComplete
          ? "Project public URL is live. Select a job to manage job publish status."
          : "Release the public URL after a job is live.",
      },
    ],
  };
  const projectMissingWorkflowSteps =
    projectWorkflowReadiness.checks?.filter((check) => !check.complete && !check.optional) || [];

  const workflowNavProject = selectedJob
    ? {
        ...project,
        isPublished: publishComplete,
        workflowReadiness: selectedJobWorkflowReadiness,
      }
    : {
        ...project,
        isPublished: reviewMode && !projectPublishComplete ? false : projectPublishComplete,
        workflowReadiness: projectWorkflowReadiness,
      };

  const reviewItems = [
    {
      title: "Project Details",
      description: "Name, state, department, and dates.",
      icon: Briefcase,
      action: () => navigate(`/admin/projects/${id}/edit`),
    },
    {
      title: "Landing Page CMS",
      description: "Hero, banners, notices, and links.",
      icon: Globe2,
      action: () =>
        navigate(
          `/admin/cms/edit/${encodeURIComponent(project.state || "All")}?project=${id}${selectedJob?._id ? `&job=${selectedJob._id}` : ""}`,
        ),
    },
    {
      title: "Job Advertisement & Payment",
      description: selectedJob
        ? `Current job: ${selectedJob.title}${selectedJob.postCode ? ` (${selectedJob.postCode})` : ""}`
        : `${jobs.length} job${jobs.length === 1 ? "" : "s"} configured.`,
      icon: FileText,
      action: () => openJobAdvertisement(selectedJob, jobs.length ? "review" : "basic-info"),
    },
    {
      title: "Application Form",
      description: selectedJob
        ? `Fields and document rules for ${selectedJob.title}.`
        : "Candidate fields and document rules.",
      icon: ClipboardList,
      action: () => openJobAdvertisement(selectedJob, jobs.length ? "form-builder" : "basic-info"),
    },
    {
      title: "Admit Card Format",
      description: selectedJob
        ? `Templates and schedule for ${selectedJob.title}.`
        : "Templates, schedule, and print setup.",
      icon: FileBadge,
      action: () => navigate(`/admin/admit-cards?project=${id}&focus=template${selectedJob?._id ? `&job=${selectedJob._id}` : ""}`),
    },
    {
      title: "Centers & Seats",
      description: selectedJob
        ? `Centers, rooms, and capacity for ${selectedJob.title}.`
        : "Centers, rooms, and capacity.",
      icon: Building2,
      action: () => navigate(`/admin/admit-cards?project=${id}&focus=centers${selectedJob?._id ? `&job=${selectedJob._id}` : ""}`),
    },
    {
      title: "Public Apply URL",
      description: isPublished && project.publicSlug ? `/apply/${project.publicSlug}` : "Locked until publish.",
      icon: ExternalLink,
      action: () => isPublished && project.publicSlug && window.open(`/apply/${project.publicSlug}`, "_blank", "noopener,noreferrer"),
    },
  ];

  const currentWorkflowStep = publishSectionOpen
    ? "publish"
    : reviewMode
    ? "review"
    : !selectedJob
      ? projectPublishComplete
        ? "publish"
        : "project"
      : !landingComplete
        ? "landing"
      : !jobComplete
        ? "job"
        : !admitFormatComplete
          ? "admit-format"
          : !centersComplete
            ? "centers"
            : !reviewReady
              ? "review"
              : "publish";

  return (
    <AdminLayout title="Project Details">
      <div
        className="
        min-h-full
        bg-[#f7f4ee]
        p-5 space-y-5
      "
      >
        {/* HERO */}
        <div
          className="
          rounded-[26px]
          bg-white
          border border-gray-200
          shadow-sm
          p-6 relative overflow-hidden
        "
        >
          <div
            className="
            absolute top-0 left-0
            w-full h-1
            bg-gradient-to-r
            from-orange-500
            via-orange-400
            to-orange-500
          "
          />

          <div
            className="
            flex flex-col xl:flex-row
            xl:items-start
            xl:justify-between
            gap-5
          "
          >
            <div>
              <div
                className="
                flex flex-wrap items-center
                gap-3 mb-3
              "
              >
                <Badge
                  className={getProjectStatusBadgeClass(project.status)}
                >
                  {project.status}
                </Badge>

                {project.startDate && project.endDate && (
                  <p
                    className="
                      text-sm text-gray-500
                    "
                  >
                    Duration:{" "}
                    {new Date(project.startDate).toLocaleDateString("en-IN")} -{" "}
                    {new Date(project.endDate).toLocaleDateString("en-IN")}
                  </p>
                )}
              </div>

              <h1
                className="
                text-2xl font-bold
                text-gray-900
              "
              >
                {project.name}
              </h1>

              <p
                className="
                text-sm text-gray-500 mt-2
              "
              >
                State: {project.state} | Department: {project.department}
              </p>

              {/* Public URL */}
              {project.publicSlug && (
                <div className="mt-4 flex w-fit max-w-full flex-wrap items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50/60 px-3 py-2 shadow-[0_8px_24px_rgba(234,88,12,0.06)]">
                  <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500">
                    Public URL:
                  </span>
                  <code className="max-w-[360px] truncate rounded-full border border-orange-200 bg-white px-3 py-1.5 font-mono text-xs font-semibold text-orange-700">
                    /apply/{project.publicSlug}
                  </code>
                  <button
                    onClick={async () => {
                      const url = `${window.location.origin}/apply/${project.publicSlug}`;
                      try {
                        await navigator.clipboard.writeText(url);
                        toast.success("Public URL copied");
                      } catch {
                        toast.error("Unable to copy link");
                      }
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-orange-600 transition-colors hover:bg-white hover:text-orange-700"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Link
                  </button>
                  {isPublished ? (
                    <a
                      href={`/apply/${project.publicSlug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-bold text-slate-700 transition-colors hover:bg-white hover:text-orange-700"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open Live
                    </a>
                  ) : (
                    <span className="inline-flex h-8 items-center rounded-full bg-white px-2.5 text-xs font-bold text-gray-400">
                      Locked until publish
                    </span>
                  )}
                </div>
              )}

              {project.description && (
                <p
                  className="
                  text-sm text-gray-500
                  mt-3 max-w-3xl
                "
                >
                  {project.description}
                </p>
              )}
            </div>

            <div
              className="
              flex items-center gap-3
            "
            >
              <Button
                variant="outline"
                onClick={() => navigate("/admin/projects")}
                className="
                  rounded-2xl
                  h-11 px-5
                "
              >
                Back
              </Button>

              <Button
                onClick={() => navigate(`/admin/projects/${id}/edit`)}
                className="
                  bg-orange-600
                  hover:bg-orange-700
                  text-white
                  rounded-2xl
                  h-11 px-5
                  shadow-lg shadow-orange-200
                "
              >
                <Edit
                  className="
                  w-4 h-4 mr-2
                "
                />
                Edit Project
              </Button>
            </div>
          </div>
        </div>

        <ProjectFlowNav
          project={workflowNavProject}
          current={currentWorkflowStep}
          workflowScope={workflowScope}
          publishComplete={publishComplete}
          jobId={selectedJob?._id}
          contextLabel="Current Job"
          contextValue={selectedJob
            ? `${selectedJob.title}${selectedJob.postCode ? ` - ${selectedJob.postCode}` : ""}`
            : "No job selected"}
          onStepClick={(step) => {
            if (step.key !== "job") return true;
            openJobAdvertisement(selectedJob, jobs.length ? "review" : "basic-info");
            return false;
          }}
        />

        <div className="rounded-[26px] border border-orange-100 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
                Job Context
              </p>
              <h2 className="mt-1 text-lg font-bold text-gray-900">
                Choose the job this project view should follow
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Job advertisement, admit card setup, and review shortcuts will use the selected job.
              </p>
            </div>
            <div className="w-full lg:w-[360px]">
              <CustomSelect
                value={selectedJob?._id || ""}
                onChange={(value) => {
                  setSelectedJobId(value);
                  const nextParams = new URLSearchParams(searchParams);
                  if (value) nextParams.set("job", value);
                  else nextParams.delete("job");
                  navigate(
                    {
                      pathname: location.pathname,
                      search: nextParams.toString(),
                      hash: location.hash,
                    },
                    { replace: true },
                  );
                }}
                options={jobs.map((job) => ({
                  value: job._id,
                  label: `${job.title}${job.postCode ? ` (${job.postCode})` : ""}${job.status ? ` - ${job.status}` : ""}`,
                }))}
                placeholder={jobs.length ? "Select a job" : "No jobs available"}
                disabled={jobs.length === 0}
              />
            </div>
          </div>
        </div>

        {reviewMode && !publishSectionOpen && (
          <div
            className="rounded-[26px] border border-orange-100 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Final review
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  Review before publishing
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                  Check the core sections, then continue to Publish / Verify.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => navigate(`/admin/projects/${id}?review=1${selectedJob?._id ? `&job=${selectedJob._id}` : ''}#publish`)}
                  className="h-10 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white hover:bg-orange-700"
                >
                  Next: Publish / Verify
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {reviewItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    type="button"
                    onClick={item.action}
                    className="group min-h-[134px] rounded-2xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-orange-200 hover:bg-orange-50/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-orange-500" />
                    </div>
                    <h3 className="mt-4 text-sm font-bold text-gray-900">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{item.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {reviewMode && publishSectionOpen && (
          <div
            id="publish"
            className="rounded-[26px] border border-orange-100 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Publish / verify
                </p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">
                  {selectedJob
                    ? publishComplete
                      ? "Job is live on the public URL"
                      : isPublished
                        ? "Publish this job on the public URL"
                        : "Publish the project and this job"
                    : projectPublishComplete
                      ? "Project published and public URL is live"
                      : "Release the public application URL"}
                </h2>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
                  {selectedJob
                    ? publishComplete
                      ? "Candidates can apply for this job from the project landing page."
                      : "This is the final action after landing CMS, job advertisement, and review. Admit cards and centers can be configured later."
                    : projectPublishComplete
                      ? "Candidates can now open the public URL and start applications."
                      : "Publish a reviewed job first, then release the project public URL."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openProjectPreview(id)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-white px-4 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-50"
                >
                  <Eye className="h-4 w-4" />
                  Preview Public Page
                </button>
                {isPublished && project.publicSlug && (
                  <a
                    href={`/apply/${project.publicSlug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-bold text-orange-700 transition-colors hover:bg-orange-100"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Public Page
                  </a>
                )}

                <Button
                  type="button"
                  disabled={
                    selectedJob
                      ? publishComplete || !reviewReady || publishSelectedJobMutation.isPending
                      : projectPublishComplete || !projectPublishReady || publishMutation.isPending
                  }
                  onClick={() => {
                    if (selectedJob) publishSelectedJobMutation.mutate();
                    else publishMutation.mutate();
                  }}
                  className={`h-10 rounded-xl px-4 text-sm font-bold ${
                    selectedJob
                      ? publishComplete
                        ? "bg-green-100 text-green-700 hover:bg-green-100"
                        : reviewReady
                          ? "bg-orange-600 text-white hover:bg-orange-700"
                          : "bg-gray-100 text-gray-400 hover:bg-gray-100"
                      : projectPublishComplete
                      ? "bg-green-100 text-green-700 hover:bg-green-100"
                      : projectPublishReady
                        ? "bg-orange-600 text-white hover:bg-orange-700"
                        : "bg-gray-100 text-gray-400 hover:bg-gray-100"
                  }`}
                >
                  {(selectedJob ? publishSelectedJobMutation.isPending : publishMutation.isPending) ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  {selectedJob
                    ? publishComplete
                      ? "Published"
                      : isPublished
                        ? "Publish Job"
                        : "Publish Project & Job"
                    : projectPublishComplete
                      ? "Published"
                      : "Publish Project URL"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {(selectedJob ? selectedJobWorkflowReadiness.checks : projectWorkflowReadiness.checks)?.map((check) => (
                <div
                  key={check.key}
                  className={`rounded-2xl border p-4 ${
                    check.complete
                      ? "border-green-100 bg-green-50/70"
                      : check.optional
                        ? "border-gray-200 bg-gray-50"
                      : "border-orange-100 bg-orange-50/60"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        check.complete
                          ? "text-green-600"
                          : check.optional
                            ? "text-gray-400"
                            : "text-orange-500"
                      }`}
                    />
                    <p className="text-sm font-bold text-gray-900">{check.label}</p>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-500">{check.message}</p>
                </div>
              ))}
            </div>

            {!(selectedJob ? reviewReady : projectPublishReady) && (
              <p className="mt-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700">
                Complete missing steps before publishing: {(selectedJob
                  ? selectedJobWorkflowReadiness.checks.filter((step) => !step.complete && !step.optional)
                  : projectMissingWorkflowSteps
                ).map((step) => step.label).join(", ")}
              </p>
            )}
          </div>
        )}

        {/* STATS */}
        <div
          className="
          grid grid-cols-1
          sm:grid-cols-2
          xl:grid-cols-4
          gap-4
        "
        >
          {statCards.map((s) => (
            <div
              key={s.title}
              className="
                rounded-[22px]
                bg-white
                border border-gray-200
                shadow-sm
                p-5
              "
            >
              <div
                className="
                flex items-center
                justify-between
              "
              >
                <div>
                  <p
                    className="
                    text-xs
                    font-bold
                    tracking-normal
                    text-gray-400 mb-2
                  "
                  >
                    {s.title}
                  </p>

                  <h2
                    className="
                    text-2xl font-bold
                    text-gray-900
                  "
                  >
                    {s.value}
                  </h2>
                </div>

                <div
                  className={`
                  w-12 h-12 rounded-2xl
                  flex items-center justify-center
                  ${s.bg}
                `}
                >
                  <s.icon
                    className={`
                      w-5 h-5 ${s.color}
                    `}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* MAIN GRID */}
        <div
          className="
          grid grid-cols-1
          items-stretch
          xl:grid-cols-3
          gap-5
        "
        >
          {/* LEFT */}
          <div
            className="
            xl:col-span-2
            flex min-h-[420px]
          "
          >
            <Card
              className="
              flex w-full flex-col
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            "
            >
              <CardHeader className="shrink-0">
                <div
                  className="
                  flex items-center
                  justify-between
                "
                >
                  <div>
                    <h3
                      className="
                      text-lg font-bold
                      text-gray-900
                    "
                    >
                      Job Positions
                    </h3>

                    <p
                      className="
                      text-xs text-gray-500 mt-1
                    "
                    >
                      {jobs.length} configured job{jobs.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    className="
                      bg-orange-600
                      hover:bg-orange-700
                      text-white
                      rounded-xl
                    "
                    onClick={() => openJobAdvertisement(null, { mode: "new" })}
                  >
                    <Plus
                      className="
                      w-4 h-4 mr-1
                    "
                    />
                    Add Job
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 p-0">
                {jobs.length === 0 ? (
                  <div
                    className="
                    flex h-full min-h-[260px] flex-col items-center justify-center p-10 text-center
                  "
                  >
                    <div
                      className="
                      w-16 h-16 rounded-3xl
                      bg-orange-100
                      flex items-center justify-center
                      mx-auto mb-4
                    "
                    >
                      <FileText
                        className="
                        w-7 h-7 text-orange-600
                      "
                      />
                    </div>

                    <h3
                      className="
                      text-lg font-bold
                      text-gray-900
                    "
                    >
                      No Jobs Added
                    </h3>

                    <p
                      className="
                      text-sm text-gray-500 mt-1
                    "
                    >
                      Create the first job under this project.
                    </p>

                    <Button
                      className="
                        mt-5 bg-orange-600
                        hover:bg-orange-700
                        text-white rounded-2xl
                      "
                      onClick={() => openJobAdvertisement(null, { mode: "new" })}
                    >
                      Create First Job
                    </Button>
                  </div>
                ) : (
                  <div
                    className="
                    hover-scroll h-full min-h-0 overflow-y-auto
                    divide-y divide-gray-100
                  "
                  >
                    {jobs.map((job) => {
                      const workflow = getJobWorkflowSummary(rawProject, job);
                      return (
                      <div
                        key={job._id}
                        className={`
                          flex flex-col gap-4
                          p-5
                          hover:bg-orange-50/30
                          transition-all
                          lg:flex-row lg:items-center lg:justify-between
                          ${String(selectedJob?._id || "") === String(job._id) ? "bg-orange-50/40" : ""}
                        `}
                      >
                        <div
                          className="
                          flex items-center gap-4
                          min-w-0
                        "
                        >
                          <div
                            className="
                            w-11 h-11 rounded-2xl
                            bg-orange-100
                            flex items-center justify-center
                          "
                          >
                            <FileText
                              className="
                              w-5 h-5 text-orange-600
                            "
                            />
                          </div>

                          <div className="min-w-0">
                            <h4
                              className="
                              truncate font-bold text-gray-900
                            "
                            >
                              {job.title}
                            </h4>

                            <p
                              className="
                              text-xs text-gray-500 mt-1
                            "
                            >
                              {[job.postCode, job.department].filter(Boolean).join(" • ")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                                {workflow.completedCount}/{workflow.totalCount} complete
                              </span>
                              <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                workflow.complete
                                  ? "bg-green-100 text-green-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}>
                                {workflow.complete ? "Ready" : `Next: ${workflow.nextLabel}`}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="grid shrink-0 grid-cols-[112px_92px_36px] items-center gap-2 self-end lg:self-auto">
                          <div className="flex h-9 items-center justify-end gap-2 text-right">
                            <span className="text-base font-bold leading-none text-gray-900">
                              {job.totalApplicants || 0}
                            </span>

                            <span className="text-xs font-semibold uppercase leading-none tracking-normal text-gray-400">
                              APPLICANTS
                            </span>
                          </div>

                          <Badge
                            className={`flex h-8 items-center justify-center rounded-full px-3 text-xs font-semibold capitalize ${
                              job.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {job.status}
                          </Badge>

                          <button
                            onClick={() => openJobAdvertisement(job, "review")}
                            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-orange-600"
                            aria-label={`Open ${job.title || "job advertisement"}`}
                          >
                            <ArrowRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT */}
          <div className="flex h-full min-h-[420px] flex-col gap-5">
            {/* QUICK ACTIONS */}
            <Card
              className="
              shrink-0
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            "
            >
              <CardHeader>
                <h3
                  className="
                  text-lg font-bold
                  text-gray-900
                "
                >
                  Quick Actions
                </h3>
              </CardHeader>

              <CardContent>
                <div
                  className="
                  grid grid-cols-2 gap-3
                "
                >
                  {quickActions.map((action) => (
                    <button
                      key={action.title}
                      onClick={action.action}
                      className="
                        rounded-2xl
                        border border-gray-100
                        p-4 text-center
                        hover:bg-orange-50/40
                        hover:border-orange-200
                        transition-all
                      "
                    >
                      <div
                        className={`
                        w-10 h-10 rounded-xl
                        flex items-center justify-center
                        mx-auto mb-3
                        ${action.color}
                      `}
                      >
                        <action.icon
                          className="
                          w-5 h-5
                        "
                        />
                      </div>

                      <p
                        className="
                        text-xs font-bold
                        text-gray-900
                      "
                      >
                        {action.title}
                      </p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* PROJECT INFO */}
            <Card
              className="
              flex min-h-[220px] flex-1 flex-col
              rounded-[24px]
              bg-white
              border border-gray-200
              shadow-sm
            "
            >
              <CardHeader className="shrink-0">
                <h3
                  className="
                  text-lg font-bold
                  text-gray-900
                "
                >
                  Project Information
                </h3>
              </CardHeader>

              <CardContent
                className="
                hover-scroll min-h-0 flex-1 space-y-4 overflow-y-auto text-sm
              "
              >
                {[
                  ["State", project.state],
                  ["Department", project.department],
                  ["Status", project.status],
                  ["Created By", project.createdBy?.fullName || "â€”"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="
                      flex items-center
                      justify-between
                    "
                  >
                    <span
                      className="
                      text-gray-500
                    "
                    >
                      {label}
                    </span>

                    <span
                      className="
                      font-semibold text-gray-900
                    "
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ProjectDetails;
