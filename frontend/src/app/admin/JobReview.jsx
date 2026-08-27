import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import AdminLayout from "../../components/layouts/AdminLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import JobStepProgress from "./JobStepProgress";
import {
  ArrowLeft,
  CheckCircle,
  FileText,
  GraduationCap,
  CreditCard,
  Calendar,
  Edit,
  Loader2,
  AlertTriangle,
  Users,
} from "lucide-react";
import { adminService } from "../../services/admin.service";
import { getJobWizardPath, readJobDraft, toJobDraftPayload } from "../../utils/jobDraft";

const STORAGE_KEY = "job_draft";

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
    <span className="text-sm font-medium text-gray-500 sm:w-36 flex-shrink-0">
      {label}:
    </span>
    <span className="text-sm text-gray-900">{value || "—"}</span>
  </div>
);

// Build the update payload — only sends fields the backend updateJobSchema accepts
const buildUpdatePayload = (draft) => {
  const num = (v) =>
    v !== undefined && v !== null && v !== "" ? Number(v) : undefined;
  const str = (v) =>
    v !== undefined && v !== null && v !== "" ? String(v) : undefined;
  const def = (v) =>
    v !== undefined && v !== null && v !== "" ? v : undefined;

  const payload = {};

  const CATEGORY_MAP = {
    general: "General",
    technical: "Technical",
    administrative: "Administrative",
    teaching: "Teaching",
  };
  const JOB_TYPE_MAP = {
    permanent: "Permanent",
    contract: "Contract",
    temporary: "Temporary",
  };

  if (def(draft.category)) {
    const cat = draft.category;
    payload.category = CATEGORY_MAP[cat?.toLowerCase()] || cat;
  }
  if (def(draft.title)) payload.title = str(draft.title);
  if (def(draft.postCode)) payload.postCode = str(draft.postCode);
  if (def(draft.department)) payload.department = str(draft.department);
  if (def(draft.jobType)) {
    const jt = draft.jobType;
    payload.jobType = JOB_TYPE_MAP[jt?.toLowerCase()] || jt;
  }
  if (def(draft.description)) payload.description = draft.description;
  if (num(draft.totalPosts)) payload.totalPosts = num(draft.totalPosts);
  payload.postSelectionMode =
    draft.postSelectionMode === "preference" ? "preference" : "single";

  // Posts — normalise types, strip _id so Zod doesn't choke on ObjectId format
  if (Array.isArray(draft.posts) && draft.posts.length > 0) {
    payload.posts = draft.posts
      .filter((p) => p?.title && p?.designation)
      .map((p) => ({
        postCode: p.postCode || "",
        title: p.title,
        designation: p.designation,
        department: p.department || "",
        category: p.category || "",
        vacancies: Math.max(1, Math.round(Number(p.vacancies) || 1)),
        payLevel: p.payLevel || "",
        location: p.location || "",
        status: "active",
      }));
  }

  // Reserved posts
  if (draft.reservedPosts) {
    payload.reservedPosts = {
      sc: num(draft.reservedPosts.sc) || 0,
      st: num(draft.reservedPosts.st) || 0,
      obc: num(draft.reservedPosts.obc) || 0,
      ews: num(draft.reservedPosts.ews) || 0,
      pwd: num(draft.reservedPosts.pwd) || 0,
    };
  }

  // Application fee
  if (draft.applicationFee) {
    payload.applicationFee = {
      general: num(draft.applicationFee.general) || 0,
      obc: num(draft.applicationFee.obc) || 0,
      scSt: num(draft.applicationFee.scSt) || 0,
      ews: num(draft.applicationFee.ews) || 0,
      pwd: num(draft.applicationFee.pwd) || 0,
    };
  }

  // Dates
  if (def(draft.applicationDeadline))
    payload.applicationDeadline = draft.applicationDeadline;
  if (def(draft.examDate)) payload.examDate = draft.examDate;
  if (def(draft.applicationStartDate))
    payload.applicationStartDate = draft.applicationStartDate;
  if (def(draft.correctionStartDate))
    payload.correctionStartDate = draft.correctionStartDate;
  if (def(draft.correctionDeadline))
    payload.correctionDeadline = draft.correctionDeadline;
  if (def(draft.admitCardReleaseDate))
    payload.admitCardReleaseDate = draft.admitCardReleaseDate;
  if (def(draft.resultDate)) payload.resultDate = draft.resultDate;

  // Eligibility
  if (draft.ageLimit) {
    payload.ageLimit = {
      ...(num(draft.ageLimit.min) !== undefined && {
        min: num(draft.ageLimit.min),
      }),
      ...(num(draft.ageLimit.max) !== undefined && {
        max: num(draft.ageLimit.max),
      }),
      relaxation: {
        sc: num(draft.ageLimit.relaxation?.sc) || 0,
        st: num(draft.ageLimit.relaxation?.st) || 0,
        obc: num(draft.ageLimit.relaxation?.obc) || 0,
        pwd: num(draft.ageLimit.relaxation?.pwd) || 0,
      },
    };
  }

  if (draft.education) {
    payload.education = {
      essential: Array.isArray(draft.education.essential)
        ? draft.education.essential
        : [],
      desirable: Array.isArray(draft.education.desirable)
        ? draft.education.desirable
        : [],
    };
  }

  if (draft.experience) {
    payload.experience = {
      required: !!draft.experience.required,
      years: num(draft.experience.years) || 0,
      type: str(draft.experience.type) || "",
      description: str(draft.experience.description) || "",
    };
  }

  if (draft.physicalStandards)
    payload.physicalStandards = draft.physicalStandards;
  if (draft.medicalStandards) payload.medicalStandards = draft.medicalStandards;
  if (def(draft.standardPresetId)) payload.standardPresetId = draft.standardPresetId;

  if (
    Array.isArray(draft.otherRequirements) &&
    draft.otherRequirements.length > 0
  ) {
    payload.otherRequirements = draft.otherRequirements.filter(Boolean);
  }

  if (Array.isArray(draft.documentRequirements)) {
    const validDocs = draft.documentRequirements.filter((d) => d?.name?.trim());
    payload.documentRequirements = validDocs;
  }

  if (Array.isArray(draft.formSections)) {
    payload.formSections = draft.formSections
      .map((section) => ({
        title: str(section.title),
        required: Boolean(section.required),
        ...(section.systemSource && { systemSource: str(section.systemSource) }),
        fields: Array.isArray(section.fields)
          ? section.fields
              .map((field) => {
                const type = str(field.type) || "text";
                const options = ["select", "radio"].includes(type)
                  ? [
                      ...new Set(
                        (field.options || [])
                          .map((option) => String(option).trim())
                          .filter(Boolean),
                      ),
                    ]
                  : undefined;
                return {
                  type,
                  label: str(field.label),
                  required: Boolean(field.required),
                  placeholder: str(field.placeholder) || "",
                  ...(options && { options }),
                  ...(field.validation && { validation: field.validation }),
                };
                })
              .filter(
                (field) =>
                  field.label &&
                  (!["select", "radio"].includes(field.type) ||
                    field.options?.length >= 2),
              )
          : [],
      }))
      .filter((section) => section.title && (section.fields.length > 0 || !section.systemSource));
  }

  // Payment config — only safe fields
  if (draft.paymentConfig) {
    payload.paymentConfig = {
      applicationFee: num(draft.paymentConfig.applicationFee) || 0,
      processingFee: num(draft.paymentConfig.processingFee) || 0,
      paymentTiming: draft.paymentConfig.paymentTiming || "final",
      paymentMethods: Array.isArray(draft.paymentConfig.paymentMethods)
        ? draft.paymentConfig.paymentMethods
        : [],
      ...(def(draft.paymentConfig.refundPolicy) && {
        refundPolicy: draft.paymentConfig.refundPolicy,
      }),
      ...(def(draft.paymentConfig.paymentDeadline) && {
        paymentDeadline: draft.paymentConfig.paymentDeadline,
      }),
    };
  }

  return payload;
};

