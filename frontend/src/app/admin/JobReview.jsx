import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const STORAGE_KEY = "job_draft";

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
      .filter((section) => section.title && section.fields.length > 0);
  }

  // Payment config — only safe fields
  if (draft.paymentConfig) {
    payload.paymentConfig = {
      applicationFee: num(draft.paymentConfig.applicationFee) || 0,
      processingFee: num(draft.paymentConfig.processingFee) || 0,
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

const JobReview = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const [isPublishing, setIsPublishing] = useState(false);

  // Read accumulated draft from sessionStorage
  const draft = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  })();

  // For DRAFT: only need projectId + title + postCode + department
  const missingForDraft =
    !draft.title ||
    !draft.postCode ||
    !draft.department ||
    !draft.projectId ||
    !/^[a-f\d]{24}$/i.test(draft.projectId || "");

  // For PUBLISH: also need posts + applicationDeadline
  const missingRequired = missingForDraft || !draft.posts?.length;

  const missingFields = [
    (!draft.projectId || !/^[a-f\d]{24}$/i.test(draft.projectId)) &&
      "Project — go back to Jobs, select a project, then click Create Job",
    !draft.title && "Job Title (Step 1)",
    !draft.postCode && "Post Code (Step 1)",
    !draft.department && "Department (Step 1)",
    !draft.posts?.length && "Post Types / Designations (Step 1)",
  ].filter(Boolean);

  // Step 1: Create job as draft
  const { mutateAsync: createJob } = useMutation({
    mutationFn: adminService.createJob,
  });

  // Step 2: Update job with all details
  const { mutateAsync: updateJob } = useMutation({
    mutationFn: ({ id, data }) => adminService.updateJob(id, data),
  });

  // Step 3: Publish job
  const { mutateAsync: publishJob } = useMutation({
    mutationFn: adminService.publishJob,
  });

  // Validate projectId is a valid MongoDB ObjectId (24 hex chars)
  const isValidObjectId = (id) => /^[a-f\d]{24}$/i.test(id);

  const readStoredDraft = () => {
    try {
      const storedDraft = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
      return Object.keys(storedDraft).length ? storedDraft : draft;
    } catch {
      return draft;
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
        if (existing?.job?._id) return existingJobId;
      } catch (err) {
        if (![404, 400].includes(err?.status)) throw err;
        clearStoredJobId();
      }
    }

    const createPayload = {
      projectId: currentDraft.projectId || draft.projectId,
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
          const jobId = res?.job?._id;
          if (jobId) {
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
        "Please complete Step 1 (Basic Info) first — title, post code, department, and project are required.",
      );
      return;
    }
    try {
      setIsPublishing(true);
      const jobId = await getOrCreateJobId();
      if (!jobId) return; // error already shown
      const updatePayload = buildUpdatePayload(draft);
      if (Object.keys(updatePayload).length > 0) {
        await savePayloadToJob(jobId, updatePayload);
        if (false) {
          // Log for debugging but don't block — job was created as draft
          toast.success("Job saved as draft (some optional fields skipped)");
          sessionStorage.removeItem(STORAGE_KEY);
          queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
          navigate("/admin/jobs");
          return;
        }
      }
      toast.success("Job saved as draft");
      sessionStorage.removeItem(STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      navigate("/admin/jobs");
    } catch (err) {
      toast.error(err.message || "Failed to save job");
    } finally {
      setIsPublishing(false);
    }
  };

  const handlePublish = async () => {
    if (missingForDraft) {
      toast.error("Please complete Step 1 (Basic Info) first");
      return;
    }
    if (!draft.applicationStartDate) {
      toast.error("Application start date is required to publish");
      return;
    }
    if (!draft.applicationDeadline) {
      toast.error("Application deadline is required to publish");
      return;
    }
    if (!draft.posts?.length || !draft.totalPosts || draft.totalPosts < 1) {
      toast.error("Post types and vacancies are required to publish");
      return;
    }
    try {
      setIsPublishing(true);
      const jobId = await getOrCreateJobId();
      if (!jobId) return;
      const updatePayload = buildUpdatePayload(draft);
      let publishJobId = jobId;
      if (Object.keys(updatePayload).length > 0) {
        publishJobId = await savePayloadToJob(jobId, updatePayload);
      }
      await publishJob(publishJobId);
      toast.success("Job published successfully!");
      sessionStorage.removeItem(STORAGE_KEY);
      queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      navigate("/admin/jobs");
    } catch (err) {
      toast.error(err.message || "Failed to publish job");
    } finally {
      setIsPublishing(false);
    }
  };

  const InfoRow = ({ label, value }) => (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3">
      <span className="text-sm font-medium text-gray-500 sm:w-36 flex-shrink-0">
        {label}:
      </span>
      <span className="text-sm text-gray-900">{value || "—"}</span>
    </div>
  );

  const editStep = (step) =>
    navigate(
      `/admin/jobs/create/${step}?${projectId ? `project=${projectId}&` : ""}returnTo=review`,
    );

  return (
    <AdminLayout title="Create Job - Review">
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Create Job Posting
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Step 6 of 6: Review & Publish
              </p>
            </div>
            <Badge className="bg-orange-100 text-orange-800">
              Ready to Publish
            </Badge>
          </div>

          <JobStepProgress currentStep={6} projectId={projectId} clickable />

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
                  Go back to Step 1 to complete these fields.
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
                        Basic Information
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
                  {false && draft.salaryRange?.min && (
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
                        Eligibility Criteria
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
                          Application Form Sections
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
                          Required Documents
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
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                          {doc.name} {doc.required ? "" : "(Optional)"}
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
                        Application Fees
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
                </CardContent>
              </Card>

              {/* Dates */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-gray-900">
                        Important Dates
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
                    Review all information carefully. Published jobs are
                    immediately visible to candidates.
                  </p>
                  <Button
                    onClick={handlePublish}
                    disabled={isPublishing || missingRequired}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Publishing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Publish Job
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
                navigate(
                  `/admin/jobs/create/payment${projectId ? `?project=${projectId}` : ""}`,
                )
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
                disabled={isPublishing || missingRequired}
                className="bg-orange-600 hover:bg-orange-700 text-white px-8"
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish Job"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default JobReview;
