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
    label: "Submitted",
    cls: "bg-blue-100 text-blue-800",
    dot: "bg-blue-500",
  },
  under_review: {
    label: "Under Review",
    cls: "bg-amber-100 text-amber-800",
    dot: "bg-amber-500",
  },
  verified: {
    label: "Verified",
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
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900">
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

const EduCard = ({ title, data }) => {
  if (!data || Object.keys(data).length === 0) return null;
  return (
    <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/60">
      <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
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
              <p className="text-xs text-gray-500">{l}</p>
              <p className="text-sm font-medium text-gray-900">{v}</p>
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
      <h4 className="font-semibold text-gray-700 text-xs uppercase tracking-normal mb-3">
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
            <p className="text-xs text-gray-500">{l}</p>
            <p className="text-sm font-medium text-gray-900">{v}</p>
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
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [clarificationNote, setClarificationNote] = useState("");
  const [showClarificationModal, setShowClarificationModal] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-application", id],
    queryFn: () => adminService.getApplication(id),
  });

  const application = data?.application || data;

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: ({ status, notes }) =>
      adminService.updateApplicationStatus(id, {
        status,
        notes,
        rejectionReason: notes,
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
      setShowRejectModal(false);
      setShowClarificationModal(false);
      setReviewNote("");
      setRejectReason("");
      setClarificationNote("");
    },
    onError: (err) => toast.error(err.message || "Failed to update"),
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
  const canAct = ["submitted", "under_review", "clarification_required"].includes(
    application.status,
  );

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
                <h1 className="text-xl font-bold text-gray-900">
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
              <p className="text-xs text-gray-500 mt-0.5">
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
              <p className="text-white font-bold text-lg leading-tight">
                {candidateName || (
                  <span className="opacity-60 italic font-normal text-base">
                    Name not provided
                  </span>
                )}
              </p>
              <p className="text-orange-100 text-sm">
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
                <p className="text-xs text-gray-500 uppercase tracking-normal font-medium mb-1">
                  {label}
                </p>
                <p className="font-semibold text-gray-900 text-sm">
                  {val || "-"}
                </p>
                {sub && (
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Rejection banner */}
        {application.rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                Rejection Reason
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                {application.rejectionReason}
              </p>
            </div>
          </div>
        )}

        {/* Review Actions */}
        {canAct && (
          <div className="bg-white rounded-2xl border-l-4 border-l-orange-500 border border-orange-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-5 h-5 text-orange-600" />
              <h3 className="font-semibold text-gray-900">Review Actions</h3>
            </div>
            <div className="flex flex-wrap gap-3 items-start">
              <textarea
                rows="2"
                placeholder="Add reviewer notes (optional)..."
                className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
              />
              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={() =>
                    updateStatus({ status: "under_review", notes: reviewNote })
                  }
                  disabled={isPending || application.status === "under_review"}
                  variant="outline"
                  className="text-amber-700 border-amber-300 hover:bg-amber-50"
                >
                  <Clock className="w-4 h-4 mr-1.5" /> Under Review
                </Button>
                <Button
                  onClick={() =>
                    updateStatus({ status: "verified", notes: reviewNote })
                  }
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-1.5" />
                      Verify
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => setShowClarificationModal(true)}
                  disabled={isPending}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <AlertCircle className="w-4 h-4 mr-1.5" />
                  Clarification
                </Button>
                <Button
                  onClick={() => setShowRejectModal(true)}
                  disabled={isPending}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="w-4 h-4 mr-1.5" /> Reject
                </Button>
              </div>
            </div>
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
                  <h3 className="font-semibold text-gray-900">
                    Application Form Responses
                  </h3>
                </div>
                {Object.keys(formResponses).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                  <h3 className="font-semibold text-gray-900">
                    Personal Information
                  </h3>
                </div>
                {Object.keys(personal).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                  <h3 className="font-semibold text-gray-900">
                    Educational Qualifications
                  </h3>
                </div>
                {Object.keys(education).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                  <h3 className="font-semibold text-gray-900">
                    Additional Information
                  </h3>
                </div>
                {Object.keys(additional).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                  <h3 className="font-semibold text-gray-900">
                    Address Details
                  </h3>
                </div>
                {Object.keys(address).length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                      <p className="text-xs text-gray-500 md:col-span-2">
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
                  <h3 className="font-semibold text-gray-900">
                    Uploaded Documents
                  </h3>
                  <span className="ml-auto text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {documents.filter((d) => d.cloudinaryUrl).length} /{" "}
                    {documents.length} uploaded
                  </span>
                </div>
                {documents.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                              <p className="font-medium text-gray-900 text-sm capitalize">
                                {doc.name || doc.type?.replace(/_/g, " ")}
                              </p>
                              {doc.originalName && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {doc.originalName}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-0.5">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCls}`}
                                >
                                  {doc.status || "pending"}
                                </span>
                                {doc.sizeKB && (
                                  <span className="text-xs text-gray-400">
                                    {doc.sizeKB} KB
                                  </span>
                                )}
                              </div>
                              {doc.rejectionReason && (
                                <p className="text-xs text-red-600 mt-1">
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
                  <h3 className="font-semibold text-gray-900">Applied Posts</h3>
                </div>
                {!application.appliedPosts ||
                application.appliedPosts.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                            <p className="font-semibold text-gray-900">
                              {post.title || "Post"}
                            </p>
                            <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
                              <div>
                                <p className="text-xs text-gray-500">
                                  Designation
                                </p>
                                <p className="text-gray-900">
                                  {post.designation || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">
                                  Department
                                </p>
                                <p className="text-gray-900">
                                  {post.department || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">
                                  Vacancies
                                </p>
                                <p className="text-gray-900">
                                  {post.vacancies || "-"}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500">
                                  Preference
                                </p>
                                <p className="text-gray-800 font-medium">
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
                  <h3 className="font-semibold text-gray-900">
                    Payment Information
                  </h3>
                </div>
                {!application.totalFee && !application.transactionId ? (
                  <p className="text-gray-400 text-sm text-center py-10">
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
                      <span className="font-semibold text-sm">
                        Payment{" "}
                        {application.paymentStatus === "paid"
                          ? "Successful"
                          : application.paymentStatus || "Unknown"}
                      </span>
                      {application.totalFee > 0 && (
                        <span className="ml-auto font-bold text-gray-900">
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
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Request Clarification
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Tell the candidate exactly what must be corrected or clarified.
              </p>
            </div>
            <div className="p-6">
              <textarea
                rows="4"
                placeholder="Enter clarification note (required)..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                value={clarificationNote}
                onChange={(e) => setClarificationNote(e.target.value)}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowClarificationModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateStatus({
                    status: "clarification_required",
                    notes: clarificationNote,
                  })
                }
                disabled={isPending || !clarificationNote.trim()}
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

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900">
                Reject Application
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                Provide a reason - this will be visible to the candidate.
              </p>
            </div>
            <div className="p-6">
              <textarea
                rows="4"
                placeholder="Enter rejection reason (required)..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-sm resize-none"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="px-6 pb-6 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() =>
                  updateStatus({ status: "rejected", notes: rejectReason })
                }
                disabled={isPending || !rejectReason.trim()}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Confirm Rejection"
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