const normalizeForCompare = (value) => {
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        const normalized = normalizeForCompare(value[key]);
        if (normalized !== undefined) acc[key] = normalized;
        return acc;
      }, {});
  }
  return value === undefined ? undefined : value;
};

const valuesEqual = (a, b) =>
  JSON.stringify(normalizeForCompare(a)) ===
  JSON.stringify(normalizeForCompare(b));

const CHANGE_LABELS = {
  title: "job title",
  description: "job description",
  applicationDeadline: "application deadline",
  correctionStartDate: "correction start date",
  correctionDeadline: "correction deadline",
  admitCardReleaseDate: "admit-card release date",
  examDate: "exam date",
  resultDate: "result publish date",
  "paymentConfig.paymentDeadline": "payment deadline",
  "paymentConfig.refundPolicy": "refund policy",
};

const getChangedFieldLabels = (payload = {}) => {
  const labels = [];
  Object.keys(payload).forEach((key) => {
    if (key === "amendmentReason") return;
    if (key === "paymentConfig") {
      Object.keys(payload.paymentConfig || {}).forEach((subKey) => {
        labels.push(CHANGE_LABELS[`paymentConfig.${subKey}`] || subKey);
      });
      return;
    }
    labels.push(CHANGE_LABELS[key] || key);
  });
  return [...new Set(labels)];
};

