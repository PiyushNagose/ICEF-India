import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, CheckCircle, Info, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import { authService } from "../../services/auth.service";
import { getDashboardPath, useAuth } from "../../hooks/useAuth";
import heroBg from "../../assets/herobg.jpg";
import logo from "../../assets/logo.png";
import CustomSelect from "../../components/ui/CustomSelect";
import { showOtpToast } from "../../utils/otpToast";

const STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa",
  "Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala",
  "Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland",
  "Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura",
  "Uttar Pradesh","Uttarakhand","West Bengal",
];

const SIDE_IMAGE =
  "https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=640&h=220&q=80&fit=crop&crop=faces";

const FEATURES = [
  "Secure Application Tracking",
  "Real-Time Application Updates",
  "Document & Payment Management",
  "Government Recruitment Opportunities",
];

const STATS = [
  { value: "150+", label: "Active Recruitments" },
  { value: "500K+", label: "Apps Processed" },
  { value: "99.9%", label: "Secure Platform" },
];

const Label = ({ children }) => (
  <label className="block text-[11px] font-semibold text-gray-600 mb-1">
    {children}
  </label>
);

const inputCls =
  "w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white placeholder-gray-400";

const Register = () => {
  const navigate = useNavigate();
  const { user, isLoading: isAuthChecking } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    registeredMobile: "",
    dateOfBirth: "",
    gender: "",
    state: "",
    password: "",
  });

  useEffect(() => {
    if (!isAuthChecking && user) navigate(getDashboardPath(user), { replace: true });
  }, [isAuthChecking, navigate, user]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!formData.fullName.trim()) { setError("Full name is required"); return; }
    if (!formData.dateOfBirth)    { setError("Date of birth is required"); return; }
    if (!formData.gender)         { setError("Gender is required"); return; }
    setIsLoading(true);
    try {
      const response = await authService.register(formData);
      showOtpToast(response, "Registration successful. Please verify OTP");
      navigate("/auth/verify-otp", {
        state: { email: formData.email, registeredMobile: formData.registeredMobile },
        replace: true,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const pwd = formData.password;
  const checks = {
    length:    pwd.length >= 8,
    number:    /\d/.test(pwd),
    uppercase: /[A-Z]/.test(pwd),
    special:   /[^A-Za-z0-9]/.test(pwd),
  };

  return (
    /* Full-page bg — min-h-screen + pb so content never shows black below */
    <div
      className="h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      {/* Overlay covers everything */}
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />

      {/* Scrollable center content */}
      <div className="relative z-10 flex h-screen flex-col items-center justify-center px-4 py-4">

        {/* ── Floating card ── */}
        <div className="w-full max-w-6xl max-h-[calc(100vh-96px)] rounded-2xl overflow-hidden shadow-2xl flex bg-white">

          {/* LEFT PANEL */}
          <div className="hidden lg:flex lg:w-[36%] flex-col bg-[#fdf8f2] p-7 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-lg bg-[#1f1d1b] flex items-center justify-center shadow-sm overflow-hidden">
                <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
              </div>
              <div>
                <p className="text-orange-600 font-black text-sm leading-tight">Recruitment Portal</p>
                <p className="text-gray-400 text-[9px] font-bold tracking-widest uppercase">Government of India</p>
              </div>
            </Link>

            <h2 className="text-[24px] font-black text-gray-900 leading-tight mb-2">
              Build Your Future.<br />Apply with Confidence.
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Create your account to apply for recruitment opportunities, track
              application progress, manage documents, receive notifications, and
              access recruitment updates.
            </p>

            <ul className="space-y-2 mb-5">
              {FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-xs text-gray-600">
                  <CheckCircle className="w-4 h-4 text-orange-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="rounded-xl overflow-hidden mb-5 border border-gray-100">
              <img
                src={SIDE_IMAGE}
                alt="Candidate"
                className="w-full h-24 object-cover object-center"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>

            <div className="flex gap-5 mt-auto">
              {STATS.map((s) => (
                <div key={s.value}>
                  <p className="text-orange-500 font-black text-base leading-none">{s.value}</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Orange top stripe */}
            <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-yellow-400 shrink-0" />

            <div className="flex-1 px-7 py-6">
              {/* Mobile logo */}
              <Link to="/" className="flex items-center gap-2 mb-4 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-[#1f1d1b] flex items-center justify-center overflow-hidden">
                  <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
                </div>
                <p className="font-bold text-gray-800 text-sm">Recruitment Portal</p>
              </Link>

              <h1 className="text-2xl font-black text-gray-900 mb-0.5">Create Your Account</h1>
              <p className="text-xs text-gray-400 mb-4">Start your application journey in minutes.</p>

              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3">

                {/* Full Name */}
                <div>
                  <Label>Full Name <span className="text-red-500">*</span></Label>
                  <input
                    type="text"
                    required
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={(e) => handleChange("fullName", e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Email */}
                <div>
                  <Label>Email Address <span className="text-red-500">*</span></Label>
                  <input
                    type="email"
                    required
                    placeholder="john.doe@example.com"
                    value={formData.email}
                    onChange={(e) => handleChange("email", e.target.value)}
                    className={inputCls}
                  />
                  <p className="text-[10px] text-gray-400 mt-0.5">OTP will be sent to this email</p>
                </div>

                {/* Mobile */}
                <div>
                  <Label>Registered Mobile <span className="text-red-500">*</span></Label>
                  <div className="flex gap-2">
                    <span className="flex items-center px-3 border border-gray-200 rounded-lg bg-gray-50 text-sm text-gray-700 font-semibold shrink-0">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      pattern="[6-9][0-9]{9}"
                      placeholder="98765 43210"
                      value={formData.registeredMobile}
                      onChange={(e) => handleChange("registeredMobile", e.target.value)}
                      className={`${inputCls} flex-1`}
                    />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-0.5">10-digit mobile number</p>
                </div>

                {/* DOB + Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date of Birth <span className="text-red-500">*</span></Label>
                    <input
                      type="date"
                      required
                      max={new Date(new Date().setFullYear(new Date().getFullYear() - 18))
                        .toISOString().split("T")[0]}
                      value={formData.dateOfBirth}
                      onChange={(e) => handleChange("dateOfBirth", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Gender <span className="text-red-500">*</span></Label>
                    <CustomSelect
                      value={formData.gender}
                      onChange={(val) => handleChange("gender", val)}
                      options={[
                        { value: "", label: "Select Gender" },
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                        { value: "other", label: "Other" },
                      ]}
                      placeholder="Select Gender"
                    />
                  </div>
                </div>

                {/* State */}
                <div>
                  <Label>State <span className="text-red-500">*</span></Label>
                  <CustomSelect
                    value={formData.state}
                    onChange={(val) => handleChange("state", val)}
                    options={[{ value: "", label: "Select your state" }, ...STATES.map(s => ({ value: s, label: s }))]}
                    placeholder="Select your state"
                    error={false}
                  />
                </div>

                {/* Password */}
                <div>
                  <Label>Password <span className="text-red-500">*</span></Label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={(e) => handleChange("password", e.target.value)}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {pwd && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
                      {[
                        { ok: checks.length,    label: "8+ characters" },
                        { ok: checks.uppercase, label: "One uppercase letter" },
                        { ok: checks.number,    label: "One number" },
                        { ok: checks.special,   label: "Special character" },
                      ].map(({ ok, label }) => (
                        <span key={label} className={`flex items-center gap-1 text-[10px] font-medium ${ok ? "text-emerald-600" : "text-gray-400"}`}>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ok ? "bg-emerald-500" : "bg-gray-300"}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Terms */}
                <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" required className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-xs text-gray-500 leading-relaxed">
                      I agree to the{" "}
                      <Link to="/terms" className="text-orange-500 hover:underline font-semibold">Terms of Service</Link>
                      {" "}and{" "}
                      <Link to="/privacy" className="text-orange-500 hover:underline font-semibold">Privacy Policy</Link>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" className="mt-0.5 w-4 h-4 shrink-0 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    <span className="text-xs text-gray-500">Receive recruitment updates via Email, SMS, and WhatsApp.</span>
                  </label>
                </div>

                {error && (
                  <div className="md:col-span-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="md:col-span-2 w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Create Account &amp; Continue <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <p className="md:col-span-2 text-center text-sm text-gray-500">
                  Already have an account?{" "}
                  <Link to="/auth/candidate-login" className="text-orange-500 font-semibold hover:text-orange-600">
                    Sign In
                  </Link>
                </p>

                <div className="md:col-span-2 rounded-lg bg-orange-50 border border-orange-100 px-4 py-2 flex items-center gap-2">
                  <Info className="h-4 w-4 shrink-0 text-orange-500" />
                  <p className="text-[11px] text-orange-700 leading-relaxed">
                    You can complete your profile and application details after creating your account.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* Trust badges — OUTSIDE card, below it */}
        <div className="flex flex-wrap justify-center gap-8 mt-10">
          {[
            { icon: Landmark, title: "Official Portal",     sub: "Government of India"  },
            { icon: LockKeyhole, title: "256-bit Encryption", sub: "Bank-level security"   },
            { icon: ShieldCheck, title: "Privacy First",      sub: "Your data is protected" },
          ].map((b) => (
            <div key={b.title} className="flex min-w-[170px] items-center gap-3 text-white/85">
              <b.icon className="h-6 w-6 shrink-0 text-orange-300" />
              <div>
                <p className="text-xs font-bold leading-tight">{b.title}</p>
                <p className="text-[10px] opacity-70">{b.sub}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Register;
