/**
 * CorrectionRequest.jsx
 * Route: /correction-request
 *
 * Public page - no login required.
 * Candidate verifies identity via OTP, then submits correction request.
 */

import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Info,
  FileText,
  Briefcase,
  Calendar,
  IndianRupee,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicService } from "../../services/public.service";
import { showOtpToast } from "../../utils/otpToast";
import CustomSelect from "../../components/ui/CustomSelect";

const CORRECTABLE_FIELDS = [
  { value: "personalDetails.fullName", label: "Full Name" },
  { value: "personalDetails.fatherName", label: "Father's Name" },
  { value: "personalDetails.motherName", label: "Mother's Name" },
  { value: "personalDetails.dateOfBirth", label: "Date of Birth" },
  { value: "personalDetails.gender", label: "Gender" },
  { value: "personalDetails.category", label: "Category" },
  { value: "personalDetails.maritalStatus", label: "Marital Status" },
  { value: "address.permanent", label: "Permanent Address" },
  { value: "education.tenth.percentage", label: "10th Percentage" },
  { value: "education.twelfth.percentage", label: "12th Percentage" },
  { value: "documents.photo", label: "Profile Photo" },
  { value: "documents.signature", label: "Signature" },
  { value: "documents.casteCertificate", label: "Caste Certificate" },
  { value: "documents.domicile", label: "Domicile Certificate" },
];

const Input = ({ className = "", ...props }) => (
  <input
    className={`h-12 w-full rounded-[6px] border border-[#e0d7cd] bg-white px-4 text-sm text-[#1f1d1b] outline-none transition placeholder:text-[#b0a89e] focus:border-orange-400 focus:ring-2 focus:ring-orange-200 disabled:bg-[#faf7f2] ${className}`}
    {...props}
  />
);

const labelClass =
  "mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[#4a4440]";

const panelClass =
  "rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm sm:p-7";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

const getRequestStatusLabel = (status) => {
  if (status === "approved") return "Accepted by Admin";
  if (status === "rejected") return "Rejected";
  if (status === "more_info_needed") return "More Info Needed";
  return "Pending Review";
};

const getCorrectionWindowState = (source) => {
  const startDate = source?.correctionStartDate || source?.startDate;
  const endDate =
    source?.correctionDeadline || source?.correctionEndDate || source?.endDate;
  if (!startDate || !endDate) {
    return {
      status: "not_configured",
      label: "Not released",
      message: "Correction window has not been released for this recruitment.",
    };
  }
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  if (now < start) {
    return {
      status: "upcoming",
      label: "Opens soon",
      message: `Correction window opens on ${fmt(start)}.`,
      startDate,
      endDate,
    };
  }
  if (now > end) {
    return {
      status: "closed",
      label: "Closed",
      message: `Correction window closed on ${fmt(end)}.`,
      startDate,
      endDate,
    };
  }
  return {
    status: "open",
    label: "Open",
    message: `Correction window is open until ${fmt(end)}.`,
    startDate,
    endDate,
  };
};

