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
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Mail,
  Phone,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicService } from "../../services/public.service";
import { authService } from "../../services/auth.service";
import { candidateService } from "../../services/candidate.service";
import {
  getFirstApplicationRoute,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

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

const Input = ({ ...props }) => (
  <input
    className="w-full h-11 px-3 rounded-lg border border-[#e0d7cd] bg-white text-sm text-[#1f1d1b] placeholder-[#b0a89e] outline-none focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition"
    {...props}
  />
);

const PrimaryBtn = ({ loading, children, className = "", ...props }) => (
  <button
    disabled={loading || props.disabled}
    className={`inline-flex items-center justify-center gap-2 h-11 px-5 bg-[#e46a1d] hover:bg-[#cb5d16] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-black uppercase tracking-widest text-xs transition ${className}`}
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

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isMobileValid = /^[6-9]\d{9}$/.test(mobile);

  // ── send OTP ──────────────────────────────────────────────

  const handleSendEmail = async () => {
    if (!isEmailValid) {
      toast.error("Enter a valid email address");
      return;
    }
    setSendEmailLoading(true);
    try {
      await publicService.sendOTP(email, "email");
      setEmailOtpSent(true);
      toast.success("OTP sent to your email");
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
    setSendMobileLoading(true);
    try {
      await publicService.sendOTP(mobile, "mobile");
      setMobileOtpSent(true);
      toast.success("OTP sent to your mobile");
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
      if (!err.toastShown) toast.error(err.message || "Something went wrong");
    } finally {
      setProceedLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9] flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-7 h-7 text-[#e46a1d]" />
            </div>
            <h1 className="text-2xl font-black text-[#1f1d1b]">
              Verify Your Identity
            </h1>
            <p className="mt-2 text-sm text-[#6d6761]">
              No account needed. Just verify your email and mobile to start your
              application.
            </p>
          </div>

          <div className="bg-white border border-[#e0d7cd] rounded-2xl p-6 shadow-sm space-y-6">
            {/* Email section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#4a4440] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[#e46a1d]" />
                  Email Address
                </label>
                {emailVerified && <VerifiedBadge />}
              </div>

              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailOtpSent(false);
                    setEmailVerified(false);
                  }}
                  disabled={emailVerified}
                />
                {!emailVerified && (
                  <PrimaryBtn
                    loading={sendEmailLoading}
                    disabled={!isEmailValid}
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
            <div className="border-t border-[#f0e9e1]" />

            {/* Mobile section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black uppercase tracking-widest text-[#4a4440] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#e46a1d]" />
                  Mobile Number
                </label>
                {mobileVerified && <VerifiedBadge />}
              </div>

              <div className="flex gap-2">
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
                  disabled={mobileVerified}
                />
                {!mobileVerified && (
                  <PrimaryBtn
                    loading={sendMobileLoading}
                    disabled={!isMobileValid}
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
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex gap-2 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Make sure to use your real email and mobile — your Registration
                Number will be sent there after payment.
              </span>
            </div>

            {/* Proceed button */}
            <PrimaryBtn
              loading={proceedLoading}
              disabled={!emailVerified || !mobileVerified}
              onClick={handleProceed}
              className="w-full"
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
        </motion.div>
      </div>
    </PublicLayout>
  );
}
