/**
 * CorrectionRequest.jsx
 * Route: /correction-request
 *
 * Public page — no login required.
 * Candidate verifies identity via OTP → submits correction request.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  RefreshCw,
  Phone,
  CheckCircle2,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronRight,
  Info,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicService } from "../../services/public.service";

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

const Input = ({ ...props }) => (
  <input
    className="w-full h-11 px-3 rounded-lg border border-[#e0d7cd] bg-white text-sm text-[#1f1d1b] placeholder-[#b0a89e] outline-none focus:ring-2 focus:ring-orange-400 transition"
    {...props}
  />
);

export default function CorrectionRequest() {
  const navigate = useNavigate();

  const [regNumber, setRegNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
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
      await publicService.sendOTP(mobile, "mobile");
      setOtpSent(true);
      toast.success("OTP sent to your mobile");
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setVerifyLoading(true);
    try {
      await publicService.verifyOTP(mobile, "mobile", otp);
      setOtpVerified(true);
      toast.success("Mobile verified!");
    } catch (err) {
      if (!err.toastShown) toast.error("Invalid or expired OTP");
    } finally {
      setVerifyLoading(false);
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
    if (corrections.some((c) => !c.field || !c.newValue || !c.reason)) {
      toast.error("Fill in all correction fields");
      return;
    }
    if (!overallReason.trim()) {
      toast.error("Please provide an overall reason for correction");
      return;
    }

    setSubmitLoading(true);
    try {
      const data = await publicService.requestCorrection({
        registrationNumber: regNumber.trim().toUpperCase(),
        mobile,
        corrections,
        overallReason,
      });
      setSubmitted(data);
      toast.success("Correction request submitted!");
    } catch (err) {
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
            className="bg-white border border-[#e0d7cd] rounded-2xl p-8 max-w-md w-full text-center shadow-sm"
          >
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-black text-[#1f1d1b]">
              Correction Request Submitted
            </h2>
            <p className="mt-2 text-sm text-[#6d6761]">
              Your request has been forwarded to the verification team.
            </p>

            <div className="mt-6 bg-[#faf7f2] rounded-xl p-4 text-left space-y-2">
              {[
                { label: "Request ID", val: submitted.requestId },
                { label: "Ticket ID", val: submitted.ticketId },
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
                Back to Home
              </button>
            </div>
          </motion.div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9]">
        {/* Hero */}
        <div className="bg-[#201d1a] text-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
            <p className="text-[10px] uppercase tracking-widest font-black text-orange-400 mb-2">
              Public Service
            </p>
            <h1 className="text-2xl font-black">
              Request Application Correction
            </h1>
            <p className="mt-2 text-sm text-white/60">
              Submit a correction during the correction window. Ensure you have
              supporting documents ready.
            </p>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-5">
          {/* Notice */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <p className="font-black">Correction Window</p>
              <p className="mt-0.5">
                Corrections can only be submitted during the official correction
                window. Check your recruitment notification for exact dates.
                Only 1 correction request is allowed per application.
              </p>
            </div>
          </div>

          {/* Identity */}
          <div className="bg-white border border-[#e0d7cd] rounded-xl p-6 space-y-4">
            <h2 className="font-black text-[#1f1d1b]">Verify Your Identity</h2>

            {/* Reg number */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5">
                Registration Number *
              </label>
              <Input
                type="text"
                placeholder="e.g. BPOL2600001234"
                value={regNumber}
                onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            {/* Mobile OTP */}
            <div>
              <label className="block text-xs font-black uppercase tracking-widest text-[#4a4440] mb-1.5 flex items-center gap-1.5">
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
                  }}
                  disabled={otpVerified}
                />
                {!otpVerified && (
                  <button
                    disabled={sendLoading || mobile.length !== 10}
                    onClick={handleSendOTP}
                    className="h-11 px-4 bg-[#e46a1d] hover:bg-[#cb5d16] disabled:opacity-50 text-white rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-1.5 transition"
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
                    className="h-11 px-4 bg-[#e46a1d] hover:bg-[#cb5d16] disabled:opacity-50 text-white rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-1.5 transition"
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

          {/* Corrections form */}
          {otpVerified && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="bg-white border border-[#e0d7cd] rounded-xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-[#1f1d1b]">
                    Correction Details
                  </h2>
                  <button
                    onClick={addCorrection}
                    className="inline-flex items-center gap-1.5 text-xs font-black text-[#e46a1d] hover:text-[#cb5d16]"
                  >
                    <Plus className="w-4 h-4" /> Add Field
                  </button>
                </div>

                {corrections.map((c, i) => (
                  <div
                    key={i}
                    className="border border-[#f0e9e1] rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-black text-[#1f1d1b]">
                        Correction #{i + 1}
                      </p>
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
                      <select
                        value={c.field}
                        onChange={(e) =>
                          updateCorrection(i, "field", e.target.value)
                        }
                        className="w-full h-11 px-3 rounded-lg border border-[#e0d7cd] bg-white text-sm text-[#1f1d1b] outline-none focus:ring-2 focus:ring-orange-400 transition"
                      >
                        <option value="">Select field</option>
                        {CORRECTABLE_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>
                            {f.label}
                          </option>
                        ))}
                      </select>
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
                        Reason for this Correction *
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
                    Overall Reason / Supporting Notes *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe why corrections are needed (attach supporting documents if applicable)"
                    value={overallReason}
                    onChange={(e) => setOverallReason(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-[#e0d7cd] bg-white text-sm text-[#1f1d1b] placeholder-[#b0a89e] outline-none focus:ring-2 focus:ring-orange-400 transition resize-none"
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
                  className="w-full h-12 bg-[#e46a1d] hover:bg-[#cb5d16] disabled:opacity-50 text-white rounded-lg font-black uppercase tracking-widest text-sm flex items-center justify-center gap-2 transition"
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
      </div>
    </PublicLayout>
  );
}
