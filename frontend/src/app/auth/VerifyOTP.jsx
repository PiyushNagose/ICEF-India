import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Mail, Send, CheckCircle } from "lucide-react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import { Card, CardContent } from "../../components/ui/Card";
import heroBg from "../../assets/herobg.jpg";
import { authService } from "../../services/auth.service";
import { showOtpToast } from "../../utils/otpToast";

const VerifyOTP = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [email, setEmail] = useState(location.state?.email || "");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [otpSent, setOtpSent] = useState(
    // If coming from registration, OTP was already sent
    Boolean(location.state?.email),
  );
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");

  // Countdown timer for resend cooldown
  const startCooldown = (seconds = 60) => {
    setCooldown(seconds);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    if (!email.trim()) {
      setError("Please enter your registered email address");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    setError("");
    setIsSending(true);
    try {
      const response = await authService.resendOtp(email.trim());
      setOtpSent(true);
      showOtpToast(response, "OTP sent to your email");
      startCooldown(60);
      // Clear any previously entered OTP
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
    } catch (err) {
      setError(err.message || "Failed to send OTP. Please check your email.");
    } finally {
      setIsSending(false);
    }
  };

  const handleOtpChange = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      document.getElementById("otp-5")?.focus();
    }
  };

  const handleVerify = async () => {
    setError("");
    const otpString = otp.join("");
    if (otpString.length < 6) {
      setError("Please enter the complete 6-digit OTP");
      return;
    }
    setIsVerifying(true);
    try {
      await authService.verifyOtp({ email, otp: otpString });
      toast.success("Email verified successfully! You can now login.");
      window.location.href = "/";
    } catch (err) {
      setError(err.message || "Invalid or expired OTP");
      setOtp(["", "", "", "", "", ""]);
      setTimeout(() => document.getElementById("otp-0")?.focus(), 100);
    } finally {
      setIsVerifying(false);
    }
  };

  const otpComplete = otp.every((d) => d !== "");

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center p-4"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      <div className="absolute inset-0 bg-black/50" />

      <div className="relative z-20 w-full max-w-lg">
        <Card className="bg-white shadow-2xl border-t-4 border-t-orange-500">
          <CardContent className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium mb-4">
                EMAIL VERIFICATION
              </div>
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                Verify Your Account
              </h1>
              <p className="text-gray-600 text-sm">
                {otpSent
                  ? `A 6-digit OTP has been sent to ${email || "your email"}. Enter it below.`
                  : "Enter your registered email to receive a verification OTP."}
              </p>
            </div>

            {/* Email Field */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Registered Email <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    disabled={otpSent && cooldown > 0}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                      otpSent && cooldown > 0
                        ? "bg-gray-50 text-gray-500"
                        : "border-gray-300"
                    }`}
                    placeholder="candidate@example.com"
                  />
                </div>
                {/* Send / Resend OTP Button */}
                <Button
                  onClick={handleSendOtp}
                  disabled={isSending || cooldown > 0 || !email.trim()}
                  variant={otpSent ? "outline" : "default"}
                  className={`whitespace-nowrap px-4 ${
                    !otpSent
                      ? "bg-orange-600 hover:bg-orange-700 text-white"
                      : "border-orange-300 text-orange-600 hover:bg-orange-50"
                  }`}
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : cooldown > 0 ? (
                    `Resend (${cooldown}s)`
                  ) : otpSent ? (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Resend
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-1" />
                      Send OTP
                    </>
                  )}
                </Button>
              </div>
              {otpSent && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  OTP sent — check your inbox and spam folder
                </p>
              )}
            </div>

            {/* OTP Input — only show after OTP is sent */}
            {otpSent && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  Enter 6-Digit OTP
                </label>
                <div
                  className="flex justify-center space-x-3 mb-3"
                  onPaste={handlePaste}
                >
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      inputMode="numeric"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={`w-12 h-12 text-center text-xl font-semibold border-2 rounded-lg focus:outline-none transition-colors ${
                        digit
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-gray-300 focus:border-orange-500"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-center text-xs text-gray-500">
                  OTP is valid for 10 minutes. You can paste the OTP directly.
                </p>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Verify Button */}
            {otpSent && (
              <Button
                onClick={handleVerify}
                disabled={!otpComplete || isVerifying}
                className="w-full py-4 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white font-medium text-base"
              >
                {isVerifying ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Verify & Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
            )}

            {/* Links */}
            <div className="text-center mt-6 space-y-2">
              <Link
                to="/auth/register"
                className="block text-sm text-orange-600 hover:text-orange-700"
              >
                ← Back to registration
              </Link>
              <Link
                to="/auth/candidate-login"
                className="block text-sm text-gray-500 hover:text-gray-700"
              >
                Already verified? Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyOTP;
