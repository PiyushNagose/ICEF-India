import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, ArrowRight } from "lucide-react";
import toast from "react-hot-toast";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { authService } from "../../services/auth.service";
import logo from "../../assets/logo.png";

const Login = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    userType: "candidate",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (formData.userType === "admin") {
        await authService.adminLogin({
          email: formData.email,
          password: formData.password,
        });
        toast.success("Admin login successful");
        navigate("/admin/dashboard", { replace: true });
      } else {
        await authService.candidateLogin({
          email: formData.email,
          password: formData.password,
        });
        toast.success("Login successful");
        navigate("/candidate/dashboard", { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-br from-primary/10 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-4">
          <Link to="/" className="inline-flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-[#1f1d1b] flex items-center justify-center overflow-hidden">
              <img
                src={logo}
                alt="ICEF India"
                className="h-full w-full object-contain p-1.5"
              />
            </div>
            <div className="text-left">
              <div className="font-bold text-xl text-text-primary">
                Recruitment Portal
              </div>
              <div className="text-sm text-text-secondary">
                GOVERNMENT OF INDIA
              </div>
            </div>
          </Link>
        </div>

        <Card className="shadow-xl">
          <CardHeader className="text-center pb-3">
            <h1 className="text-2xl font-bold text-text-primary mb-1">
              Welcome Back
            </h1>
            <p className="text-sm text-text-secondary">
              Sign in to your account to continue
            </p>
          </CardHeader>

          <CardContent className="p-5">
            <form onSubmit={handleLogin} className="space-y-4">
              {/* User Type Selection */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Login As
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleInputChange("userType", "candidate")}
                    className={`p-2.5 rounded-lg border-2 transition-all ${
                      formData.userType === "candidate"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">👤</div>
                      <div className="font-medium text-sm">Candidate</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("userType", "admin")}
                    className={`p-2.5 rounded-lg border-2 transition-all ${
                      formData.userType === "admin"
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-text-secondary hover:border-primary/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-1">👨‍💼</div>
                      <div className="font-medium text-sm">Admin</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-5 h-5" />
                  <input
                    type="email"
                    required
                    className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-text-secondary w-5 h-5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full pl-10 pr-12 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) =>
                      handleInputChange("password", e.target.value)
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-text-primary"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="ml-2 text-sm text-text-secondary">
                    Remember me
                  </span>
                </label>
                <Link
                  to={
                    formData.userType === "admin"
                      ? "/auth/admin/forgot-password"
                      : "/auth/forgot-password"
                  }
                  className="text-sm text-primary hover:text-primary-dark"
                >
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Login Button */}
              <Button
                type="submit"
                className="w-full py-2.5 flex items-center justify-center space-x-2"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>

              <div className="p-3 bg-blue-50 rounded-lg">
                <div className="text-xs text-blue-700">
                  Candidate accounts use public login. Admin employees can also
                  use the dedicated admin login page.
                </div>
              </div>
            </form>

            {/* Register Link */}
            <div className="mt-4 text-center">
              <p className="text-sm text-text-secondary">
                Don't have an account?{" "}
                <Link
                  to="/auth/register"
                  className="text-primary hover:text-primary-dark font-medium"
                >
                  Create Account
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="text-center mt-4">
          <Link
            to="/"
            className="text-text-secondary hover:text-text-primary text-sm"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
