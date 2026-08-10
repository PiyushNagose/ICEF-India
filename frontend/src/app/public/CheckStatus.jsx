/**
 * CheckStatus.jsx
 * Route: /check-status
 *
 * Public page — no login required.
 * Candidate enters Registration Number + Mobile → OTP verify → sees status.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  FileText,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  Briefcase,
  IndianRupee,
  ChevronRight,
  RefreshCw,
  Clock,
  Download,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicService } from "../../services/public.service";
import { showOtpToast } from "../../utils/otpToast";

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const statusColor = (s) => {
  const map = {
    submitted: "bg-blue-50 text-blue-700 border-blue-200",
    under_review: "bg-yellow-50 text-yellow-700 border-yellow-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    shortlisted: "bg-purple-50 text-purple-700 border-purple-200",
    draft: "bg-gray-50 text-gray-600 border-gray-200",
  };
  return map[s] || "bg-gray-50 text-gray-600 border-gray-200";
};

const paymentColor = (s) =>
  s === "paid"
    ? "bg-green-50 text-green-700 border-green-200"
    : s === "pending"
      ? "bg-yellow-50 text-yellow-700 border-yellow-200"
      : "bg-red-50 text-red-700 border-red-200";

const InfoTile = ({ label, value }) => (
  <div className="rounded border border-[#eadfd2] bg-[#fbf7f1] px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
      {label}
    </p>
    <p className="mt-1 truncate text-sm font-black text-[#1f1d1b]">{value}</p>
  </div>
);

export default function CheckStatus() {
  const navigate = useNavigate();

  const [regNumber, setRegNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [result, setResult] = useState(null);

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

  const handleCheckStatus = async () => {
    if (!regNumber.trim()) {
      toast.error("Enter your registration number");
      return;
    }
    if (!otpVerified) {
      toast.error("Please verify your mobile first");
      return;
    }
    setCheckLoading(true);
    try {
      const data = await publicService.checkStatus({
        registrationNumber: regNumber.trim().toUpperCase(),
        mobile,
      });
      setResult(data);
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Application not found");
    } finally {
      setCheckLoading(false);
    }
  };

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-90px)] bg-[#f5efe9]">
        {/* Hero */}
        <div className="bg-[#201d1a] text-white">
          <div className="mx-auto max-w-[1380px] px-4 py-9 sm:px-6 lg:px-8">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
              Public Service
            </p>
            <h1 className="text-[30px] font-black leading-tight sm:text-[36px]">
              Check Application Status
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/70">
              No login required. Enter your registration number to check your
              application status.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_420px]">
            {/* Form */}
            <div className="space-y-5">
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#f0e8e0] pb-5">
                  <div>
                    <h2 className="flex items-center gap-2 text-[18px] font-black text-[#1f1d1b]">
                      <FileText className="h-5 w-5 text-[#e46a1d]" />
                      Enter Your Details
                    </h2>
                    <p className="mt-1 text-sm font-medium text-[#6d6761]">
                      Use the registration number issued after payment.
                    </p>
                  </div>
                  {otpVerified && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-black text-green-700">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                    </span>
                  )}
                </div>

                {/* Registration Number */}
                <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.16em] text-[#4a4440]">
                    Registration Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BPOL2600001234"
                    value={regNumber}
                    onChange={(e) => setRegNumber(e.target.value.toUpperCase())}
                    className="h-12 w-full rounded-[6px] border border-[#e0d7cd] bg-white px-4 font-mono text-sm text-[#1f1d1b] outline-none transition placeholder:text-[#b0a89e] focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                {/* Mobile OTP */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#4a4440]">
                    <Phone className="w-3.5 h-3.5 text-[#e46a1d]" />
                    Registered Mobile{" "}
                    {otpVerified && (
                      <span className="ml-auto inline-flex items-center gap-1 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
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
                      className="h-12 min-w-0 flex-1 rounded-[6px] border border-[#e0d7cd] bg-white px-4 text-sm text-[#1f1d1b] outline-none transition placeholder:text-[#b0a89e] focus:border-orange-400 focus:ring-2 focus:ring-orange-200 disabled:bg-[#faf7f2]"
                    />
                    {!otpVerified && (
                      <button
                        disabled={sendLoading || mobile.length !== 10}
                        onClick={handleSendOTP}
                        className="inline-flex h-12 shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-[#e46a1d] px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {sendLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : otpSent ? (
                          <RefreshCw className="w-4 h-4" />
                        ) : (
                          "Send OTP"
                        )}
                      </button>
                    )}
                  </div>

                  {otpSent && !otpVerified && (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="6-digit OTP"
                        value={otp}
                        onChange={(e) =>
                          setOtp(e.target.value.replace(/\D/g, ""))
                        }
                        className="h-12 min-w-0 flex-1 rounded-[6px] border border-[#e0d7cd] bg-white px-4 font-mono text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
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

                <button
                  disabled={checkLoading || !otpVerified || !regNumber.trim()}
                  onClick={handleCheckStatus}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_14px_30px_rgba(228,106,29,0.22)] transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:bg-[#efb38e] disabled:shadow-none"
                >
                  {checkLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      Check Status <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
                </div>
              </div>

              {/* Result */}
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {/* Status header */}
                  <div className="overflow-hidden rounded-[8px] border border-[#e0d7cd] bg-white shadow-sm">
                    <div className="border-b border-[#eadfd2] bg-[#201d1a] px-6 py-4 text-white">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">
                        Application Status Report
                      </p>
                      <h2 className="mt-1 text-xl font-black">
                        Official Submission Summary
                      </h2>
                    </div>
                    <div className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-[#6d6761]">
                          Registration Number
                        </p>
                        <p className="mt-1 text-2xl font-black text-[#1f1d1b] font-mono">
                          {result.registrationNumber}
                        </p>
                        <p className="mt-1 text-sm text-[#6d6761]">
                          {result.applicantName}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${statusColor(result.status)}`}
                        >
                          {result.status?.replace("_", " ")}
                        </span>
                        <div className="mt-2">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${paymentColor(result.paymentStatus)}`}
                          >
                            <IndianRupee className="w-3 h-3" />
                            {result.paymentStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 border-t border-[#f0e8e0] pt-5 sm:grid-cols-3">
                      <InfoTile
                        label="Application ID"
                        value={result.applicationId || "Not available"}
                      />
                      <InfoTile
                        label="Mobile"
                        value={mobile ? `******${mobile.slice(-4)}` : "Verified"}
                      />
                      <InfoTile
                        label="Submitted On"
                        value={fmt(result.submittedAt || result.createdAt)}
                      />
                    </div>
                    </div>
                  </div>

                  {/* Applied posts */}
                  {result.appliedPosts?.length > 0 && (
                    <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm">
                      <h3 className="font-black text-[#1f1d1b] mb-3 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-[#e46a1d]" />
                        Applied Posts
                      </h3>
                      <div className="divide-y divide-[#f0e9e1] rounded border border-[#f0e9e1]">
                        {result.appliedPosts.map((p, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-4 px-4 py-3"
                          >
                            <span className="text-sm text-[#1f1d1b] font-semibold">
                              {p.title}
                            </span>
                            <span className="text-xs text-[#6d6761]">
                              {p.postCode}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Important dates */}
                  {result.jobDetails && (
                    <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm">
                      <h3 className="font-black text-[#1f1d1b] mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-[#e46a1d]" />
                        Important Dates
                      </h3>
                      <div className="rounded border border-[#f0e9e1]">
                        {[
                          {
                            label: "Exam Date",
                            val: result.jobDetails.examDate,
                          },
                          {
                            label: "Admit Card",
                            val: result.jobDetails.admitCardDate,
                          },
                          {
                            label: "Result Date",
                            val: result.jobDetails.resultDate,
                          },
                        ].map(({ label, val }) => (
                          <div
                            key={label}
                            className="flex items-center justify-between gap-4 border-b border-[#f0e9e1] px-4 py-3 last:border-0"
                          >
                            <span className="text-sm text-[#6d6761]">
                              {label}
                            </span>
                            <span className="text-sm font-semibold text-[#1f1d1b]">
                              {fmt(val)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {result.admitCardAvailable && (
                      <button
                        onClick={() => navigate("/admit-cards")}
                        className="flex items-center justify-center gap-2 h-12 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-lg font-black uppercase tracking-widest text-xs transition"
                      >
                        <Download className="w-4 h-4" />
                        Download Admit Card
                      </button>
                    )}
                    {result.correctionWindow?.isOpen && (
                      <button
                        onClick={() =>
                          navigate("/correction-request", {
                            state: {
                              lookup: {
                                registrationNumber: result.registrationNumber,
                                mobile,
                              },
                            },
                          })
                        }
                        className="flex items-center justify-center gap-2 h-12 bg-white border-2 border-[#e46a1d] text-[#e46a1d] hover:bg-orange-50 rounded-lg font-black uppercase tracking-widest text-xs transition"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Request Correction
                      </button>
                    )}
                    {result.correctionWindow?.isOpen === false &&
                      result.correctionWindow?.endDate && (
                        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 font-semibold sm:col-span-2">
                          <Clock className="w-4 h-4 shrink-0" />
                          Correction window was open{" "}
                          {fmt(result.correctionWindow.startDate)} –{" "}
                          {fmt(result.correctionWindow.endDate)}
                        </div>
                      )}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <aside className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm">
              <div>
                <h3 className="mb-4 text-[18px] font-black text-[#1f1d1b]">
                  Other Services
                </h3>
                {[
                  { label: "Download Admit Card", to: "/admit-cards" },
                  { label: "Request Correction", to: "/correction-request" },
                  { label: "Contact Support", to: "/contact" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.to)}
                    className="mb-2 flex h-14 w-full items-center justify-between rounded-[6px] border border-[#e0d7cd] px-4 transition hover:border-orange-300 hover:bg-orange-50 last:mb-0"
                  >
                    <span className="text-sm font-bold text-[#1f1d1b]">
                      {item.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9a8f86]" />
                  </button>
                ))}
              </div>

              <div className="mt-6 rounded-[8px] border border-amber-200 bg-[#fff8e6] p-5">
                <div className="mb-3 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  <p className="text-sm font-black text-amber-800">
                    Keep your registration number safe
                  </p>
                </div>
                <p className="text-sm leading-6 text-amber-800/90">
                  You will need it for admit card download and result checking.
                  It was sent to your registered email and mobile.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
