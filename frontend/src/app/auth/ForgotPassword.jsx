import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "../../services/auth.service";
import heroBg from "../../assets/herobg.jpg";
import logo from "../../assets/logo.png";
import { showOtpToast } from "../../utils/otpToast";

const ACCOUNT_TYPES = {
  candidate: {
    label: "Candidate",
    eyebrow: "Candidate Account",
    title: "Reset Candidate Password",
    description:
      "Recover access to your applications, documents, payments, and admit cards.",
    loginPath: "/auth/candidate-login",
    emailPlaceholder: "candidate@example.com",
  },
  admin: {
    label: "Super Admin",
    eyebrow: "Super Admin",
    title: "Reset Super Admin Password",
    description:
      "Recover access to root administration controls and platform configuration.",
    loginPath: "/auth/admin-login",
    emailPlaceholder: "superadmin@recruitment.gov.in",
  },
  employee: {
    label: "Employee",
    eyebrow: "Employee Access",
    title: "Reset Employee Password",
    description:
      "Recover access to the recruitment modules assigned to your role.",
    loginPath: "/auth/employee-login",
    emailPlaceholder: "employee@recruitment.gov.in",
  },
};

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-orange-500";

const ForgotPassword = ({ accountType: fixedAccountType }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Use prop if provided, otherwise fallback to URL param or default to candidate
  const accountType =
    fixedAccountType ||
    (ACCOUNT_TYPES[searchParams.get("type")]
      ? searchParams.get("type")
      : "candidate");

  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("request");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const config = ACCOUNT_TYPES[accountType];

  const passwordChecks = useMemo(() => {
    const value = newPassword || "";
    return [
      { label: "At least 8 characters", ok: value.length >= 8 },
      { label: "Contains a letter", ok: /[A-Za-z]/.test(value) },
      { label: "Contains a number", ok: /\d/.test(value) },
    ];
  }, [newPassword]);

  const requestOtp = async (event) => {
    event.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Enter your registered email address.");
      return;
    }
    setLoading(true);
    try {
      const result = await authService.forgotPassword({
        email: email.trim(),
        accountType,
      });
      showOtpToast(
        result,
        result?.message || "Reset OTP sent if the account exists.",
      );
      setStep("reset");
    } catch (err) {
      setError(err.message || "Could not start password reset.");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (event) => {
    event.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6 digit OTP sent to your email.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim(),
        accountType,
        otp,
        newPassword,
      });
      toast.success("Password reset successful. Please sign in.");
      navigate(config.loginPath, { replace: true });
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex h-screen w-full flex-col overflow-hidden bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="fixed inset-0 bg-black/55" />

      <div className="relative z-10 flex h-screen items-center justify-center px-4 py-4">
        <div className="flex max-h-[calc(100vh-32px)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="hidden w-[42%] shrink-0 flex-col bg-[#fdf8f2] p-8 lg:flex">
            <Link to="/" className="mb-8 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#1f1d1b] shadow-sm">
                <img
                  src={logo}
                  alt="ICEF India"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div>
                <p className="text-sm font-black leading-tight text-orange-600">
                  Recruitment Portal
                </p>
                <p className="text-[9px] font-bold uppercase tracking-widest text-gray-400">
                  {config.eyebrow}
                </p>
              </div>
            </Link>

            <h1 className="text-[28px] font-black leading-tight text-gray-900">
              Secure Password Recovery
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-gray-500">
              {config.description}
            </p>

            <div className="mt-7 space-y-4">
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
                    <ShieldCheck className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-orange-900">
                      {config.label} Account Recovery
                    </p>
                    <p className="text-xs text-orange-700">
                      OTP expires in 10 minutes
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Recovery Process
                </p>
                <ul className="mt-3 space-y-2 text-xs text-gray-600">
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span>Enter your registered email address</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span>Receive a 6-digit OTP via email</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                    <span>Enter OTP and set new password</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="mt-auto rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-red-600">
                Security Warning
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-700">
                Never share your OTP with anyone. A successful password reset
                will sign out all active sessions.
              </p>
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-white">
            <div className="h-1 w-full shrink-0 bg-gradient-to-r from-orange-500 to-yellow-400" />

            <div className="flex flex-1 flex-col justify-center px-7 py-8 sm:px-10">
              <Link
                to={config.loginPath}
                className="mb-6 inline-flex w-fit items-center gap-2 text-xs font-semibold text-gray-500 hover:text-orange-600"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {config.label} Login
              </Link>

              <p className="text-xs font-bold uppercase tracking-widest text-orange-600">
                {config.eyebrow}
              </p>
              <h2 className="mt-2 text-2xl font-black text-gray-900">
                {config.title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{config.description}</p>

              <form
                onSubmit={step === "request" ? requestOtp : resetPassword}
                className="mt-7 space-y-5"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Registered Email
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      disabled={step === "reset"}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder={config.emailPlaceholder}
                      className={`${inputCls} pr-10 disabled:bg-gray-50 disabled:text-gray-500`}
                    />
                    <Mail className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                {step === "reset" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                        Email OTP
                      </label>
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        required
                        value={otp}
                        onChange={(event) =>
                          setOtp(
                            event.target.value.replace(/\D/g, "").slice(0, 6),
                          )
                        }
                        placeholder="Enter 6 digit OTP"
                        className={`${inputCls} tracking-[0.35em]`}
                      />
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={newPassword}
                          onChange={(event) =>
                            setNewPassword(event.target.value)
                          }
                          placeholder="Minimum 8 characters"
                          className={`${inputCls} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((value) => !value)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          aria-label={
                            showPassword ? "Hide password" : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(event) =>
                          setConfirmPassword(event.target.value)
                        }
                        placeholder="Repeat new password"
                        className={inputCls}
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-2 rounded-xl bg-gray-50 p-3 sm:grid-cols-3">
                      {passwordChecks.map((check) => (
                        <div
                          key={check.label}
                          className="flex items-center gap-2 text-[11px] text-gray-500"
                        >
                          <CheckCircle
                            className={`h-3.5 w-3.5 ${check.ok ? "text-green-600" : "text-gray-300"}`}
                          />
                          {check.label}
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <>
                      {step === "request" ? (
                        <Mail className="h-4 w-4" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      {step === "request" ? "Send Reset OTP" : "Reset Password"}
                    </>
                  )}
                </button>

                {step === "reset" && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={requestOtp}
                    className="w-full text-center text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-60"
                  >
                    Resend OTP
                  </button>
                )}
              </form>

              <div className="mt-6 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-xs text-orange-700">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                Use this page only for your own account. Never share OTPs with
                anyone.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
