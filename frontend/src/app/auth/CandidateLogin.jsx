import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, CheckCircle, Landmark, LockKeyhole, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { authService } from "../../services/auth.service";
import { getDashboardPath, useAuth } from "../../hooks/useAuth";
import heroBg from "../../assets/herobg.jpg";
import logo from "../../assets/logo.png";

const SIDE_IMAGE =
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=480&q=80&fit=crop";

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

const TRUST = [
  { icon: Landmark, title: "Official Portal",     sub: "Government of India"   },
  { icon: LockKeyhole, title: "256-bit Encryption", sub: "Bank-level security"    },
  { icon: ShieldCheck, title: "Privacy First",      sub: "Your data is protected" },
];

const inputCls =
  "w-full px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";

const CandidateLogin = () => {
  const navigate = useNavigate();
  const { user, isLoading: isAuthChecking } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isAuthChecking && user) navigate(getDashboardPath(user), { replace: true });
  }, [isAuthChecking, navigate, user]);

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (error) setError("");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await authService.candidateLogin(formData);
      toast.success("Login successful");
      navigate("/candidate/dashboard", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="h-screen w-full overflow-hidden bg-cover bg-center bg-no-repeat flex flex-col"
      style={{ backgroundImage: `url(${heroBg})` }}
    >
      {/* Fixed overlay so it always covers full screen regardless of scroll */}
      <div className="fixed inset-0 bg-black/55 pointer-events-none" />

      {/* Centered content */}
      <div className="relative z-10 flex h-screen flex-col items-center justify-center px-4 py-4">

        {/* Card */}
        <div className="w-full max-w-4xl max-h-[calc(100vh-104px)] rounded-2xl overflow-hidden shadow-2xl flex bg-white">

          {/* LEFT PANEL */}
          <div className="hidden lg:flex lg:w-[44%] flex-col bg-[#fdf8f2] p-7 shrink-0">
            <Link to="/" className="flex items-center gap-2.5 mb-5">
              <div className="w-9 h-9 rounded-lg bg-[#1f1d1b] flex items-center justify-center shadow-sm overflow-hidden">
                <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
              </div>
              <div>
                <p className="text-orange-600 font-black text-sm leading-tight">Recruitment Portal</p>
                <p className="text-gray-400 text-[9px] font-bold tracking-widest uppercase">Government of India</p>
              </div>
            </Link>

            <h2 className="text-[26px] font-black text-gray-900 leading-tight mb-2">
              Welcome Back
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed mb-4">
              Sign in to continue your applications, track recruitment progress,
              manage documents, and receive important updates.
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
                className="w-full h-28 object-cover"
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
            <div className="h-1 w-full bg-gradient-to-r from-orange-500 to-yellow-400 shrink-0" />

            <div className="flex-1 flex flex-col justify-center px-8 py-8">
              {/* Mobile logo */}
              <Link to="/" className="flex items-center gap-2 mb-4 lg:hidden">
                <div className="w-8 h-8 rounded-lg bg-[#1f1d1b] flex items-center justify-center overflow-hidden">
                  <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
                </div>
                <p className="font-bold text-gray-800 text-sm">Recruitment Portal</p>
              </Link>

              <h1 className="text-2xl font-black text-gray-900 mb-1">Sign In</h1>
              <p className="text-xs text-gray-400 mb-5">Access Your Recruitment Account</p>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => handleInputChange("password", e.target.value)}
                      className={`${inputCls} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" className="w-3.5 h-3.5 rounded border-gray-300 text-orange-500 focus:ring-orange-500" />
                    Remember me
                  </label>
                  <Link to="/auth/forgot-password" className="text-xs font-semibold text-orange-500 hover:text-orange-600">
                    Forgot Password?
                  </Link>
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-600">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : "Sign In"}
                </button>

                <p className="text-center text-sm text-gray-500">
                  Don't have an account?{" "}
                  <Link to="/auth/register" className="text-orange-500 font-semibold hover:text-orange-600">
                    Create an Account
                  </Link>
                </p>
              </form>
            </div>
          </div>
        </div>

        {/* Trust badges — below card, never overlapping */}
        <div className="flex flex-wrap justify-center gap-8 mt-10">
          {TRUST.map((b) => (
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

export default CandidateLogin;
