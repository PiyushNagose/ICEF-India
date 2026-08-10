/**
 * PublicApplyEntry.jsx
 *
 * Route: /apply/:slug/start
 *
 * This is a THIN entry page for public (no-login) applicants.
 * It:
 *   1. Verifies email + mobile via OTP
 *   2. Calls POST /api/auth/public-apply-login → gets JWT
 *   3. Stores session exactly like a normal candidate login
 *   4. Redirects to the EXISTING /application/post-selection?jobId=...
 *
 * No new form steps are built here — the existing multi-step application
 * flow handles everything after login.
 */

import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  BadgeCheck,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
  FileText,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicService } from "../../services/public.service";
import { authService } from "../../services/auth.service";
import { candidateService } from "../../services/candidate.service";
import {
  getFirstApplicationRoute,
  persistApplicationDraft,
} from "../../utils/applicationFlow";
import { getJobAvailability } from "../../utils/jobAvailability";
import { showOtpToast } from "../../utils/otpToast";

// ── helpers ───────────────────────────────────────────────────

const OTP_TTL = 300; // 5 minutes

function OtpTimer({ active, onExpire }) {
  const [remaining, setRemaining] = useState(OTP_TTL);
  const ref = useRef(null);

  useEffect(() => {
    if (!active) return;
    setRemaining(OTP_TTL);
    ref.current = setInterval(() => {
      setRemaining((s) => {
        if (s <= 1) {
          clearInterval(ref.current);
          onExpire?.();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(ref.current);
  }, [active]);

  if (!active) return null;

  const m = String(Math.floor(remaining / 60)).padStart(2, "0");
  const s = String(remaining % 60).padStart(2, "0");

  return (
    <p className="mt-1 text-xs text-[#6d6761]">
      OTP expires in{" "}
      <span className="font-bold text-[#e46a1d]">
        {m}:{s}
      </span>
    </p>
  );
}

const Input = ({ className = "", ...props }) => (
  <input
    className={`h-12 w-full rounded-[6px] border border-[#e0d7cd] bg-white px-4 text-sm text-[#1f1d1b] outline-none transition placeholder:text-[#b0a89e] focus:border-orange-400 focus:ring-2 focus:ring-orange-200 disabled:bg-[#faf7f2] ${className}`}
    {...props}
  />
);

const PrimaryBtn = ({ loading, children, className = "", ...props }) => (
  <button
    disabled={loading || props.disabled}
    className={`inline-flex h-12 items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] px-5 text-xs font-black uppercase tracking-[0.14em] text-white transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-45 ${className}`}
    {...props}
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
    {children}
  </button>
);

const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 text-xs font-black text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
    <CheckCircle2 className="w-3.5 h-3.5" /> Verified
  </span>
);

// ── main component ────────────────────────────────────────────

export default function PublicApplyEntry() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("jobId");

  // contact
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");

  // OTP states
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [mobileOtpSent, setMobileOtpSent] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [mobileVerified, setMobileVerified] = useState(false);

  // loading
  const [sendEmailLoading, setSendEmailLoading] = useState(false);
  const [sendMobileLoading, setSendMobileLoading] = useState(false);
  const [verifyEmailLoading, setVerifyEmailLoading] = useState(false);
  const [verifyMobileLoading, setVerifyMobileLoading] = useState(false);
  const [proceedLoading, setProceedLoading] = useState(false);

  const { data: projectData, isLoading: isCheckingJob } = useQuery({
    queryKey: ["public-apply-entry", slug],
    queryFn: () => publicService.getProjectBySlug(slug),
    staleTime: 60 * 1000,
    retry: 1,
  });

  const selectedJob = (projectData?.jobs || []).find((job) => job._id === jobId);
  const availability = selectedJob ? getJobAvailability(selectedJob) : null;
  const entryBlocked =
    !jobId ||
    (!isCheckingJob && (!selectedJob || (availability && !availability.canApply)));
  const blockedMessage = !jobId
    ? "Please select a post before starting the application."
    : !selectedJob && !isCheckingJob
      ? "This post is not available under the selected recruitment."
      : availability && !availability.canApply
        ? availability.reason || availability.label
        : "";

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isMobileValid = /^[6-9]\d{9}$/.test(mobile);

  // ── send OTP ──────────────────────────────────────────────

  const handleSendEmail = async () => {
    if (!isEmailValid) {
      toast.error("Enter a valid email address");
      return;
    }
    if (entryBlocked) {
      toast.error(blockedMessage || "This application is not available");
      return;
    }
    setSendEmailLoading(true);
    try {
      const response = await publicService.sendOTP(email, "email");
      setEmailOtpSent(true);
      showOtpToast(response, "OTP sent to your email");
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendEmailLoading(false);
    }
  };

  const handleSendMobile = async () => {
    if (!isMobileValid) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    if (entryBlocked) {
      toast.error(blockedMessage || "This application is not available");
      return;
    }
    setSendMobileLoading(true);
    try {
      const response = await publicService.sendOTP(mobile, "mobile");
      setMobileOtpSent(true);
      showOtpToast(response, "OTP sent to your mobile");
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendMobileLoading(false);
    }
  };

  // ── verify OTP ────────────────────────────────────────────

  const handleVerifyEmail = async () => {
    if (emailOtp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setVerifyEmailLoading(true);
    try {
      await publicService.verifyOTP(email, "email", emailOtp);
      setEmailVerified(true);
      toast.success("Email verified!");
    } catch (err) {
      if (!err.toastShown) toast.error("Invalid or expired OTP");
    } finally {
      setVerifyEmailLoading(false);
    }
  };

  const handleVerifyMobile = async () => {
    if (mobileOtp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setVerifyMobileLoading(true);
    try {
      await publicService.verifyOTP(mobile, "mobile", mobileOtp);
      setMobileVerified(true);
      toast.success("Mobile verified!");
    } catch (err) {
      if (!err.toastShown) toast.error("Invalid or expired OTP");
    } finally {
      setVerifyMobileLoading(false);
    }
  };

  // ── proceed after both verified ───────────────────────────

  const handleProceed = async () => {
    if (!emailVerified || !mobileVerified) return;
    if (!jobId) {
      toast.error("Please select a job before starting the application");
      navigate(`/apply/${slug}`, { replace: true });
      return;
    }
    if (entryBlocked) {
      toast.error(blockedMessage || "This application is not available");
      navigate(`/apply/${slug}`, { replace: true });
      return;
    }

    setProceedLoading(true);
    try {
      await authService.publicApplyLogin(email, mobile);

      const result = await candidateService.createApplication(jobId);
      const application = result?.application || result;
      const applicationId = application?._id;

      if (!applicationId) {
        throw new Error("Application draft could not be created");
      }

      persistApplicationDraft({ applicationId, jobId });
      sessionStorage.setItem(
        "publicApplyContext",
        JSON.stringify({ projectSlug: slug, jobId, applicationId, email, mobile }),
      );

      const destination = getFirstApplicationRoute(application?.jobId || application);
      navigate(destination, {
        replace: true,
        state: { applicationId, jobId },
      });
    } catch (err) {
      if (err.status === 409) {
        const duplicate = err.errors?.[0] || {};
        toast("Application already exists. Please check your status.", {
          icon: "i",
        });
        navigate("/check-status", {
          replace: true,
          state: {
            applicationId: duplicate.applicationId,
            publicApplicationId: duplicate.publicApplicationId,
            registrationNumber: duplicate.registrationNumber,
            status: duplicate.status,
          },
        });
        return;
      }
      if (!err.toastShown) toast.error(err.message || "Something went wrong");
    } finally {
      setProceedLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-90px)] bg-[#f5efe9]">
        <div className="bg-[#201d1a] text-white">
          <div className="mx-auto max-w-[1380px] px-4 py-9 sm:px-6 lg:px-8">
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
              Secure Application Entry
            </p>
            <h1 className="text-[30px] font-black leading-tight sm:text-[36px]">
              Verify Your Identity
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/70">
              Verify your email and mobile before starting the application.
              No candidate account is required.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1380px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid items-stretch gap-7 lg:grid-cols-[420px_minmax(0,1fr)]"
        >
          <aside className="flex flex-col rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-orange-50 text-[#e46a1d]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="mt-5 text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">
              Application Access
            </p>
            <h2 className="mt-2 text-[24px] font-black leading-tight text-[#1f1d1b]">
              One-time verification for a secure application session.
            </h2>
            <p className="mt-3 text-sm font-medium leading-6 text-[#6d6761]">
              Your verified contact details will be attached to the application
              and used for registration number, status, and admit card access.
            </p>

            <div className="mt-6 grid gap-3">
              {[
                "Email OTP verification",
                "Mobile OTP verification",
                "Public application session",
                "Registration after payment",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-sm font-semibold text-[#4a4440]">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-auto rounded-[6px] bg-[#faf7f2] px-4 py-3 text-xs font-semibold leading-5 text-[#6d6761]">
              For testing, the OTP appears in the toast when the backend runs in
              development mode.
            </div>
          </aside>

          <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm sm:p-7">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-[#f0e8e0] pb-5">
              <div>
                <h2 className="flex items-center gap-2 text-[18px] font-black text-[#1f1d1b]">
                  <BadgeCheck className="h-5 w-5 text-[#e46a1d]" />
                  Contact Verification
                </h2>
                <p className="mt-1 text-sm font-medium text-[#6d6761]">
                  Complete both checks to continue.
                </p>
              </div>
              {emailVerified && mobileVerified && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-black text-green-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                </span>
              )}
            </div>

            <div className="space-y-5">
            {isCheckingJob && (
              <div className="rounded-lg border border-[#f3dfc9] bg-[#fff8ef] px-4 py-3 text-xs font-semibold text-[#8a5a20] flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#e46a1d]" />
                Checking application window...
              </div>
            )}

            {entryBlocked && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{blockedMessage}</span>
              </div>
            )}

            {selectedJob && !entryBlocked && (
              <div className="rounded-[6px] border border-emerald-200 bg-emerald-50 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-black text-emerald-800">
                  <FileText className="h-4 w-4" />
                  Applying for {selectedJob.title}
                </p>
                <p className="mt-1 text-xs font-semibold text-emerald-700/80">
                  {projectData?.project?.name}
                </p>
              </div>
            )}

            {/* Email section */}
            <div className="rounded-[8px] border border-[#efe7de] bg-[#fffdfb] p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#4a4440]">
                  <Mail className="w-3.5 h-3.5 text-[#e46a1d]" />
                  Email Address
                </label>
                {emailVerified && <VerifiedBadge />}
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailOtpSent(false);
                    setEmailVerified(false);
                  }}
                  disabled={emailVerified || isCheckingJob || entryBlocked}
                />
                {!emailVerified && (
                  <PrimaryBtn
                    loading={sendEmailLoading}
                    disabled={!isEmailValid || isCheckingJob || entryBlocked}
                    onClick={handleSendEmail}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {emailOtpSent ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      "Send OTP"
                    )}
                  </PrimaryBtn>
                )}
              </div>

              {emailOtpSent && !emailVerified && (
                <div className="mt-3 space-y-1">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={emailOtp}
                      onChange={(e) =>
                        setEmailOtp(e.target.value.replace(/\D/g, ""))
                      }
                    />
                    <PrimaryBtn
                      loading={verifyEmailLoading}
                      onClick={handleVerifyEmail}
                      className="shrink-0"
                    >
                      Verify
                    </PrimaryBtn>
                  </div>
                  <OtpTimer
                    active={emailOtpSent && !emailVerified}
                    onExpire={() => setEmailOtpSent(false)}
                  />
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="h-px bg-[#f0e9e1]" />

            {/* Mobile section */}
            <div className="rounded-[8px] border border-[#efe7de] bg-[#fffdfb] p-4">
              <div className="mb-2 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-[#4a4440]">
                  <Phone className="w-3.5 h-3.5 text-[#e46a1d]" />
                  Mobile Number
                </label>
                {mobileVerified && <VerifiedBadge />}
              </div>

              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <Input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile"
                  value={mobile}
                  onChange={(e) => {
                    setMobile(e.target.value.replace(/\D/g, ""));
                    setMobileOtpSent(false);
                    setMobileVerified(false);
                  }}
                  disabled={mobileVerified || isCheckingJob || entryBlocked}
                />
                {!mobileVerified && (
                  <PrimaryBtn
                    loading={sendMobileLoading}
                    disabled={!isMobileValid || isCheckingJob || entryBlocked}
                    onClick={handleSendMobile}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {mobileOtpSent ? (
                      <RefreshCw className="w-4 h-4" />
                    ) : (
                      "Send OTP"
                    )}
                  </PrimaryBtn>
                )}
              </div>

              {mobileOtpSent && !mobileVerified && (
                <div className="mt-3 space-y-1">
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="6-digit OTP"
                      value={mobileOtp}
                      onChange={(e) =>
                        setMobileOtp(e.target.value.replace(/\D/g, ""))
                      }
                    />
                    <PrimaryBtn
                      loading={verifyMobileLoading}
                      onClick={handleVerifyMobile}
                      className="shrink-0"
                    >
                      Verify
                    </PrimaryBtn>
                  </div>
                  <OtpTimer
                    active={mobileOtpSent && !mobileVerified}
                    onExpire={() => setMobileOtpSent(false)}
                  />
                </div>
              )}
            </div>

            {/* Notice */}
            <div className="flex gap-2 rounded-[6px] border border-amber-200 bg-[#fff8e6] px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Make sure to use your real email and mobile — your Registration
                Number will be sent there after payment.
              </span>
            </div>

            {/* Proceed button */}
            <PrimaryBtn
              loading={proceedLoading}
              disabled={!emailVerified || !mobileVerified || isCheckingJob || entryBlocked}
              onClick={handleProceed}
              className="w-full shadow-[0_14px_30px_rgba(228,106,29,0.22)] disabled:shadow-none"
            >
              Start Application
              <ChevronRight className="w-4 h-4" />
            </PrimaryBtn>
            </div>

          <p className="mt-4 text-center text-xs text-[#6d6761]">
            Already applied?{" "}
            <button
              onClick={() => navigate("/check-status")}
              className="text-[#e46a1d] font-bold hover:underline"
            >
              Check your application status
            </button>
          </p>
          </div>
        </motion.div>
        </div>
      </div>
    </PublicLayout>
  );
}