export default function CorrectionRequest() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialLookup = location.state?.lookup || {};

  const [regNumber, setRegNumber] = useState(
    initialLookup.registrationNumber || "",
  );
  const [mobile, setMobile] = useState(initialLookup.mobile || "");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null);

  const [overallReason, setOverallReason] = useState("");
  const [corrections, setCorrections] = useState([
    { field: "", oldValue: "", newValue: "", reason: "" },
  ]);

  const addCorrection = () =>
    setCorrections((c) => [
      ...c,
      { field: "", oldValue: "", newValue: "", reason: "" },
    ]);

  const removeCorrection = (i) =>
    setCorrections((c) => c.filter((_, idx) => idx !== i));

  const updateCorrection = (i, key, val) =>
    setCorrections((c) =>
      c.map((item, idx) => (idx === i ? { ...item, [key]: val } : item)),
    );

  const handleSendOTP = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSendLoading(true);
    try {
      const response = await publicService.sendOTP(mobile, "mobile");
      setOtpSent(true);
      showOtpToast(response, "OTP sent to your mobile");
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!regNumber.trim()) {
      toast.error("Enter your registration number first");
      return;
    }
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setVerifyLoading(true);
    try {
      await publicService.verifyOTP(mobile, "mobile", otp);
      setOtpVerified(true);
      setApplicationLoading(true);
      const application = await publicService.checkStatus({
        registrationNumber: regNumber.trim().toUpperCase(),
        mobile,
      });
      setSelectedApplication(application);
      const windowState = getCorrectionWindowState(
        application?.correctionWindow || application?.job,
      );
      const isWindowOpen =
        application?.correctionWindow?.isOpen || windowState.status === "open";
      if (!isWindowOpen) {
        toast.error(windowState.message);
        return;
      }
      if (application?.hasExistingCorrection || application?.activeCorrectionRequest) {
        toast("A correction request already exists for this application. Check status for updates.");
        return;
      }
      setCorrections([{ field: "", oldValue: "", newValue: "", reason: "" }]);
      setOverallReason("");
      toast.success("Application verified. You can submit corrections.");
    } catch (err) {
      setOtpVerified(false);
      setSelectedApplication(null);
      if (!err.toastShown) {
        toast.error(
          err.message ||
            "Unable to verify this registration number and mobile",
        );
      }
    } finally {
      setVerifyLoading(false);
      setApplicationLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!regNumber.trim()) {
      toast.error("Enter your registration number");
      return;
    }
    if (!otpVerified) {
      toast.error("Please verify your mobile first");
      return;
    }
    if (!selectedApplication?.registrationNumber) {
      toast.error("Confirm the linked application before submitting");
      return;
    }
    if (selectedApplication?.hasExistingCorrection) {
      toast.error(
        "A correction request already exists for this application. Check status for updates.",
      );
      return;
    }
    const hasInvalidCorrection = corrections.some(
      (c) => !c.field || !c.newValue,
    );
    if (hasInvalidCorrection) {
      toast.error("Fill in all correction fields");
      return;
    }

    setSubmitLoading(true);
    try {
      const data = await publicService.requestCorrection({
        registrationNumber: regNumber.trim().toUpperCase(),
        mobile,
        corrections: corrections.map((c) => ({
          field: c.field,
          fieldLabel:
            CORRECTABLE_FIELDS.find((item) => item.value === c.field)?.label ||
            c.field,
          oldValue: c.oldValue,
          newValue: c.newValue,
          reason: c.reason?.trim(),
        })),
        overallReason: overallReason.trim(),
      });
      setSubmitted(data);
      toast.success("Correction request submitted!");
    } catch (err) {
      if (/already exists/i.test(err.message || "")) {
        setSelectedApplication((current) =>
          current
            ? {
                ...current,
                hasExistingCorrection: true,
                activeCorrectionRequest: {
                  ...(current.activeCorrectionRequest || {}),
                  status: "pending",
                },
              }
            : current,
        );
      }
      if (!err.toastShown) toast.error(err.message || "Submission failed");
    } finally {
      setSubmitLoading(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-[#f5efe9] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md rounded-[8px] border border-[#e0d7cd] bg-white p-8 text-center shadow-sm"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
              Correction Request Submitted
            </h2>
            <p className="mt-2 text-sm text-[#6d6761]">
              Your request has been forwarded to the verification team.
            </p>
            <div className="mt-6 bg-[#faf7f2] rounded-xl p-4 text-left space-y-2">
              {[
                { label: "Request ID", val: submitted.requestId },
                { label: "Ticket ID", val: submitted.ticketId },
                { label: "Registration", val: submitted.registrationNumber },
                { label: "Application", val: submitted.applicationId },
                { label: "Recruitment", val: submitted.jobTitle },
                { label: "Status", val: "Pending Review" },
                {
                  label: "Est. Resolution",
                  val: submitted.estimatedResolutionTime,
                },
              ].map(({ label, val }) => (
                <div
                  key={label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-[#6d6761]">{label}</span>
                  <span className="font-semibold text-[#1f1d1b]">{val}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <button
                onClick={() => navigate("/check-status")}
                className="h-11 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-lg font-black uppercase tracking-widest text-xs transition"
              >
                Check Application Status
              </button>
              <button
                onClick={() => navigate("/")}
                className="h-11 border border-[#e0d7cd] hover:bg-[#faf7f2] text-[#1f1d1b] rounded-lg font-black uppercase tracking-widest text-xs transition"
              >
                Back to Recruitment
              </button>
            </div>
          </motion.div>
        </div>
      </PublicLayout>
    );
  }

  const activeCorrectionRequest = selectedApplication?.activeCorrectionRequest;
  const hasExistingPublicCorrection = Boolean(
    selectedApplication?.hasExistingCorrection || activeCorrectionRequest,
  );
  const correctionWindowState = getCorrectionWindowState(
    selectedApplication?.correctionWindow || selectedApplication?.job,
  );
  const canEnterCorrection =
    otpVerified &&
    selectedApplication &&
    correctionWindowState.status === "open";

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9]">
        {/* Hero */}
        <div className="bg-[#201d1a] text-white">
          <div className="mx-auto flex min-h-[228px] max-w-[1380px] flex-col justify-center px-4 py-9 sm:px-6 lg:px-8 lg:py-10">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
              Public Service
            </p>
            <h1 className="text-[32px] sm:text-[40px] lg:text-[48px] font-black leading-[1.12] text-white">
              Request Application Correction
            </h1>
            <p className="mt-4 max-w-3xl text-[14px] leading-[26px] font-medium text-white/80">
              Submit field corrections during the official correction window.
              One request is allowed per submitted application.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-start">
            <div className="flex flex-col gap-5">
          {/* Identity */}
          <div
            className={`${panelClass} flex flex-col gap-5 ${
              otpVerified ? "" : "min-h-[360px] justify-between"
            }`}
          >
            <div className="space-y-5">
            <div className="border-b border-[#f0e8e0] pb-5">
              <h2 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
                Verify Your Identity
              </h2>
              <p className="mt-1 max-w-3xl text-[14px] leading-[26px] text-[#5f5752] font-medium">
                Enter your registration number and verify the registered mobile
                before requesting corrections.
              </p>
            </div>

            {/* Reg number */}
            <div>
              <label className={labelClass}>
                Registration Number *
              </label>
              <Input
                type="text"
                placeholder="e.g. BPOL2600001234"
                value={regNumber}
                onChange={(e) => {
                  setRegNumber(e.target.value.toUpperCase());
                  setOtpSent(false);
                  setOtpVerified(false);
                  setOtp("");
                  setSelectedApplication(null);
                }}
                className="font-mono"
              />
              <p className="mt-2 text-xs font-medium leading-5 text-[#7a7168]">
                Each submitted application has its own registration number. If
                you applied for multiple jobs, enter the registration number of
                the exact application you want corrected.
              </p>
            </div>

            {/* Mobile OTP */}
            <div>
              <label className={`${labelClass} flex items-center gap-1.5`}>
                <Phone className="w-3.5 h-3.5 text-[#e46a1d]" />
                Registered Mobile
                {otpVerified && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3" /> Verified
                  </span>
                )}
              </label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value.replace(/\D/g, ""));
                    setOtpSent(false);
                    setOtpVerified(false);
                    setOtp("");
                    setSelectedApplication(null);
                  }}
                  disabled={otpVerified}
                />
                {!otpVerified && (
                  <button
                    disabled={sendLoading || mobile.length !== 10}
                    onClick={handleSendOTP}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-[#e46a1d] px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {sendLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                )}
              </div>
              {otpSent && !otpVerified && (
                <div className="mt-3 flex gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    className="font-mono"
                  />
                  <button
                    disabled={verifyLoading || otp.length !== 6}
                    onClick={handleVerifyOTP}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-[#e46a1d] px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {verifyLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Verify"
                    )}
                  </button>
                </div>
              )}
            </div>
            </div>
          </div>

          {applicationLoading && (
            <div className={`${panelClass} flex items-center gap-3`}>
              <Loader2 className="h-5 w-5 animate-spin text-[#e46a1d]" />
              <div>
                <p className="text-sm font-black text-[#1f1d1b]">
                  Verifying application
                </p>
                <p className="text-xs font-medium text-[#7a7168]">
                  Matching registration number with registered mobile.
                </p>
              </div>
            </div>
          )}

          {selectedApplication && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[8px] border border-emerald-200 bg-white shadow-sm"
            >
              <div className="border-b border-emerald-100 bg-emerald-50 px-6 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                  Application Confirmed
                </p>
                <h3 className="mt-1 text-lg font-black text-[#1f1d1b]">
                  {hasExistingPublicCorrection
                    ? "Correction request already exists for this application"
                    : correctionWindowState.status === "open"
                    ? "Correction will be raised for this application only"
                    : "Correction request is controlled by the official window"}
                </h3>
              </div>
              <div className="grid gap-3 p-6 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                  <FileText className="mb-3 h-5 w-5 text-[#e46a1d]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                    Registration
                  </p>
                  <p className="mt-1 break-all font-mono text-sm font-black text-[#1f1d1b]">
                    {selectedApplication.registrationNumber}
                  </p>
                  <p className="mt-1 font-mono text-xs font-semibold text-[#7a7168]">
                    {selectedApplication.applicationId}
                  </p>
                </div>
                <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                  <Briefcase className="mb-3 h-5 w-5 text-[#e46a1d]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                    Recruitment
                  </p>
                  <p className="mt-1 text-sm font-black text-[#1f1d1b] break-words line-clamp-2" title={selectedApplication.jobDetails?.title}>
                    {selectedApplication.jobDetails?.title || "Not available"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7a7168] break-words line-clamp-2" title={selectedApplication.jobDetails?.department}>
                    {selectedApplication.jobDetails?.department || "-"}
                  </p>
                </div>
                <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                  <IndianRupee className="mb-3 h-5 w-5 text-[#e46a1d]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                    Payment
                  </p>
                  <p className="mt-1 text-sm font-black capitalize text-[#1f1d1b]">
                    {selectedApplication.paymentStatus || "-"}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7a7168]">
                    Fee: INR {selectedApplication.totalFee || 0}
                  </p>
                </div>
                <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                  <Calendar className="mb-3 h-5 w-5 text-[#e46a1d]" />
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                    Correction Window
                  </p>
                  <p className="mt-1 text-sm font-black text-[#1f1d1b]">
                    {correctionWindowState.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7a7168]">
                    {fmt(correctionWindowState.startDate)} to{" "}
                    {fmt(correctionWindowState.endDate)}
                  </p>
                </div>
              </div>
              {selectedApplication.appliedPosts?.length > 0 && (
                <div className="border-t border-[#f0e8e0] px-6 py-4">
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                    Applied Post(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedApplication.appliedPosts.map((post, index) => (
                      <span
                        key={`${post.postCode || post.title}-${index}`}
                        className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-black text-[#c8510d] max-w-full break-words inline-block"
                      >
                        <span className="line-clamp-2" title={post.title}>
                          {post.title} {post.postCode ? `- ${post.postCode}` : ""}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {otpVerified &&
            selectedApplication &&
            correctionWindowState.status !== "open" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[8px] border border-amber-200 bg-amber-50 p-5 shadow-sm"
              >
                <div className="flex gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div>
                    <p className="text-sm font-black text-amber-800">
                      Correction request is not available
                    </p>
                    <p className="mt-1 text-sm font-medium leading-6 text-amber-800/85">
                      {correctionWindowState.message} You can still check the
                      application status for official updates.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/check-status", {
                          state: {
                            lookup: {
                              registrationNumber:
                                selectedApplication.registrationNumber,
                              mobile,
                            },
                          },
                        })
                      }
                      className="mt-4 inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] px-4 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#cb5d16]"
                    >
                      Check Status <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

          {canEnterCorrection && hasExistingPublicCorrection && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-[8px] border border-orange-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-3 border-b border-orange-100 bg-orange-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e46a1d]">
                    Correction Already Submitted
                  </p>
                  <h3 className="mt-1 text-lg font-black text-[#1f1d1b]">
                    This application already has a correction request
                  </h3>
                </div>
                <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-[#c8510d]">
                  {getRequestStatusLabel(activeCorrectionRequest?.status)}
                </span>
              </div>
              <div className="grid gap-4 p-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-3">
                  <p className="text-sm font-medium leading-6 text-[#5c5149]">
                    A second correction request is not allowed for the same
                    application. Track the existing request from public
                    application status.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                        Request ID
                      </p>
                      <p className="mt-1 break-all font-mono text-xs font-black text-[#1f1d1b]">
                        {activeCorrectionRequest?.requestId || "Already raised"}
                      </p>
                    </div>
                    <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                        Requested On
                      </p>
                      <p className="mt-1 text-sm font-black text-[#1f1d1b]">
                        {fmt(activeCorrectionRequest?.requestedAt)}
                      </p>
                    </div>
                    <div className="rounded-[6px] border border-[#eadfd2] bg-[#fbf7f1] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
                        Application
                      </p>
                      <p className="mt-1 break-all font-mono text-xs font-black text-[#1f1d1b]">
                        {selectedApplication.applicationId}
                      </p>
                    </div>
                  </div>
                  {activeCorrectionRequest?.reason && (
                    <div className="rounded-[6px] border border-orange-100 bg-orange-50/60 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#c8510d]">
                        Submitted Note
                      </p>
                      <p className="mt-1 text-sm font-medium leading-6 text-[#5c5149]">
                        {activeCorrectionRequest.reason}
                      </p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() =>
                    navigate("/check-status", {
                      state: {
                        lookup: {
                          registrationNumber:
                            selectedApplication.registrationNumber,
                          mobile,
                        },
                      },
                    })
                  }
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] px-5 text-xs font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(228,106,29,0.18)] transition hover:bg-[#cb5d16]"
                >
                  Check Status <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          )}

          {/* Corrections form */}
          {canEnterCorrection && !hasExistingPublicCorrection && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className={`${panelClass} space-y-5`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
                      Correction Details
                    </h2>
                    <p className="mt-1 text-[14px] leading-[26px] text-[#5f5752] font-medium">
                      Select every field that needs correction for this
                      application.
                    </p>
                  </div>
                  <button
                    onClick={addCorrection}
                    className="inline-flex h-10 items-center gap-1.5 rounded-[6px] border border-orange-200 px-3 text-xs font-black uppercase tracking-[0.12em] text-[#e46a1d] transition hover:bg-orange-50 hover:text-[#cb5d16]"
                  >
                    <Plus className="w-4 h-4" /> Add Field
                  </button>
                </div>

                {corrections.map((c, i) => (
                  <div
                    key={i}
                    className="space-y-3 rounded-[8px] border border-[#f0e9e1] bg-[#fffdfb] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-black text-[#1f1d1b]">
                          Correction #{i + 1}
                        </p>
                      </div>
                      {corrections.length > 1 && (
                        <button
                          onClick={() => removeCorrection(i)}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                        Field to Correct *
                      </label>
                      <CustomSelect
                        value={c.field}
                        onChange={(value) => updateCorrection(i, "field", value)}
                        options={[
                          { value: "", label: "Select field" },
                          ...CORRECTABLE_FIELDS,
                        ]}
                        placeholder="Select field"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                          Current (Incorrect) Value
                        </label>
                        <Input
                          placeholder="Current incorrect value"
                          value={c.oldValue}
                          onChange={(e) =>
                            updateCorrection(i, "oldValue", e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                          Correct Value *
                        </label>
                        <Input
                          placeholder="What it should be"
                          value={c.newValue}
                          onChange={(e) =>
                            updateCorrection(i, "newValue", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                        Reason for this Correction
                      </label>
                      <Input
                        placeholder="e.g. Typo in name, wrong date entered"
                        value={c.reason}
                        onChange={(e) =>
                          updateCorrection(i, "reason", e.target.value)
                        }
                      />
                    </div>

                  </div>
                ))}

                {/* Overall reason */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                    Overall Reason / Supporting Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe why corrections are needed (attach supporting documents if applicable)"
                    value={overallReason}
                    onChange={(e) => setOverallReason(e.target.value)}
                        className="w-full resize-none rounded-[6px] border border-[#e0d7cd] bg-white px-4 py-3 text-sm text-[#1f1d1b] outline-none transition placeholder:text-[#b0a89e] focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* Disclaimer */}
                <div className="bg-[#faf7f2] border border-[#f0e9e1] rounded-lg p-4 flex gap-3">
                  <AlertCircle className="w-4 h-4 text-[#e46a1d] shrink-0 mt-0.5" />
                  <p className="text-xs text-[#6d6761]">
                    By submitting this request, I confirm that all information
                    provided is accurate and I have supporting documents to
                    justify these corrections. Misuse of this facility may lead
                    to disqualification.
                  </p>
                </div>

                <button
                  disabled={submitLoading}
                  onClick={handleSubmit}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(228,106,29,0.22)] transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Submit Correction Request{" "}
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
            </div>

            <aside className="self-start lg:sticky lg:top-24">
              <motion.div
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className="rounded-[8px] border border-[#e0d7cd] bg-white shadow-sm"
            >
                <div className="border-b border-[#f0e8e0] p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-amber-50 text-amber-700">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">
                        Correction Window
                      </p>
                      <p className="mt-2 text-sm font-black text-[#1f1d1b]">
                        {correctionWindowState.label}
                      </p>
                      <p className="mt-1 text-sm font-medium leading-6 text-[#6d6761]">
                        {correctionWindowState.message} Only one correction
                        request is allowed per application.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`${selectedApplication ? "border-b border-[#f0e8e0]" : ""} p-5`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">
                    Before Submitting
                  </p>
                  <div className="mt-4 grid gap-3 text-sm font-medium leading-6 text-[#4a4540]">
                    {[
                      "Keep the registration number from your submitted application.",
                      "Use the same mobile number used during application.",
                      "Request only fields that require correction.",
                      "Keep supporting documents ready for admin review.",
                    ].map((item) => (
                      <div key={item} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedApplication && (
                  <div className="grid gap-4 p-5">
                    <div className="rounded-[8px] border border-emerald-100 bg-emerald-50 p-4">
                      <div className="flex items-start gap-3">
                        <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                        <div>
                          <p className="text-sm font-black text-[#1f1d1b]">
                            Need Help?
                          </p>
                          <p className="mt-1 text-sm font-medium text-[#5f5752]">
                            Call 1800-123-4567 during office hours.
                          </p>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        navigate("/check-status", {
                          state: {
                            lookup: {
                              registrationNumber:
                                selectedApplication.registrationNumber,
                              mobile,
                            },
                          },
                        })
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-[6px] border border-orange-200 bg-white px-4 text-xs font-black uppercase tracking-[0.14em] text-[#e46a1d] transition hover:bg-orange-50"
                    >
                      Check Application Status
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </motion.div>
            </aside>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