const buildChangedUpdatePayload = (draft, serverJob) => {
  const nextPayload = buildUpdatePayload(draft);
  if (!serverJob?._id) return nextPayload;

  const serverPayload = buildUpdatePayload(toJobDraftPayload(serverJob));
  return Object.entries(nextPayload).reduce((acc, [key, value]) => {
    if (!valuesEqual(value, serverPayload[key])) acc[key] = value;
    return acc;
  }, {});
};

const JobReview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const routeJobId = searchParams.get("job");
  const [isPublishing, setIsPublishing] = useState(false);
  const [draft, setDraft] = useState(() => ({
    ...readJobDraft(),
    ...(projectId ? { projectId } : {}),
    ...(routeJobId ? { _jobId: routeJobId } : {}),
  }));
  const [isHydrating, setIsHydrating] = useState(false);
  const [hydratedJob, setHydratedJob] = useState(null);
  const [amendmentPrompt, setAmendmentPrompt] = useState(null);

  const effectiveProjectId = projectId || draft.projectId || "";
  const isProjectWizard = Boolean(effectiveProjectId);
  const draftJobId = routeJobId || draft._jobId || "";
  const isPublishedJob = String(hydratedJob?.status || draft.status || "").toLowerCase() === "active";
  const validProjectId = /^[a-f\d]{24}$/i.test(effectiveProjectId || "");
  const { data: projectData } = useQuery({
    queryKey: ["admin-project", effectiveProjectId],
    queryFn: () => adminService.getProject(effectiveProjectId),
    enabled: Boolean(validProjectId),
    staleTime: 30000,
  });
  const project = projectData?.project || projectData || hydratedJob?.projectId || {};
  const hasCoreDraft =
    Boolean(draft.projectId) &&
    Boolean(draft.title) &&
    Boolean(draft.postCode) &&
    Boolean(draft.department) &&
    Array.isArray(draft.posts) &&
    draft.posts.length > 0;

  useEffect(() => {
    let cancelled = false;

    const hydrateDraft = async () => {
      try {
        if (!draftJobId && hasCoreDraft) return;
        setIsHydrating(true);
        let job = null;

        if (draftJobId) {
          const response = await adminService.getAdminJob(draftJobId);
          job = response?.job || response;
        } else if (effectiveProjectId) {
          const response = await adminService.getAdminJobs({
            projectId: effectiveProjectId,
            limit: 100,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
          const jobList = response?.jobs || response || [];
          job = jobList[0] || null;
        }

        if (!job?._id) return;
        const serverDraft = toJobDraftPayload(job);
        const routeScopedDraft = {
          ...draft,
          ...(projectId ? { projectId } : {}),
          ...(routeJobId ? { _jobId: routeJobId } : {}),
        };
        const hydratedDraft = {
          ...serverDraft,
          ...routeScopedDraft,
          projectId: projectId || serverDraft.projectId || routeScopedDraft.projectId,
          _jobId: serverDraft._jobId,
          status: serverDraft.status,
        };
        if (cancelled) return;
        setHydratedJob(job);
        setDraft(hydratedDraft);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(hydratedDraft));
      } catch {
        // Keep the page usable even if the stored job no longer exists.
      } finally {
        if (!cancelled) setIsHydrating(false);
      }
    };

    hydrateDraft();

    return () => {
      cancelled = true;
    };
    // Keep draft out of the dependency list so hydration does not loop after merging server data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftJobId, effectiveProjectId, hasCoreDraft]);

  // For DRAFT: only need projectId + title + postCode + department
  const missingForDraft =
    !draft.title ||
    !draft.postCode ||
    !draft.department ||
    !effectiveProjectId ||
    !/^[a-f\d]{24}$/i.test(effectiveProjectId || "");

  // For PUBLISH: also need posts + applicationDeadline
  const missingRequired = missingForDraft || !draft.posts?.length;

  const missingFields = [
    (!effectiveProjectId || !/^[a-f\d]{24}$/i.test(effectiveProjectId)) &&
      "Project setup",
    !draft.title && "Job title",
    !draft.postCode && "Post code",
    !draft.department && "Department",
    !draft.posts?.length && "Posts / vacancies",
  ].filter(Boolean);

  // Step 1: Create job as draft
  const { mutateAsync: createJob } = useMutation({
    mutationFn: adminService.createJob,
  });

  // Step 2: Update job with all details
  const { mutateAsync: updateJob } = useMutation({
    mutationFn: ({ id, data }) =>
      adminService.updateJob(id, data, { suppressGlobalErrorToast: true }),
  });

  // Step 3: Publish job
  const { mutateAsync: publishJob } = useMutation({
    mutationFn: adminService.publishJob,
  });

  const getAmendmentPath = (jobId = draftJobId) => {
    const state = encodeURIComponent(project?.state || "All");
    const params = new URLSearchParams();
    if (effectiveProjectId) params.set("project", effectiveProjectId);
    if (jobId) params.set("job", jobId);
    params.set("amendment", "form-sections");
    params.set("returnTo", "job-review");
    return `/admin/cms/edit/${state}?${params.toString()}`;
  };

  const isOfficialAmendmentError = (err) => {
    const message = String(err?.message || "");
    return (
      /create an official amendment/i.test(message) ||
      /cannot change .*formSections/i.test(message)
    );
  };

  const getNextProjectStepPath = (jobId) =>
    effectiveProjectId
      ? `/admin/admit-cards?project=${effectiveProjectId}&focus=template${jobId ? `&job=${jobId}` : ""}`
      : "/admin/jobs";

  const invalidateJobAndPublicViews = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
    if (effectiveProjectId) {
      queryClient.invalidateQueries({ queryKey: ["admin-project", effectiveProjectId] });
    }
    const publicSlug = project?.publicSlug || project?.slug || hydratedJob?.projectId?.publicSlug;
    if (publicSlug) {
      queryClient.invalidateQueries({ queryKey: ["public-project", publicSlug] });
      queryClient.invalidateQueries({ queryKey: ["public-project-applications", publicSlug] });
    }
    queryClient.invalidateQueries({ queryKey: ["public-projects"] });
  };

  const publishJobAmendmentNotice = async ({ reason, updatePayload, job }) => {
    const projectSlug = project?.publicSlug || project?.slug || hydratedJob?.projectId?.publicSlug;
    const state = project?.state || hydratedJob?.projectId?.state || "All";
    if (!effectiveProjectId || !state) return;

    const jobLabel = `${job?.title || draft.title || "Selected job"}${
      job?.postCode || draft.postCode ? ` (${job?.postCode || draft.postCode})` : ""
    }`;
    const changedLabels = getChangedFieldLabels(updatePayload);
    const text = `Official amendment for ${jobLabel}: ${reason.trim()}${
      changedLabels.length ? ` Updated: ${changedLabels.join(", ")}.` : ""
    }`;
    const link = projectSlug ? `/apply/${projectSlug}` : "";

    try {
      const response = await adminService.getCmsPage(state, { projectId: effectiveProjectId });
      const page = response?.page || response || {};
      const announcements = Array.isArray(page.announcements) ? page.announcements : [];
      const alreadyAdded = announcements.some((item) => item.text === text);
      const nextAnnouncements = alreadyAdded
        ? announcements
        : [{ text, link, priority: "high" }, ...announcements];

      await adminService.updateCmsPage(
        state,
        {
          announcements: nextAnnouncements,
          sectionVisibility: {
            ...(page.sectionVisibility || {}),
            notices: true,
          },
          status: "published",
        },
        { projectId: effectiveProjectId },
      );
      await adminService.publishCmsPage(state, { projectId: effectiveProjectId });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-page", state, effectiveProjectId] });
      toast.success("Official amendment notice published on the public page.");
    } catch (noticeError) {
      toast.error(
        noticeError?.message ||
          "Job saved, but the public amendment notice could not be published.",
      );
    }
  };

  const readStoredDraft = () => {
    try {
      const storedDraft = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      const nextDraft = Object.keys(storedDraft).length ? storedDraft : draft;
      return {
        ...nextDraft,
        ...(projectId ? { projectId } : {}),
        ...(routeJobId ? { _jobId: routeJobId } : {}),
      };
    } catch {
      return {
        ...draft,
        ...(projectId ? { projectId } : {}),
        ...(routeJobId ? { _jobId: routeJobId } : {}),
      };
    }
  };

  const clearStoredJobId = () => {
    const current = readStoredDraft();
    delete current._jobId;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  };

  // Create job or recover existing ID on 409 conflict
  const getOrCreateJobId = async () => {
    const currentDraft = readStoredDraft();
    const existingJobId = currentDraft._jobId || draft._jobId;

    // If we already have a jobId stored in the draft, verify it still exists.
    if (existingJobId && /^[a-f\d]{24}$/i.test(existingJobId)) {
      try {
        const existing = await adminService.getAdminJob(existingJobId);
        const existingJob = existing?.job || existing;
        const existingProjectId = existingJob?.projectId?._id || existingJob?.projectId || "";
        if (
          existingJob?._id &&
          (!effectiveProjectId || String(existingProjectId) === String(effectiveProjectId))
        ) {
          return existingJobId;
        }
        clearStoredJobId();
      } catch (err) {
        if (![404, 400].includes(err?.status)) throw err;
        clearStoredJobId();
      }
    }

    const createPayload = {
      projectId: effectiveProjectId || currentDraft.projectId || draft.projectId,
      title: currentDraft.title || draft.title,
      postCode: currentDraft.postCode || draft.postCode,
      department: currentDraft.department || draft.department,
    };

    try {
      const res = await createJob(createPayload);
      const jobId = res?.job?._id;
      if (jobId) {
        // Store the jobId in draft so retries skip the create step
        const current = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ ...current, _jobId: jobId }),
        );
      }
      return jobId || null;
    } catch (err) {
      if (err?.status === 409) {
        // postCode already in DB — fetch that job directly
        try {
          const res = await adminService.getAdminJobByPostCode(createPayload.postCode);
          const existingJob = res?.job || res;
          const jobId = existingJob?._id;
          const existingProjectId = existingJob?.projectId?._id || existingJob?.projectId || "";
          if (jobId && String(existingProjectId) === String(createPayload.projectId)) {
            // Cache it for future retries
            const current = JSON.parse(
              sessionStorage.getItem(STORAGE_KEY) || "{}",
            );
            sessionStorage.setItem(
              STORAGE_KEY,
              JSON.stringify({ ...current, _jobId: jobId }),
            );
            return jobId;
          }
        } catch {
          // lookup failed
        }
        toast.error(
          `Post code "${createPayload.postCode}" is already used. Go to Step 1 and change it.`,
        );
        return null;
      }
      throw err;
    }
  };

  const savePayloadToJob = async (jobId, updatePayload) => {
    try {
      await updateJob({ id: jobId, data: updatePayload });
      return jobId;
    } catch (err) {
      if (isOfficialAmendmentError(err)) {
        const nextPrompt = {
          jobId,
          message:
            "Candidates have already applied. Create and publish an official amendment notice before changing locked application form sections.",
          path: getAmendmentPath(jobId),
        };
        setAmendmentPrompt(nextPrompt);
        toast.error("Official amendment required for this form change.");
        const amendmentError = new Error("Official amendment required");
        amendmentError.isAmendmentRequired = true;
        throw amendmentError;
      }
      if (
        err?.message?.toLowerCase?.().includes("amendment reason") &&
        typeof window !== "undefined"
      ) {
        const amendmentReason = window.prompt(
          "Enter the official amendment reason for this published job change:",
        );
        if (!amendmentReason?.trim()) throw err;
        await updateJob({
          id: jobId,
          data: {
            ...updatePayload,
            amendmentReason: amendmentReason.trim(),
          },
        });
        await publishJobAmendmentNotice({
          reason: amendmentReason.trim(),
          updatePayload,
          job: hydratedJob || draft,
        });
        return jobId;
      }
      if (err?.status !== 404) throw err;
      clearStoredJobId();
      const recoveredJobId = await getOrCreateJobId();
      if (!recoveredJobId) throw err;
      await updateJob({ id: recoveredJobId, data: updatePayload });
      return recoveredJobId;
    }
  };

  const handleSaveDraft = async () => {
    if (missingForDraft) {
      toast.error(
        "Complete Step 1 first.",
      );
      return;
    }
    try {
      setIsPublishing(true);
      const jobId = await getOrCreateJobId();
      if (!jobId) return; // error already shown
      const updatePayload = buildChangedUpdatePayload(draft, hydratedJob);
      if (Object.keys(updatePayload).length > 0) {
        await savePayloadToJob(jobId, updatePayload);
      }
      toast.success("Draft saved");
      sessionStorage.removeItem(STORAGE_KEY);
      invalidateJobAndPublicViews();
      navigate(getNextProjectStepPath(jobId));
    } catch (err) {
      if (err?.isAmendmentRequired) return;
      toast.error(err.message || "Failed to save job");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (isPublishedJob && !isProjectWizard) {
      toast.error("This job is already published");
      return;
    }
    if (missingForDraft) {
      toast.error("Complete Step 1 first");
      return;
    }
    if (!draft.applicationStartDate) {
      toast.error("Add the application start date");
      return;
    }
    if (!draft.applicationDeadline) {
      toast.error("Add the application deadline");
      return;
    }
    if (!draft.posts?.length || !draft.totalPosts || draft.totalPosts < 1) {
      toast.error("Add posts and vacancies");
      return;
    }
    try {
      setIsPublishing(true);
      const jobId = await getOrCreateJobId();
      if (!jobId) return;
      const currentJob = await adminService.getAdminJob(jobId).catch(() => null);
      const currentStatus = String(currentJob?.job?.status || currentJob?.status || "").toLowerCase();
      if (currentStatus === "active" && !isProjectWizard) {
        const activeDraft = {
          ...readStoredDraft(),
          status: "active",
          _jobId: jobId,
        };
        setDraft(activeDraft);
        setHydratedJob(currentJob?.job || currentJob);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(activeDraft));
        toast.error("This job is already published");
        return;
      }
      const updatePayload = buildChangedUpdatePayload(draft, currentJob?.job || currentJob || hydratedJob);
      let publishJobId = jobId;
      if (Object.keys(updatePayload).length > 0) {
        publishJobId = await savePayloadToJob(jobId, updatePayload);
      }
      if (isProjectWizard) {
        toast.success("Job advertisement saved. Continue with admit-card setup.");
        sessionStorage.removeItem(STORAGE_KEY);
        invalidateJobAndPublicViews();
        navigate(getNextProjectStepPath(jobId));
        return;
      }
      await publishJob(publishJobId);
      toast.success("Job published");
      sessionStorage.removeItem(STORAGE_KEY);
      invalidateJobAndPublicViews();
      navigate(getNextProjectStepPath(jobId));
    } catch (err) {
      if (err?.isAmendmentRequired) return;
      toast.error(err.message || "Failed to publish job");
    } finally {
      setIsPublishing(false);
    }
  };

  const editStep = (step) =>
    navigate(
      getJobWizardPath(step, effectiveProjectId, draftJobId, { returnToReview: true }),
    );

  return (
    <AdminLayout title="Create Job - Review">
      <div className="p-4 sm:p-6">
        {isHydrating && !hasCoreDraft ? (
          <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-orange-100 bg-white">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
              <span>Loading job details...</span>
            </div>
          </div>
        ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Create Job
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Step 6 of 6: Review
              </p>
            </div>
            <Badge className={isPublishedJob ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
              {isProjectWizard
                ? isPublishedJob
                  ? "Live Job"
                  : "Ready to Continue"
                : isPublishedJob
                  ? "Published"
                  : "Ready to Publish"}
            </Badge>
          </div>

          <JobStepProgress currentStep={6} projectId={effectiveProjectId} clickable />

          {isPublishedJob && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
              <p className="font-semibold">Published job edit controls are active.</p>
              <p className="mt-1 leading-5">
                Deadlines can be extended and notices can be updated. Fees, eligibility,
                required fields, documents, and vacancy rules are locked once candidates apply.
              </p>
            </div>
          )}

          {amendmentPrompt && (
            <div className="flex flex-col gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-orange-900 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-orange-600">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">Official amendment required</p>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-orange-800">
                    {amendmentPrompt.message}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => navigate(amendmentPrompt.path)}
                className="shrink-0 bg-orange-600 px-5 text-white hover:bg-orange-700"
              >
                Create Amendment Notice
              </Button>
            </div>
          )}

          {missingRequired && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Missing required fields:</p>
                <ul className="text-sm mt-1 list-disc list-inside">
                  {missingFields.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              <p className="text-sm mt-2">
                  Finish Step 1 to continue.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">
                        Basic Info
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editStep("basic-info")}
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  <InfoRow label="Advertisement / Exam Title" value={draft.title} />
                  <InfoRow label="Advertisement / Exam Code" value={draft.postCode} />
                  <InfoRow label="Department" value={draft.department} />
                  <InfoRow label="Category" value={draft.category} />
                  <InfoRow label="Job Type" value={draft.jobType} />
                  <InfoRow label="Total Posts" value={draft.totalPosts} />
                  {draft.salaryRange?.min && (
                    <InfoRow
                      label="Salary Range"
                      value={`₹${draft.salaryRange.min?.toLocaleString("en-IN")} – ₹${draft.salaryRange.max?.toLocaleString("en-IN")}`}
                    />
                  )}
                </CardContent>
              </Card>

              {draft.posts?.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-orange-600" />
                        <h3 className="font-semibold text-gray-900">
                          Posts / Vacancies
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editStep("basic-info")}
                        className="text-orange-600 hover:bg-orange-50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 rounded-lg border border-orange-100 bg-orange-50 px-3 py-2 text-sm">
                      <span className="font-semibold text-gray-900">
                        Candidate selection:
                      </span>{" "}
                      <span className="text-gray-700">
                        {draft.postSelectionMode === "preference"
                          ? "Multiple posts with preference ranking"
                          : "Single post only"}
                      </span>
                    </div>
                    <div className="space-y-3">
                      {draft.posts.map((post, index) => (
                        <div
                          key={index}
                          className="p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="font-medium text-gray-900">
                                {post.designation || post.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {post.postCode || "No code"} •{" "}
                                {post.department || draft.department}
                              </p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">
                              {post.vacancies} vacancies
                            </Badge>
                          </div>
                          {(post.payLevel || post.location) && (
                            <p className="text-xs text-gray-500 mt-2">
                              {[post.payLevel, post.location]
                                .filter(Boolean)
                                .join(" • ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Eligibility */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <GraduationCap className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">
                          Eligibility
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editStep("eligibility")}
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {draft.ageLimit?.min && (
                    <InfoRow
                      label="Age Limit"
                      value={`${draft.ageLimit.min} – ${draft.ageLimit.max} years`}
                    />
                  )}
                  {draft.education?.essential?.length > 0 && (
                    <InfoRow
                      label="Essential Qual."
                      value={draft.education.essential
                        .map(
                          (e) =>
                            `${e.degree}${e.specialization ? ` (${e.specialization})` : ""}`,
                        )
                        .join(", ")}
                    />
                  )}
                  {draft.experience?.required && (
                    <InfoRow
                      label="Experience"
                      value={`${draft.experience.years} years (${draft.experience.type})`}
                    />
                  )}
                </CardContent>
              </Card>

              {/* Documents */}
              {draft.formSections?.some(
                (section) => section.fields?.length > 0,
              ) && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-orange-600" />
                        <h3 className="font-semibold text-gray-900">
                          Form Fields
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editStep("form-builder")}
                        className="text-orange-600 hover:bg-orange-50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {draft.formSections
                      .filter((section) => section.fields?.length > 0)
                      .map((section, index) => (
                        <div
                          key={`${section.title}-${index}`}
                          className="p-3 rounded-lg border border-gray-200"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-gray-900">
                              {section.title}
                            </p>
                            {section.required && (
                              <Badge className="bg-red-100 text-red-800">
                                Required
                              </Badge>
                            )}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {section.fields.map((field, fieldIndex) => (
                              <span
                                key={`${field.label}-${fieldIndex}`}
                                className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700"
                              >
                                {field.label} - {field.type}
                                {field.required ? " - required" : ""}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}

              {draft.documentRequirements?.length > 0 && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-orange-600" />
                        <h3 className="font-semibold text-gray-900">
                          Documents
                        </h3>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editStep("documents")}
                        className="text-orange-600 hover:bg-orange-50"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {draft.documentRequirements.map((doc, i) => (
                        <li
                          key={i}
                          className="flex flex-wrap items-center gap-2 text-sm text-gray-700"
                        >
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="font-medium">{doc.name}</span>
                          {doc.required ? (
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                              Required
                            </span>
                          ) : (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Optional
                            </span>
                          )}
                          {doc.maxSizeKB ? (
                            <span className="text-xs text-gray-500">
                              Max: {doc.maxSizeKB} KB
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-5">
              {/* Payment */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CreditCard className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">
                        Fees
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editStep("basic-info")}
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>General</span>
                    <span className="font-medium">
                      ₹{draft.applicationFee?.general || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>OBC</span>
                    <span className="font-medium">
                      ₹
                      {draft.applicationFee?.obc ??
                        draft.applicationFee?.general ??
                        0}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>SC/ST</span>
                    <span className="font-medium">
                      {(draft.applicationFee?.scSt ?? 0) === 0
                        ? "Free"
                        : `₹${draft.applicationFee?.scSt}`}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>EWS</span>
                    <span className="font-medium">
                      ₹
                      {draft.applicationFee?.ews ??
                        draft.applicationFee?.general ??
                        0}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>PwD</span>
                    <span className="font-medium">
                      {(draft.applicationFee?.pwd ?? 0) === 0
                        ? "Free"
                        : `₹${draft.applicationFee?.pwd}`}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2 text-gray-600">
                    <span>Payment Step</span>
                    <span className="font-medium text-gray-900 text-right">
                      {draft.paymentConfig?.paymentTiming === "after_personal"
                        ? "After Personal Details"
                        : "Before Final Submit"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">
                        Dates
                      </h3>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => editStep("basic-info")}
                      className="text-orange-600 hover:bg-orange-50"
                    >
                      <Edit className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2.5 text-sm">
                  <InfoRow
                    label="Application Start"
                    value={
                      draft.applicationStartDate
                        ? new Date(
                            draft.applicationStartDate,
                          ).toLocaleDateString("en-IN")
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Application Deadline"
                    value={
                      draft.applicationDeadline
                        ? new Date(
                            draft.applicationDeadline,
                          ).toLocaleDateString("en-IN")
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Payment Deadline"
                    value={
                      draft.paymentConfig?.paymentDeadline
                        ? new Date(
                            draft.paymentConfig.paymentDeadline,
                          ).toLocaleDateString("en-IN")
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Correction Window"
                    value={
                      draft.correctionStartDate || draft.correctionDeadline
                        ? `${draft.correctionStartDate ? new Date(draft.correctionStartDate).toLocaleDateString("en-IN") : "-"} to ${draft.correctionDeadline ? new Date(draft.correctionDeadline).toLocaleDateString("en-IN") : "-"}`
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Admit Card Release"
                    value={
                      draft.admitCardReleaseDate
                        ? new Date(
                            draft.admitCardReleaseDate,
                          ).toLocaleDateString("en-IN")
                        : "-"
                    }
                  />
                  <InfoRow
                    label="Exam Date"
                    value={
                      draft.examDate
                        ? new Date(draft.examDate).toLocaleDateString("en-IN")
                        : "—"
                    }
                  />
                  <InfoRow
                    label="Result Publish"
                    value={
                      draft.resultDate
                        ? new Date(draft.resultDate).toLocaleDateString("en-IN")
                        : "-"
                    }
                  />
                </CardContent>
              </Card>

              {/* Publish Actions */}
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-5 space-y-3">
                  <p className="text-sm text-orange-800 font-medium">
                    {isProjectWizard
                      ? "Save this advertisement, then configure admit cards and centers."
                      : isPublishedJob
                        ? "This job is already published."
                        : "Review once more, then publish."}
                  </p>
                  <Button
                    onClick={handlePublish}
                    disabled={isPublishing || missingRequired || (!isProjectWizard && isPublishedJob)}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isPublishedJob && !isProjectWizard ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Published
                      </>
                    ) : isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isProjectWizard ? "Saving..." : "Publishing..."}
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        {isProjectWizard ? "Save & Continue" : "Publish Job"}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSaveDraft}
                    disabled={isPublishing || missingForDraft}
                    className="w-full border-orange-300 text-orange-700 hover:bg-orange-100"
                  >
                    Save as Draft
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={() =>
                navigate(getJobWizardPath("payment", effectiveProjectId, draftJobId))
              }
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back: Payment
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={isPublishing}
              >
                Save Draft
              </Button>{" "}
              <Button
                onClick={handlePublish}
                disabled={isPublishing || missingRequired || (!isProjectWizard && isPublishedJob)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isProjectWizard ? "Saving..." : "Publishing..."}
                  </>
                ) : (
                  isProjectWizard ? "Save & Continue" : "Publish Job"
                )}
              </Button>
            </div>
          </div>
        </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default JobReview;
