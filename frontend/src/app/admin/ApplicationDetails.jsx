import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  FileText,
  Loader2,
  User,
  GraduationCap,
  MapPin,
  Upload,
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download,
  AlertCircle,
  Info,
  ChevronRight,
  ListChecks,
  Plus,
  Trash2,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import Button from "../../components/ui/Button";
import { adminService } from "../../services/admin.service";

const STATUS_CFG = {
  draft: {
    label: "Draft",
    cls: "bg-gray-100 text-gray-700",
    dot: "bg-gray-400",
  },
  submitted: {
    label: "Auto Approved",
    cls: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  under_review: {
    label: "Under Review",
    cls: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  verified: {
    label: "Approved",
    cls: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  approved: {
    label: "Approved",
    cls: "bg-emerald-100 text-emerald-800",
    dot: "bg-emerald-500",
  },
  clarification_required: {
    label: "Clarification Required",
    cls: "bg-orange-100 text-orange-800",
    dot: "bg-orange-500",
  },
  rejected: {
    label: "Rejected",
    cls: "bg-red-100 text-red-800",
    dot: "bg-red-500",
  },
};

const PAY_CFG = {
  paid: "bg-emerald-100 text-emerald-800",
  pending: "bg-amber-100 text-amber-800",
  failed: "bg-red-100 text-red-800",
};

const TABS = [
  { id: "personal", label: "Personal Details", icon: User },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "additional", label: "Additional Info", icon: Info },
  { id: "address", label: "Address", icon: MapPin },
  { id: "custom", label: "Application Form", icon: FileText },
  { id: "documents", label: "Documents", icon: Upload },
  { id: "posts", label: "Applied Posts", icon: ListChecks },
  { id: "payment", label: "Payment", icon: CreditCard },
];

const Row = ({ label, value }) =>
  value !== undefined && value !== null && value !== "" ? (
    <div className="py-2.5 border-b border-gray-100 last:border-0">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{label}</p>
      <p className="text-[15px] font-semibold leading-6 text-gray-900">
        {typeof value === "boolean" ? (value ? "Yes" : "No") : value}
      </p>
    </div>
  ) : null;

const Grid = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">{children}</div>
);

const formatAdminValue = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") {
    if (value.name) return value.name;
    if (value.label) return value.label;
    return Object.entries(value)
      .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(", ") : val}`)
      .join(", ");
  }
  return value;
};

const formatCurrency = (value) =>
  Number(value || 0) > 0 ? `₹${Number(value).toLocaleString("en-IN")}` : "—";

const ISSUE_TYPES = [
  "Mismatch with document",
  "Incorrect value entered",
  "Document unclear",
  "Document missing",
  "Invalid proof",
  "Spelling / formatting issue",
  "Other clarification needed",
];

const stringifyIssueValue = (value) => {
  if (value === undefined || value === null || value === "") return "";
  if (value instanceof Date) return value.toLocaleDateString("en-IN");
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ");
  }
  return String(value);
};

const makeIssueOption = (section, fieldKey, fieldLabel, value) => ({
  section,
  fieldKey,
  fieldLabel,
  currentValue: stringifyIssueValue(value),
});

const isCorrectionResolved = (correction) => {
  if (!correction || correction.status === "none") return false;
  if (correction.status === "resolved") return true;
  const issues = correction.issues || [];
  return (
    correction.status === "submitted" &&
    issues.length > 0 &&
    issues.every((issue) => issue.status === "resolved")
  );
};

const getCorrectionDisplayStatus = (correction) =>
  isCorrectionResolved(correction) ? "resolved" : correction?.status || "requested";

const EduCard = ({ title, data }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-bold leading-5 text-gray-900">
        <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
        {title}
      </h4>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          ["Board/University", data.board || data.university],
          ["School/College", data.school || data.college],
          ["Year", data.year],
          ["Percentage", data.percentage ? `${data.percentage}%` : null],
          ["Stream/Degree", data.stream || data.degree],
          ["Roll Number", data.rollNumber],
        ].map(([l, v]) =>
          v ? (
            <div key={l}>
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{l}</p>
              <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">{v}</p>
            </div>
          ) : null,
        )}
      </div>
    </div>
  );
};

const AddrCard = ({ title, data }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60">
      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
        {title}
      </h4>
      {[
        ["Address Line 1", data.addressLine1],
        ["Address Line 2", data.addressLine2],
        ["District", data.district],
        ["State", data.state],
        ["Police Station", data.policeStation],
        ["Pincode", data.pincode],
      ].map(([l, v]) =>
        v ? (
          <div
            key={l}
            className="py-1.5 border-b border-gray-100 last:border-0"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">{l}</p>
            <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">{v}</p>
          </div>
        ) : null,
      )}
    </div>
  );
};

const ApplicationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("custom");
  const [clarificationNote, setClarificationNote] = useState("");
  const [clarificationIssues, setClarificationIssues] = useState([]);
  const [selectedIssueField, setSelectedIssueField] = useState("");
  const [correctionReviewNote, setCorrectionReviewNote] = useState("");
  const [showClarificationModal, setShowClarificationModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-application", id],
    queryFn: () => adminService.getApplication(id),
  });

  const application = data?.application || data;

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: ({ status, notes, correctionIssues }) =>
      adminService.updateApplicationStatus(id, {
        status,
        notes,
        rejectionReason: notes,
        correctionIssues,
      }),
    onSuccess: (_, vars) => {
      toast.success(
        vars.status === "verified"
          ? "Application verified"
          : vars.status === "rejected"
            ? "Application rejected"
            : vars.status === "clarification_required"
              ? "Clarification requested"
            : "Status updated",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-application", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
      setShowClarificationModal(false);
      setClarificationNote("");
      setClarificationIssues([]);
      setSelectedIssueField("");
    },
    onError: (err) => toast.error(err.message || "Failed to update"),
  });

  const { mutate: reviewCorrection, isPending: isReviewingCorrection } =
    useMutation({
      mutationFn: ({ action, notes }) =>
        adminService.reviewApplicationCorrection(id, { action, notes }),
      onSuccess: (_, vars) => {
        toast.success(
          vars.action === "approve"
            ? "Correction accepted and application approved"
            : "Correction sent back to candidate",
        );
        queryClient.invalidateQueries({ queryKey: ["admin-application", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
        setCorrectionReviewNote("");
      },
      onError: (err) =>
        toast.error(err.message || "Failed to review correction"),
    });

  if (isLoading)
    return (
      <AdminLayout title="Application Details">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );

  if (!application)
    return (
      <AdminLayout title="Application Details">
        <div className="min-h-full p-6 flex flex-col items-center justify-center h-96 gap-4">
          <FileText className="w-12 h-12 text-gray-300" />
          <p className="text-gray-500">Application not found</p>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/applications")}
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
        </div>
      </AdminLayout>
    );

  // exact model fields
  const personal = application.personalDetails || {};
  const education = application.education || {};
  const additional = application.additionalInfo || {};
  const address = application.address || {};
  const documents = Array.isArray(application.documents)
    ? application.documents
    : [];
  const formResponses = application.formResponses || {};
  const fieldLabelMap = {};
  (application.jobId?.formSections || []).forEach((section) => {
    (section.fields || []).forEach((field) => {
      fieldLabelMap[String(field._id)] = field.label;
      if (field.id) fieldLabelMap[String(field.id)] = field.label;
      if (field.name) fieldLabelMap[String(field.name)] = field.label;
    });
  });
  const canRequestClarification = ["submitted", "approved", "verified"].includes(
    application.status,
  );
  const correctionIssues = application.correction?.issues || [];
  const correctionDisplayStatus = getCorrectionDisplayStatus(
    application.correction,
  );
  const submittedCorrection = [...(application.corrections || [])]
    .reverse()
    .find((item) => item.status === "pending");

  const correctionFieldOptions = [
    makeIssueOption("Personal Details", "personalDetails.fullName", "Full Name", personal.fullName),
    makeIssueOption("Personal Details", "personalDetails.fatherName", "Father's Name", personal.fatherName),
    makeIssueOption("Personal Details", "personalDetails.motherName", "Mother's Name", personal.motherName),
    makeIssueOption("Personal Details", "personalDetails.dateOfBirth", "Date of Birth", personal.dateOfBirth ? new Date(personal.dateOfBirth) : ""),
    makeIssueOption("Personal Details", "personalDetails.gender", "Gender", personal.gender),
    makeIssueOption("Personal Details", "personalDetails.category", "Category", personal.category),
    makeIssueOption("Personal Details", "personalDetails.identificationMark", "Identification Mark", personal.identificationMark),
    makeIssueOption("Education", "education.tenth", "10th Details", education.tenth),
    makeIssueOption("Education", "education.twelfth", "12th Details", education.twelfth),
    makeIssueOption("Education", "education.graduation", "Graduation Details", education.graduation),
    makeIssueOption("Additional Info", "additionalInfo.isGovtEmployee", "Govt Employee", additional.isGovtEmployee),
    makeIssueOption("Additional Info", "additionalInfo.isPwD", "PwD Details", additional.isPwD),
    makeIssueOption("Address", "address.permanent", "Permanent Address", address.permanent),
    makeIssueOption("Address", "address.correspondence", "Correspondence Address", address.correspondence),
    ...Object.entries(formResponses || {}).map(([fieldId, value]) =>
      makeIssueOption("Application Form", `formResponses.${fieldId}`, fieldLabelMap[fieldId] || fieldId, formatAdminValue(value)),
    ),
    ...documents.map((doc) =>
      makeIssueOption("Documents", `documents.${doc.type || doc._id}`, doc.name || doc.type?.replace(/_/g, " ") || "Document", doc.originalName || doc.status || "Uploaded"),
    ),
  ].filter((option) => option.fieldKey && option.fieldLabel);

  const addClarificationIssue = () => {
    const option = correctionFieldOptions.find((item) => item.fieldKey === selectedIssueField);
    if (!option) {
      toast.error("Select a field or document first");
      return;
    }
    if (clarificationIssues.some((item) => item.fieldKey === option.fieldKey)) {
      toast.error("This field is already added");
      return;
    }
    setClarificationIssues((items) => [
      ...items,
      {
        ...option,
        issueType: ISSUE_TYPES[0],
        remark: "",
      },
    ]);
    setSelectedIssueField("");
  };

  const updateClarificationIssue = (index, key, value) => {
    setClarificationIssues((items) =>
      items.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    );
  };

  const removeClarificationIssue = (index) => {
    setClarificationIssues((items) => items.filter((_, idx) => idx !== index));
  };

  const sCfg = STATUS_CFG[application.status] || STATUS_CFG.draft;
  const payCfg =
    PAY_CFG[application.paymentStatus] || "bg-gray-100 text-gray-600";
  const candidateName =
    personal.fullName ||
    application.candidateId?.fullName ||
    application.candidate?.fullName ||
    "";
  const candidateEmail =
    application.contactEmail ||
    application.candidateId?.email ||
    application.candidate?.email ||
    personal.email ||
    "";
  const candidateMobile =
    application.contactMobile ||
    personal.registeredMobile ||
    application.candidateId?.registeredMobile ||
    application.candidateId?.contactNumber ||
    application.candidate?.registeredMobile ||
    "";
  const initials = (candidateName || "?")
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <AdminLayout title="Application Details">
      <div className="min-h-full p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin/applications")}
              className="w-9 h-9 flex items-center justify-center rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold leading-tight text-gray-900">
                  Application Details
                </h1>
                <ChevronRight className="w-4 h-4 text-gray-400" />
                <span className="font-mono text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg">
                  {application.registrationNumber || application.applicationId || id}
                </span>
                {application.registrationNumber && (
                  <span className="font-mono text-xs text-gray-500">
                    {application.applicationId}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm leading-5 text-gray-500">
                {application.submittedAt
                  ? `Submitted on ${new Date(application.submittedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" })}`
                  : "Not yet submitted"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${sCfg.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
              {sCfg.label}
            </span>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${payCfg}`}
            >
              {application.paymentStatus || "Unpaid"}
            </span>
          </div>
        </div>

        {/* Summary Hero */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-5 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold leading-tight text-white">
                {candidateName || (
                  <span className="opacity-60 italic font-normal text-base">
                    Name not provided
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm leading-5 text-orange-100">
                {candidateEmail || "—"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-y lg:divide-y-0 divide-gray-100">
            {[
              {
                label: "Registration No.",
                val: application.registrationNumber || "Pending",
                sub: application.applicationId,
              },
              {
                label: "Job Applied",
                val: application.jobId?.title,
                sub: application.jobId?.department,
              },
              { label: "Category", val: personal.category || "-", sub: null },
              {
                label: "Mobile",
                val:
                  candidateMobile || "—",
                sub: null,
              },
              {
                label: "Fee",
                val: formatCurrency(application.totalFee),
                sub: application.transactionId,
              },
            ].map(({ label, val, sub }) => (
              <div key={label} className="px-5 py-4">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                  {label}
                </p>
                <p className="text-[15px] font-semibold leading-6 text-gray-900">
                  {val || "-"}
                </p>
                {sub && (
                  <p className="mt-0.5 truncate text-xs leading-5 text-gray-400">{sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {canRequestClarification && (
          <div className="bg-white rounded-2xl border-l-4 border-l-orange-500 border border-orange-200 shadow-sm p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Application Auto Approved
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    Paid applications are approved automatically. Request a
                    correction only if candidate details need clarification.
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowClarificationModal(true)}
                disabled={isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                <AlertCircle className="w-4 h-4 mr-1.5" />
                Request Clarification
              </Button>
            </div>
          </div>
        )}

        {application.correction?.status !== "none" && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-orange-700">
                  Correction Status
                </p>
                <h3 className="mt-1.5 text-lg font-bold leading-tight text-gray-900">
                  {correctionDisplayStatus.replaceAll("_", " ")}
                </h3>
                {application.correction?.note && (
                  <p className="mt-2 text-sm leading-6 text-gray-700">{application.correction.note}</p>
                )}
              </div>
              {application.correction?.requestedAt && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-600">
                  Requested {new Date(application.correction.requestedAt).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
            {correctionIssues.length > 0 && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {correctionIssues.map((issue, idx) => (
                  <div key={issue._id || `${issue.fieldKey}-${idx}`} className="rounded-xl border border-orange-100 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                          {issue.section}
                        </p>
                        <p className="mt-1 text-sm font-bold leading-5 text-gray-900">
                          {issue.fieldLabel}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        issue.status === "resolved"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        {issue.status || "pending"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-semibold leading-5 text-orange-700">{issue.issueType}</p>
                    {issue.currentValue && (
                      <p className="mt-1 text-xs leading-5 text-gray-500">
                        Current: <span className="font-medium text-gray-700">{issue.currentValue}</span>
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-6 text-gray-700">{issue.remark}</p>
                  </div>
                ))}
              </div>
            )}
            {submittedCorrection && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-700">
                      Candidate Submitted Correction
                    </p>
                    <h3 className="mt-1.5 text-lg font-bold leading-tight text-gray-900">
                      Review corrected values before final approval
                    </h3>
                    {submittedCorrection.reason && (
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        {submittedCorrection.reason}
                      </p>
                    )}
                  </div>
                  <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700">
                    Pending review
                  </span>
                </div>

                <div className="mt-5 grid gap-4">
                  {(submittedCorrection.requestedFields || []).map(
                    (field, index) => (
                      <div
                        key={`${field.field}-${index}`}
                        className="rounded-2xl border border-gray-200 bg-gray-50/70 p-5"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-xs font-bold uppercase tracking-[0.08em] text-orange-600">
                              {field.fieldLabel || field.field}
                            </p>
                            <p className="mt-1 break-all font-mono text-xs leading-5 text-gray-500">
                              {field.field}
                            </p>
                          </div>
                          <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700">
                            Candidate response
                          </span>
                        </div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          <div className="min-h-[84px] rounded-xl border border-red-100 bg-white p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-red-500">
                              Previous Value
                            </p>
                            <p className="mt-2 break-words text-sm font-semibold leading-6 text-gray-900">
                              {field.oldValue || "Not provided"}
                            </p>
                          </div>
                          <div className="min-h-[84px] rounded-xl border border-emerald-100 bg-white p-4">
                            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-emerald-600">
                              Corrected Value
                            </p>
                            <p className="mt-2 break-words text-sm font-semibold leading-6 text-gray-900">
                              {field.newValue || "Not provided"}
                            </p>
                          </div>
                        </div>
                        {field.reason && (
                          <p className="mt-4 rounded-xl border border-gray-100 bg-white p-4 text-sm leading-6 text-gray-700">
                            <span className="font-semibold text-gray-900">
                              Candidate note:
                            </span>{" "}
                            {field.reason}
                          </p>
                        )}
                      </div>
                    ),
                  )} 
                </div>

                <div className="mt-5">
                  <label className="mb-2 block text-xs font-bold uppercase tracking-[0.08em] text-gray-500">
                    Reviewer Decision Note
                  </label>
                  <textarea
                    rows={3}
                    value={correctionReviewNote}
                    onChange={(e) => setCorrectionReviewNote(e.target.value)}
                    placeholder="Optional note for audit and candidate communication"
                    className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  />
                </div>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Button
                    onClick={() =>
                      reviewCorrection({
                        action: "approve",
                        notes: correctionReviewNote,
                      })
                    }
                    disabled={isReviewingCorrection}
                    className="h-12 min-w-[260px] bg-emerald-600 px-6 text-white hover:bg-emerald-700"
                  >
                    {isReviewingCorrection ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle className="mr-1.5 h-4 w-4" />
                        Accept & Approve Application
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      reviewCorrection({
                        action: "request_again",
                        notes: correctionReviewNote,
                      })
                    }
                    disabled={isReviewingCorrection}
                    className="h-12 min-w-[260px] border-orange-200 px-6 text-orange-700 hover:bg-orange-50"
                  >
                    <AlertCircle className="mr-1.5 h-4 w-4" />
                    Send Back for Correction
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tabs + Content */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-4 gap-5">
          {/* Sidebar */}
          <div className="lg:col-span-1 flex">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 sticky top-24 w-full min-h-[420px] lg:h-full lg:flex lg:flex-col">
              {TABS.map(({ id: tid, label, icon: Icon }) => (
                <button
                  key={tid}
                  onClick={() => setActiveTab(tid)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 last:mb-0 ${
                    activeTab === tid
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content Panel */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm min-h-[420px] max-h-[calc(100vh-240px)] overflow-hidden">
            <div className="hover-scroll h-full overflow-y-auto p-6">
            {/* Admin-configured form */}
            {activeTab === "custom" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Application Form Responses
                  </h3>
                </div>
                {Object.keys(formResponses).length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No form responses submitted yet.
                  </p>
                ) : (
                  <Grid>
                    {Object.entries(formResponses).map(([fieldId, value]) => (
                      <Row
                        key={fieldId}
                        label={fieldLabelMap[fieldId] || fieldId}
                        value={formatAdminValue(value)}
                      />
                    ))}
                  </Grid>
                )}
              </div>
            )}

            {/* Personal */}
            {activeTab === "personal" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Personal Information
                  </h3>
                </div>
                {Object.keys(personal).length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No personal details submitted yet.
                  </p>
                ) : (
                  <Grid>
                    <Row
                      label="Registration Number"
                      value={application.registrationNumber}
                    />
                    <Row
                      label="Application ID"
                      value={application.applicationId}
                    />
                    <Row label="Full Name" value={personal.fullName} />
                    <Row label="Email" value={candidateEmail} />
                    <Row label="Father's Name" value={personal.fatherName} />
                    <Row label="Mother's Name" value={personal.motherName} />
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
                    <Row label="Category" value={personal.category} />
                    <Row
                      label="Marital Status"
                      value={personal.maritalStatus}
                    />
                    <Row label="Religion" value={personal.religion} />
                    <Row label="Mobile" value={candidateMobile} />
                    <Row
                      label="Identification Mark"
                      value={personal.identificationMark}
                    />
                    <Row
                      label="Domicile of Bihar"
                      value={personal.isDomicileOfBihar}
                    />
                  </Grid>
                )}
              </div>
            )}

            {/* Education */}
            {activeTab === "education" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <GraduationCap className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Educational Qualifications
                  </h3>
                </div>
                {Object.keys(education).length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No education details submitted yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <EduCard
                      title="10th (Matriculation)"
                      data={education.tenth}
                    />
                    <EduCard
                      title="12th (Intermediate)"
                      data={education.twelfth}
                    />
                    <EduCard title="Graduation" data={education.graduation} />
                    {education.hasPostGraduation !== undefined && (
                      <Row
                        label="Has Post Graduation"
                        value={education.hasPostGraduation}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Additional Info */}
            {activeTab === "additional" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Info className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Additional Information
                  </h3>
                </div>
                {Object.keys(additional).length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No additional info submitted yet.
                  </p>
                ) : (
                  <Grid>
                    <Row
                      label="Govt Employee"
                      value={additional.isGovtEmployee}
                    />
                    <Row
                      label="Department Name"
                      value={additional.departmentName}
                    />
                    <Row
                      label="Years of Service"
                      value={additional.yearsOfService}
                    />
                    <Row
                      label="Ex-Serviceman"
                      value={additional.isExServiceman}
                    />
                    <Row
                      label="Person with Disability"
                      value={additional.isPwD}
                    />
                    <Row
                      label="Disability Type"
                      value={additional.disabilityType}
                    />
                    <Row
                      label="Disability %"
                      value={
                        additional.disabilityPercentage
                          ? `${additional.disabilityPercentage}%`
                          : null
                      }
                    />
                    <Row
                      label="Driving License"
                      value={additional.drivingLicense}
                    />
                    <Row
                      label="Computer Certificate"
                      value={additional.computerCertificate}
                    />
                    <Row
                      label="Subject Combination"
                      value={additional.subjectCombination}
                    />
                  </Grid>
                )}
              </div>
            )}

            {/* Address */}
            {activeTab === "address" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Address Details
                  </h3>
                </div>
                {Object.keys(address).length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No address details submitted yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <AddrCard
                      title="Permanent Address"
                      data={address.permanent}
                    />
                    <AddrCard
                      title="Correspondence Address"
                      data={address.correspondence}
                    />
                    {address.sameAsPermanent && (
                      <p className="text-sm leading-6 text-gray-500 md:col-span-2">
                        Same as permanent address
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Documents */}
            {activeTab === "documents" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Uploaded Documents
                  </h3>
                  <span className="ml-auto inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    {documents.filter((d) => d.cloudinaryUrl).length} /{" "}
                    {documents.length} uploaded
                  </span>
                </div>
                {documents.length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No documents uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {documents.map((doc) => {
                      const statusCls =
                        doc.status === "verified"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : doc.status === "rejected"
                            ? "text-red-700 bg-red-50 border-red-200"
                            : "text-amber-700 bg-amber-50 border-amber-200";
                      return (
                        <div
                          key={doc._id}
                          className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-5 h-5 text-orange-600" />
                            </div>
                            <div>
                              <p className="text-sm font-bold leading-5 text-gray-900 capitalize">
                                {doc.name || doc.type?.replace(/_/g, " ")}
                              </p>
                              {doc.originalName && (
                                <p className="mt-0.5 text-xs leading-5 text-gray-500">
                                  {doc.originalName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${statusCls}`}
                                >
                                  {doc.status || "pending"}
                                </span>
                                {doc.sizeKB && (
                                  <span className="text-xs leading-5 text-gray-400">
                                    {doc.sizeKB} KB
                                  </span>
                                )}
                              </div>
                              {doc.rejectionReason && (
                                <p className="mt-1 text-xs leading-5 text-red-600">
                                  {doc.rejectionReason}
                                </p>
                              )}
                            </div>
                          </div>
                          {doc.cloudinaryUrl && (
                            <div className="flex gap-2">
                              <a
                                href={doc.cloudinaryUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                                >
                                  <Eye className="w-4 h-4 mr-1" /> View
                                </Button>
                              </a>
                              <a href={doc.cloudinaryUrl} download>
                                <Button variant="outline" size="sm">
                                  <Download className="w-4 h-4" />
                                </Button>
                              </a>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Applied Posts */}
            {activeTab === "posts" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <ListChecks className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">Applied Posts</h3>
                </div>
                {!application.appliedPosts ||
                application.appliedPosts.length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No posts selected yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {application.appliedPosts.map((post, idx) => (
                      <div
                        key={idx}
                        className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-bold leading-5 text-gray-900">
                              {post.title || "Post"}
                            </p>
                            <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                                  Designation
                                </p>
                                <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">
                                  {post.designation || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                                  Department
                                </p>
                                <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">
                                  {post.department || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                                  Vacancies
                                </p>
                                <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">
                                  {post.vacancies || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                                  Preference
                                </p>
                                <p className="mt-1 text-[15px] font-semibold leading-6 text-gray-900">
                                  #{post.preference || "-"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Payment */}
            {activeTab === "payment" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Payment Information
                  </h3>
                </div>
                {!application.totalFee && !application.transactionId ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No payment information available.
                  </p>
                ) : (
                  <div className="space-y-4">
                    <div
                      className={`p-4 rounded-xl flex items-center gap-3 border ${
                        application.paymentStatus === "paid"
                          ? "bg-emerald-50 border-emerald-200"
                          : application.paymentStatus === "pending"
                            ? "bg-amber-50 border-amber-200"
                            : "bg-red-50 border-red-200"
                      }`}
                    >
                      {application.paymentStatus === "paid" ? (
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      ) : application.paymentStatus === "pending" ? (
                        <Clock className="w-5 h-5 text-amber-600" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      <span className="text-sm font-bold leading-5">
                        Payment{" "}
                        {application.paymentStatus === "paid"
                          ? "Successful"
                          : application.paymentStatus || "Unknown"}
                      </span>
                      {application.totalFee > 0 && (
                        <span className="ml-auto text-[15px] font-bold leading-6 text-gray-900">
                          {formatCurrency(application.totalFee)}
                        </span>
                      )}
                    </div>
                    <Grid>
                      <Row
                        label="Payment Status"
                        value={application.paymentStatus}
                      />
                      <Row
                        label="Total Fee"
                        value={
                          application.totalFee
                            ? formatCurrency(application.totalFee)
                            : null
                        }
                      />
                      <Row
                        label="Transaction ID"
                        value={application.transactionId}
                      />
                    </Grid>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* Clarification Modal */}
      {showClarificationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold leading-tight text-gray-900">
                Request Field Correction
              </h3>
              <p className="mt-2 text-sm leading-6 text-gray-500">
                Select the exact incorrect fields or documents. Candidate will see this list after OTP verification.
              </p>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-6 space-y-5">
              <div>
                <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                  Add Incorrect Field / Document
                </label>
                <div className="flex gap-2">
                  <select
                    value={selectedIssueField}
                    onChange={(e) => setSelectedIssueField(e.target.value)}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                  >
                    <option value="">Select field or document</option>
                    {correctionFieldOptions.map((option) => (
                      <option key={option.fieldKey} value={option.fieldKey}>
                        {option.section} - {option.fieldLabel}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    onClick={addClarificationIssue}
                    className="h-11 bg-orange-600 px-4 text-white hover:bg-orange-700"
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add
                  </Button>
                </div>
              </div>

              {clarificationIssues.length === 0 ? (
                <div className="rounded-xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center">
                  <AlertCircle className="mx-auto mb-2 h-6 w-6 text-orange-500" />
                  <p className="text-sm font-bold leading-5 text-gray-900">No issue selected yet</p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Add every field/document that the candidate must correct.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clarificationIssues.map((issue, index) => (
                    <div key={issue.fieldKey} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-orange-600">
                            {issue.section}
                          </p>
                          <p className="mt-1 text-sm font-bold leading-5 text-gray-900">{issue.fieldLabel}</p>
                          {issue.currentValue && (
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              Current value: <span className="font-medium text-gray-700">{issue.currentValue}</span>
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeClarificationIssue(index)}
                          className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                          title="Remove issue"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[240px_minmax(0,1fr)]">
                        <select
                          value={issue.issueType}
                          onChange={(e) => updateClarificationIssue(index, "issueType", e.target.value)}
                          className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        >
                          {ISSUE_TYPES.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                        <input
                          value={issue.remark}
                          onChange={(e) => updateClarificationIssue(index, "remark", e.target.value)}
                          placeholder="Reviewer remark shown to candidate"
                          className="h-11 rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                  Overall Instruction
                </label>
              <textarea
                rows="3"
                placeholder="Short instruction for the candidate, e.g. Please correct the listed fields and upload clear supporting documents."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                value={clarificationNote}
                onChange={(e) => setClarificationNote(e.target.value)}
              />
              </div>
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowClarificationModal(false);
                  setClarificationNote("");
                  setClarificationIssues([]);
                  setSelectedIssueField("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (clarificationIssues.length === 0) {
                    toast.error("Add at least one correction issue");
                    return;
                  }
                  if (clarificationIssues.some((issue) => !issue.remark.trim())) {
                    toast.error("Add remark for every selected issue");
                    return;
                  }
                  if (!clarificationNote.trim()) {
                    toast.error("Add overall instruction");
                    return;
                  }
                  updateStatus({
                    status: "clarification_required",
                    notes: clarificationNote,
                    correctionIssues: clarificationIssues,
                  });
                }}
                disabled={isPending}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Send Request"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
};

export default ApplicationDetails;






