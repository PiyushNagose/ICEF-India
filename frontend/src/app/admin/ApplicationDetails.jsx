import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Info,
  ChevronRight,
  ListChecks,
  ExternalLink,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import Button from "../../components/ui/Button";
import DocumentPreviewFrame from "../../components/common/DocumentPreviewFrame";
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
  { id: "custom", label: "Form Responses", icon: FileText },
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




const getAdminDocumentPreviewUrl = (applicationId, documentId) =>
  applicationId && documentId
    ? `/api/admin/applications/${applicationId}/documents/${documentId}/preview`
    : "";

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
  const [activeTab, setActiveTab] = useState("personal");
  const [previewDoc, setPreviewDoc] = useState(null);


  const { data, isLoading } = useQuery({
    queryKey: ["admin-application", id],
    queryFn: () => adminService.getApplication(id),
  });

  const application = data?.application || data;

  const { mutate: reviewCorrection, isPending: isReviewingCorrection } =
    useMutation({
      mutationFn: ({ action, notes }) =>
        adminService.reviewApplicationCorrection(id, { action, notes }),
      onSuccess: (_, variables) => {
        toast.success(
          variables.action === "approve"
            ? "Correction approved"
            : "Correction sent back to candidate",
        );
        queryClient.invalidateQueries({ queryKey: ["admin-application", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-applications"] });
        queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      },
      onError: (err) =>
        toast.error(err.message || "Unable to review correction"),
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
  const configuredFieldIds = new Set();
  (application.jobId?.formSections || []).forEach((section) => {
    (section.fields || []).forEach((field) => {
      const keys = [field._id, field.id, field.name].filter(Boolean);
      keys.forEach((key) => {
        fieldLabelMap[String(key)] = field.label;
        configuredFieldIds.add(String(key));
      });
    });
  });
  const formResponseEntries = Object.entries(formResponses).filter(
    ([fieldId, value]) =>
      configuredFieldIds.has(String(fieldId)) &&
      value !== undefined &&
      value !== null &&
      value !== "" &&
      !(Array.isArray(value) && value.length === 0),
  );
  const visibleTabs = TABS.filter(
    (tab) => tab.id !== "custom" || formResponseEntries.length > 0,
  );
  const selectedTab = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : "personal";

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
  const pendingCorrection = [...(application.corrections || [])]
    .reverse()
    .find((item) => item.status === "pending");
  const correctionNote =
    pendingCorrection?.reason || application.correction?.note || "";

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
              className={`inline-flex items-center gap-1.5 whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${sCfg.cls}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${sCfg.dot}`} />
              {sCfg.label}
            </span>
            <span
              className={`inline-flex items-center whitespace-nowrap px-3 py-1 rounded-full text-xs font-semibold ${payCfg}`}
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


        {pendingCorrection && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
                  Correction Review
                </p>
                <h2 className="mt-1 text-lg font-bold leading-6 text-gray-900">
                  Candidate submitted field changes
                </h2>
                {correctionNote && (
                  <p className="mt-1 text-sm leading-6 text-gray-600">
                    {correctionNote}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={isReviewingCorrection}
                  onClick={() =>
                    reviewCorrection({
                      action: "reject",
                      notes:
                        "Correction requires more information. Please update and submit again.",
                    })
                  }
                  className="border-orange-200 text-orange-700 hover:bg-orange-100"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Ask Again
                </Button>
                <Button
                  disabled={isReviewingCorrection}
                  onClick={() =>
                    reviewCorrection({
                      action: "approve",
                      notes: "Correction accepted and applied.",
                    })
                  }
                  className="bg-orange-600 text-white hover:bg-orange-700"
                >
                  {isReviewingCorrection ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve & Apply
                </Button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {(pendingCorrection.requestedFields || []).map((field, index) => (
                <div
                  key={`${field.field}-${index}`}
                  className="rounded-xl border border-orange-100 bg-white p-4"
                >
                  <p className="text-sm font-bold leading-5 text-gray-900">
                    {field.fieldLabel || field.field}
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                        Current
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold leading-5 text-gray-700">
                        {field.oldValue || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-gray-500">
                        Requested
                      </p>
                      <p className="mt-1 break-words text-sm font-semibold leading-5 text-orange-700">
                        {field.newValue || "-"}
                      </p>
                    </div>
                  </div>
                  {field.reason && (
                    <p className="mt-3 text-xs leading-5 text-gray-500">
                      {field.reason}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}



        {/* Tabs + Content */}
        <div className="grid grid-cols-1 items-stretch lg:grid-cols-4 gap-5">
          {/* Sidebar */}
          <div className="lg:col-span-1 flex">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-2 sticky top-24 w-full min-h-[420px] lg:h-full lg:flex lg:flex-col">
              {visibleTabs.map(({ id: tid, label, icon: Icon }) => (
                <button
                  key={tid}
                  onClick={() => setActiveTab(tid)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all mb-0.5 last:mb-0 ${
                    selectedTab === tid
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
            {selectedTab === "custom" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Application Form Responses
                  </h3>
                </div>
                {formResponseEntries.length === 0 ? (
                  <p className="py-10 text-center text-sm leading-6 text-gray-400">
                    No form responses submitted yet.
                  </p>
                ) : (
                  <Grid>
                    {formResponseEntries.map(([fieldId, value]) => (
                      <Row
                        key={fieldId}
                        label={fieldLabelMap[fieldId]}
                        value={formatAdminValue(value)}
                      />
                    ))}
                  </Grid>
                )}
              </div>
            )}

            {/* Personal */}
            {selectedTab === "personal" && (
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
            {selectedTab === "education" && (
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
            {selectedTab === "additional" && (
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
            {selectedTab === "address" && (
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
            {selectedTab === "documents" && (
              <div>
                <div className="flex items-center gap-2 mb-5 pb-3 border-b border-gray-100">
                  <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                    <Upload className="w-4 h-4 text-orange-600" />
                  </div>
                  <h3 className="text-base font-bold leading-6 text-gray-900">
                    Uploaded Documents
                  </h3>
                  <span className="ml-auto inline-flex items-center whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
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
                      const previewUrl = getAdminDocumentPreviewUrl(
                        application._id,
                        doc._id,
                      );
                      return (
                        <div
                          key={doc._id}
                          className="grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-orange-200 hover:bg-orange-50/30 md:grid-cols-[1fr_auto] md:items-center"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-orange-100">
                              <FileText className="w-5 h-5 text-orange-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold leading-5 text-gray-900 capitalize">
                                {doc.name || doc.type?.replace(/_/g, " ")}
                              </p>
                              {doc.originalName && (
                                <p className="mt-0.5 truncate text-xs leading-5 text-gray-500">
                                  {doc.originalName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${statusCls}`}
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
                            <div className="flex items-center gap-2 md:justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-orange-200 text-orange-600 hover:bg-orange-50"
                                onClick={() =>
                                  setPreviewDoc({
                                    url: previewUrl,
                                    title:
                                      doc.name ||
                                      doc.type?.replace(/_/g, " ") ||
                                      "Document Preview",
                                    name: doc.originalName,
                                  })
                                }
                              >
                                <Eye className="w-4 h-4 mr-1" /> View
                              </Button>
                              <a
                                href={previewUrl}
                                download
                                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                                aria-label={`Download ${doc.originalName || doc.name || "document"}`}
                              >
                                <Download className="w-4 h-4" />
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
            {selectedTab === "posts" && (
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
            {selectedTab === "payment" && (
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

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-600">
                  Uploaded Document
                </p>
                <h3 className="truncate text-base font-semibold text-slate-900">
                  {previewDoc.title || "Document Preview"}
                </h3>
                {previewDoc.name && (
                  <p className="truncate text-sm text-slate-500">
                    {previewDoc.name}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(
                      previewDoc.url,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="gap-1.5 border-orange-200 px-4 text-orange-600 hover:bg-orange-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-500 hover:bg-slate-100"
                  aria-label="Close document preview"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="h-[calc(94vh-76px)] bg-slate-100">
              <DocumentPreviewFrame
                src={previewDoc.url}
                title={previewDoc.name || previewDoc.title || "Uploaded document"}
              />
            </div>
          </div>
        </div>
      )}


    </AdminLayout>
  );
};

export default ApplicationDetails;






