/**
 * ApplicationStatus.jsx
 *
 * Read-only view of a submitted/reviewed application.
 * Also handles correction mode — shows a banner with "Edit Application" CTA
 * when admin has requested corrections.
 */

import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  User,
  GraduationCap,
  Loader2,
  ChevronRight,
  Building2,
  Shield,
  Edit3,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";
import {
  getRouteForApplicationStep,
  isCorrectionMode,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

// ── Status config ─────────────────────────────────────────────

const STATUS = {
  draft: {
    label: "Draft",
    color: "bg-gray-100 text-gray-700",
    icon: Clock,
    banner: "bg-gray-50 border-gray-200",
    title: "Application Incomplete",
    desc: "You have not finished filling this application.",
  },
  submitted: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700",
    icon: CheckCircle,
    banner: "bg-blue-50 border-blue-200",
    title: "Application Submitted",
    desc: "Your application has been received and is awaiting review.",
  },
  under_review: {
    label: "Under Review",
    color: "bg-yellow-100 text-yellow-700",
    icon: AlertCircle,
    banner: "bg-yellow-50 border-yellow-200",
    title: "Under Review",
    desc: "Our team is currently reviewing your application and documents.",
  },
  verified: {
    label: "Verified",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
    banner: "bg-green-50 border-green-200",
    title: "Application Verified ✓",
    desc: "Congratulations! Your application has been verified successfully.",
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
    banner: "bg-green-50 border-green-200",
    title: "Application Approved ✓",
    desc: "Congratulations! Your application has been approved.",
  },
  clarification_required: {
    label: "Clarification Required",
    color: "bg-orange-100 text-orange-700",
    icon: AlertCircle,
    banner: "bg-orange-50 border-orange-200",
    title: "Clarification Required",
    desc: "Admin has requested corrections or clarification for your application.",
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
    banner: "bg-red-50 border-red-200",
    title: "Application Rejected",
    desc: "Unfortunately, your application was not approved.",
  },
  shortlisted: {
    label: "Shortlisted",
    color: "bg-purple-100 text-purple-700",
    icon: CheckCircle,
    banner: "bg-purple-50 border-purple-200",
    title: "Shortlisted",
    desc: "You have been shortlisted for the next stage.",
  },
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

const Row = ({ label, value }) =>
  value ? (
    <div className="py-2 border-b border-gray-100 last:border-0 flex gap-4">
      <span className="text-xs text-gray-500 w-36 flex-shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  ) : null;

// ── Timeline ──────────────────────────────────────────────────

const Timeline = ({ app }) => {
  const correctionStatus = app.correction?.status;
  const showCorrectionStep = correctionStatus && correctionStatus !== "none";

  const steps = [
    { label: "Application Started", date: app.createdAt, done: true },
    {
      label: "Application Submitted",
      date: app.submittedAt,
      done: [
        "submitted",
        "under_review",
        "clarification_required",
        "verified",
        "approved",
        "rejected",
      ].includes(app.status),
    },
    {
      label: "Under Review",
      date: app.reviewedAt,
      done: [
        "under_review",
        "clarification_required",
        "verified",
        "approved",
        "rejected",
      ].includes(app.status),
    },
    ...(showCorrectionStep
      ? [
          {
            label:
              correctionStatus === "submitted"
                ? "Corrections Submitted"
                : correctionStatus === "in_progress"
                  ? "Correction In Progress"
                  : "Correction Requested",
            date:
              correctionStatus === "submitted"
                ? app.correction?.submittedAt
                : app.correction?.requestedAt,
            done: true,
            correction: true,
          },
        ]
      : []),
    {
      label: app.status === "rejected" ? "Rejected" : "Verified / Approved",
      date: app.reviewedAt,
      done: ["verified", "approved", "rejected"].includes(app.status),
      rejected: app.status === "rejected",
    },
  ];

  return (
    <div className="space-y-0">
      {steps.map((step, i) => (
        <div key={i} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${
                step.done
                  ? step.rejected
                    ? "bg-red-100 border-red-400"
                    : step.correction
                      ? "bg-orange-100 border-orange-400"
                      : "bg-green-100 border-green-400"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              {step.done ? (
                step.rejected ? (
                  <XCircle className="w-4 h-4 text-red-600" />
                ) : step.correction ? (
                  <Edit3 className="w-4 h-4 text-orange-600" />
                ) : (
                  <CheckCircle className="w-4 h-4 text-green-600" />
                )
              ) : (
                <Clock className="w-4 h-4 text-gray-400" />
              )}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`w-0.5 h-8 ${step.done ? "bg-green-300" : "bg-gray-200"}`}
              />
            )}
          </div>
          <div className="pb-6 flex-1">
            <p
              className={`text-sm font-semibold ${
                step.done
                  ? step.rejected
                    ? "text-red-700"
                    : step.correction
                      ? "text-orange-700"
                      : "text-gray-900"
                  : "text-gray-400"
              }`}
            >
              {step.label}
            </p>
            {step.date && step.done && (
              <p className="text-xs text-gray-400 mt-0.5">
                {formatDate(step.date)}
              </p>
            )}
            {!step.done && (
              <p className="text-xs text-gray-400 mt-0.5">Pending</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────

const ApplicationStatus = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-application-status", id],
    queryFn: () => candidateService.getApplication(id),
    enabled: Boolean(id),
    staleTime: 30000,
  });

  const app = data?.application || data;

  if (isLoading)
    return (
      <CandidateLayout title="Application Status">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <span className="ml-3 text-gray-600">Loading application...</span>
        </div>
      </CandidateLayout>
    );

  if (!app)
    return (
      <CandidateLayout title="Application Status">
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Application not found</p>
          <Button
            variant="outline"
            onClick={() => navigate("/candidate/applications")}
            className="mt-4"
          >
            Back to Applications
          </Button>
        </div>
      </CandidateLayout>
    );

  // If draft — redirect to form
  if (app.status === "draft") {
    persistApplicationDraft({ applicationId: app._id, jobId: app.jobId?._id });
    navigate(getRouteForApplicationStep(app, app.currentStep || 1), {
      state: { applicationId: app._id, jobId: app.jobId?._id },
      replace: true,
    });
    return null;
  }

  const correctionNeeded = isCorrectionMode(app);
  const correctionSubmitted = app.correction?.status === "submitted";
  const correctionNote = app.correction?.note;

  const cfg = STATUS[app.status] || STATUS.submitted;
  const StatusIcon = cfg.icon;
  const personal = app.personalDetails || {};
  const education = app.education || {};
  const address = app.address || {};
  const documents = app.documents || [];
  const formResponses =
    app.formResponses instanceof Map
      ? Object.fromEntries(app.formResponses)
      : app.formResponses || {};
  const fieldLabelMap = {};
  (app.jobId?.formSections || []).forEach((section) => {
    (section.fields || []).forEach((field) => {
      fieldLabelMap[String(field._id)] = field.label;
    });
  });
  const fee = app.totalFee || 0;

  const handleEditCorrection = () => {
    persistApplicationDraft({
      applicationId: app._id,
      jobId: app.jobId?._id,
      correctionMode: true,
    });
    // Navigate to step 1 — sidebar is fully unlocked in correction mode
    navigate(getRouteForApplicationStep(app, 1), {
      state: { applicationId: app._id, jobId: app.jobId?._id },
    });
  };

  return (
    <CandidateLayout title="Application Status">
      <div className="space-y-6 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <button
            onClick={() => navigate("/candidate/applications")}
            className="hover:text-orange-600 transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            My Applications
          </button>
          <ChevronRight className="w-3.5 h-3.5" />
          <span className="text-gray-800 font-medium truncate">
            {app.applicationId}
          </span>
        </div>

        {/* Correction required banner — highest priority, shown above status */}
        {correctionNeeded && (
          <div className="rounded-xl border-2 border-orange-400 bg-orange-50 p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Edit3 className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-bold text-orange-900">
                  Action Required — Corrections Requested
                </h2>
                <p className="text-sm text-orange-700 mt-1">
                  The admin has reviewed your application and is requesting
                  corrections. Please edit your application and resubmit.
                </p>
                {correctionNote && (
                  <div className="mt-3 bg-white border border-orange-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-orange-800 mb-1">
                      Admin Note:
                    </p>
                    <p className="text-sm text-orange-700">{correctionNote}</p>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    onClick={handleEditCorrection}
                    className="bg-orange-600 hover:bg-orange-700 text-white gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Application Now
                  </Button>
                  <Button
                    variant="outline"
                    className="border-orange-300 text-orange-700 hover:bg-orange-100"
                    onClick={() => navigate("/candidate/support")}
                  >
                    View Support Ticket
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Corrections submitted — waiting for re-review */}
        {correctionSubmitted && (
          <div className="rounded-xl border border-blue-300 bg-blue-50 p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">
                Corrections Submitted — Awaiting Re-Review
              </p>
              <p className="text-blue-700 text-sm mt-0.5">
                Your corrections have been submitted on{" "}
                {formatDate(app.correction?.submittedAt)}. The admin will review
                shortly.
              </p>
            </div>
          </div>
        )}

        {/* Status banner */}
        <div className={`rounded-xl border p-5 ${cfg.banner}`}>
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                app.status === "rejected"
                  ? "bg-red-100"
                  : ["verified", "approved"].includes(app.status)
                    ? "bg-green-100"
                    : app.status === "under_review"
                      ? "bg-yellow-100"
                      : "bg-blue-100"
              }`}
            >
              <StatusIcon
                className={`w-6 h-6 ${
                  app.status === "rejected"
                    ? "text-red-600"
                    : ["verified", "approved"].includes(app.status)
                      ? "text-green-600"
                      : app.status === "under_review"
                        ? "text-yellow-600"
                        : "text-blue-600"
                }`}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-lg font-bold text-gray-900">{cfg.title}</h2>
                <Badge className={cfg.color}>{cfg.label}</Badge>
              </div>
              <p className="text-sm text-gray-600 mt-1">{cfg.desc}</p>
              {app.status === "rejected" && app.rejectionReason && (
                <div className="mt-3 bg-red-100 border border-red-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-red-800 mb-1">
                    Rejection Reason:
                  </p>
                  <p className="text-sm text-red-700">{app.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-6">
          {/* Left — Application details */}
          <div className="lg:col-span-2 space-y-5 min-w-0">
            {/* Job info */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  Job Details
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <Row label="Job Title" value={app.jobId?.title} />
                  <Row label="Department" value={app.jobId?.department} />
                  <Row label="Post Code" value={app.jobId?.postCode} />
                  <Row label="Application ID" value={app.applicationId} />
                  <Row
                    label="Submitted On"
                    value={formatDate(app.submittedAt)}
                  />
                  <Row label="Payment Status" value={app.paymentStatus} />
                  {fee > 0 && (
                    <Row
                      label="Fee Paid"
                      value={`₹${fee.toLocaleString("en-IN")}`}
                    />
                  )}
                  {app.transactionId && (
                    <Row label="Transaction ID" value={app.transactionId} />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dynamic form responses */}
            {Object.keys(formResponses).length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    Application Form
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    {Object.entries(formResponses).map(([fieldId, value]) => (
                      <Row
                        key={fieldId}
                        label={fieldLabelMap[fieldId] || fieldId}
                        value={
                          typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : Array.isArray(value)
                              ? value.join(", ")
                              : String(value)
                        }
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Personal details */}
            {Object.keys(personal).length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <User className="w-4 h-4 text-orange-600" />
                    Personal Details
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                    <div>
                      <Row label="Full Name" value={personal.fullName} />
                      <Row
                        label="Date of Birth"
                        value={
                          personal.dateOfBirth
                            ? new Date(personal.dateOfBirth).toLocaleDateString(
                                "en-IN",
                              )
                            : null
                        }
                      />
                      <Row label="Gender" value={personal.gender} />
                      <Row
                        label="Category"
                        value={personal.category?.toUpperCase()}
                      />
                      <Row
                        label="Mobile"
                        value={
                          personal.registeredMobile
                            ? `+91 ${personal.registeredMobile}`
                            : null
                        }
                      />
                    </div>
                    <div>
                      <Row label="Father's Name" value={personal.fatherName} />
                      <Row label="Mother's Name" value={personal.motherName} />
                      <Row
                        label="Marital Status"
                        value={personal.maritalStatus}
                      />
                      <Row label="Religion" value={personal.religion} />
                      <Row
                        label="Bihar Domicile"
                        value={
                          personal.isDomicileOfBihar != null
                            ? personal.isDomicileOfBihar
                              ? "Yes"
                              : "No"
                            : null
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Education */}
            {(education.tenth || education.twelfth || education.graduation) && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-orange-600" />
                    Education
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {education.tenth && (
                    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Level</p>
                        <p className="font-medium">10th</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Board</p>
                        <p className="font-medium">
                          {education.tenth.board || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Year</p>
                        <p className="font-medium">
                          {education.tenth.year || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Percentage</p>
                        <p className="font-medium">
                          {education.tenth.percentage
                            ? `${education.tenth.percentage}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                  {education.twelfth && (
                    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Level</p>
                        <p className="font-medium">12th</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Board</p>
                        <p className="font-medium">
                          {education.twelfth.board || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Year</p>
                        <p className="font-medium">
                          {education.twelfth.year || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Percentage</p>
                        <p className="font-medium">
                          {education.twelfth.percentage
                            ? `${education.twelfth.percentage}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                  {education.graduation && (
                    <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-gray-500">Level</p>
                        <p className="font-medium">Graduation</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Degree</p>
                        <p className="font-medium">
                          {education.graduation.degree || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Year</p>
                        <p className="font-medium">
                          {education.graduation.year || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Percentage</p>
                        <p className="font-medium">
                          {education.graduation.percentage
                            ? `${education.graduation.percentage}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-orange-600" />
                    Documents (
                    {
                      documents.filter(
                        (d) =>
                          d.status === "uploaded" || d.status === "verified",
                      ).length
                    }
                    /{documents.length})
                  </h3>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {documents.map((doc) => (
                      <div
                        key={doc._id || doc.type}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          doc.status === "verified"
                            ? "bg-green-50 border-green-200"
                            : doc.status === "rejected"
                              ? "bg-red-50 border-red-200"
                              : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {doc.status === "verified" ? (
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          ) : doc.status === "rejected" ? (
                            <XCircle className="w-4 h-4 text-red-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-xs font-medium text-gray-700 capitalize">
                            {doc.type.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs font-semibold capitalize ${
                              doc.status === "verified"
                                ? "text-green-600"
                                : doc.status === "rejected"
                                  ? "text-red-600"
                                  : "text-gray-500"
                            }`}
                          >
                            {doc.status}
                          </span>
                          {doc.cloudinaryUrl && (
                            <a
                              href={doc.cloudinaryUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right — Timeline + Actions */}
          <div className="space-y-5 min-w-0">
            {/* Timeline */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800">
                  Application Timeline
                </h3>
              </CardHeader>
              <CardContent>
                <Timeline app={app} />
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800">Actions</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Primary CTA in correction mode */}
                {correctionNeeded && (
                  <Button
                    className="w-full justify-start gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={handleEditCorrection}
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Application
                  </Button>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-gray-700"
                  onClick={() => navigate("/candidate/applications")}
                >
                  <ArrowLeft className="w-4 h-4" />
                  All Applications
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 text-orange-600 border-orange-200 hover:bg-orange-50"
                  onClick={() => navigate("/candidate/support")}
                >
                  <AlertCircle className="w-4 h-4" />
                  {correctionNeeded
                    ? "View Support Ticket"
                    : "Raise Support Ticket"}
                </Button>
                {app.jobId?._id && (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 text-gray-700"
                    onClick={() => navigate(`/jobs/${app.jobId._id}`)}
                  >
                    <Building2 className="w-4 h-4" />
                    View Job Details
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Application ID card */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-orange-800 mb-1">
                  Application ID
                </p>
                <p className="font-mono text-sm font-bold text-orange-700 break-all">
                  {app.applicationId}
                </p>
                <p className="text-xs text-orange-600 mt-2">
                  Keep this ID for future reference
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
};

export default ApplicationStatus;
