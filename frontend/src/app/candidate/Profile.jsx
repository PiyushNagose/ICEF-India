import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Clock,
  Shield,
  Edit3,
  Save,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Camera,
  Loader2,
  MapPin,
  BookOpen,
  Award,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { authService } from "../../services/auth.service";

// ── Helpers ───────────────────────────────────────────────────

const COMPLETION_FIELDS = [
  { key: "fullName", label: "Full Name" },
  { key: "dateOfBirth", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "category", label: "Category" },
  { key: "fatherName", label: "Father's Name" },
  { key: "registeredMobile", label: "Mobile Number" },
  { key: "isDomicileOfBihar", label: "Domicile Status" },
];

const calcCompletion = (user) => {
  if (!user) return 0;
  const filled = COMPLETION_FIELDS.filter(
    (f) => user[f.key] != null && user[f.key] !== "",
  ).length;
  return Math.round((filled / COMPLETION_FIELDS.length) * 100);
};

const inputCls =
  "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm disabled:bg-gray-50 disabled:text-gray-500";
const labelCls =
  "block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1";

const InfoTile = ({ icon: Icon, label, children }) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
      {Icon && <Icon className="w-3.5 h-3.5 text-orange-500" />}
      {label}
    </div>
    <div className="mt-2 text-sm font-medium text-gray-800 min-h-[22px]">
      {children || "Not provided"}
    </div>
  </div>
);

// ── Section: Personal Info ────────────────────────────────────

const PersonalSection = ({ user, onSave, isSaving }) => {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});

  useEffect(() => {
    setForm({
      fullName: user?.fullName || "",
      fatherName: user?.fatherName || "",
      motherName: user?.motherName || "",
      dateOfBirth: user?.dateOfBirth ? user.dateOfBirth.split("T")[0] : "",
      gender: user?.gender || "",
      category: user?.category || "",
      maritalStatus: user?.maritalStatus || "",
      religion: user?.religion || "",
      identificationMark: user?.identificationMark || "",
      registeredMobile: user?.registeredMobile || "",
      isDomicileOfBihar: user?.isDomicileOfBihar ?? null,
    });
  }, [user]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = () => {
    if (!form.fullName?.trim()) {
      toast.error("Full name is required");
      return;
    }
    if (form.registeredMobile && !/^[6-9]\d{9}$/.test(form.registeredMobile)) {
      toast.error("Invalid mobile number");
      return;
    }
    onSave(form, () => setEditing(false));
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-5 pb-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <User className="w-4 h-4 text-orange-600" />
            Personal Information
          </h3>
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="text-orange-600 border-orange-200"
            >
              <Edit3 className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(false)}
                className="text-gray-600"
              >
                <X className="w-3.5 h-3.5 mr-1.5" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1.5" />
                    Save
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              disabled={!editing}
              value={form.fullName || ""}
              onChange={(e) => set("fullName", e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div>
            <label className={labelCls}>Father's Name</label>
            <input
              className={inputCls}
              disabled={!editing}
              value={form.fatherName || ""}
              onChange={(e) => set("fatherName", e.target.value)}
              placeholder="Father's full name"
            />
          </div>
          <div>
            <label className={labelCls}>Mother's Name</label>
            <input
              className={inputCls}
              disabled={!editing}
              value={form.motherName || ""}
              onChange={(e) => set("motherName", e.target.value)}
              placeholder="Mother's full name"
            />
          </div>
          <div>
            <label className={labelCls}>Date of Birth</label>
            <input
              type="date"
              className={inputCls}
              disabled={!editing}
              value={form.dateOfBirth || ""}
              onChange={(e) => set("dateOfBirth", e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Gender</label>
            <select
              className={inputCls}
              disabled={!editing}
              value={form.gender || ""}
              onChange={(e) => set("gender", e.target.value)}
            >
              <option value="">Select</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Category</label>
            <select
              className={inputCls}
              disabled={!editing}
              value={form.category || ""}
              onChange={(e) => set("category", e.target.value)}
            >
              <option value="">Select</option>
              <option value="general">General</option>
              <option value="obc">OBC</option>
              <option value="sc">SC</option>
              <option value="st">ST</option>
              <option value="ews">EWS</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Marital Status</label>
            <select
              className={inputCls}
              disabled={!editing}
              value={form.maritalStatus || ""}
              onChange={(e) => set("maritalStatus", e.target.value)}
            >
              <option value="">Select</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Religion</label>
            <input
              className={inputCls}
              disabled={!editing}
              value={form.religion || ""}
              onChange={(e) => set("religion", e.target.value)}
              placeholder="e.g. Hindu"
            />
          </div>
          <div>
            <label className={labelCls}>Identification Mark</label>
            <input
              className={inputCls}
              disabled={!editing}
              value={form.identificationMark || ""}
              onChange={(e) => set("identificationMark", e.target.value)}
              placeholder="e.g. Mole on left cheek"
            />
          </div>
          <div>
            <label className={labelCls}>Mobile Number</label>
            <div className="flex">
              <span className="inline-flex items-center px-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-lg">
                +91
              </span>
              <input
                type="tel"
                maxLength={10}
                className={`flex-1 px-4 py-2.5 border border-gray-300 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm disabled:bg-gray-50`}
                disabled={!editing}
                value={form.registeredMobile || ""}
                onChange={(e) =>
                  set("registeredMobile", e.target.value.replace(/\D/g, ""))
                }
                placeholder="9876543210"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Bihar Domicile</label>
            {editing ? (
              <div className="flex gap-3 mt-1">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    onClick={() => set("isDomicileOfBihar", v)}
                    className={`px-5 py-2 rounded-lg text-sm border-2 transition-all ${form.isDomicileOfBihar === v ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-300 text-gray-600 hover:border-orange-300"}`}
                  >
                    {v ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-800 py-2.5">
                {form.isDomicileOfBihar === true
                  ? "Yes"
                  : form.isDomicileOfBihar === false
                    ? "No"
                    : "—"}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Section: Account Info (read-only) ─────────────────────────

const AccountSection = ({ user }) => (
  <Card className="overflow-hidden">
    <CardHeader className="p-5 pb-4 border-b border-gray-100">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
        <Shield className="w-4 h-4 text-orange-600" />
        Account Information
      </h3>
    </CardHeader>
    <CardContent className="p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div>
          <label className={labelCls}>Email Address</label>
          <div className="flex items-center gap-2">
            <input className={inputCls} disabled value={user?.email || ""} />
            {user?.isEmailVerified ? (
              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {user?.isEmailVerified ? "Email verified" : "Email not verified"}
          </p>
        </div>
        <div>
          <label className={labelCls}>Account Status</label>
          <div className="flex items-center gap-2 py-2.5">
            <Badge
              className={
                user?.isActive
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }
            >
              {user?.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
        <div>
          <label className={labelCls}>Member Since</label>
          <p className="text-sm text-gray-800 py-2.5">
            {user?.createdAt
              ? new Date(user.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
        <div>
          <label className={labelCls}>Last Updated</label>
          <p className="text-sm text-gray-800 py-2.5">
            {user?.updatedAt
              ? new Date(user.updatedAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Section: Change Password ──────────────────────────────────

const PasswordSection = () => {
  const [form, setForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [show, setShow] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [errors, setErrors] = useState({});

  const { mutate: changePassword, isPending } = useMutation({
    mutationFn: (data) => authService.changePassword(data),
    onSuccess: () => {
      toast.success("Password changed successfully");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setErrors({});
    },
    onError: (err) => toast.error(err.message || "Failed to change password"),
  });

  const validate = () => {
    const e = {};
    if (!form.currentPassword) e.currentPassword = "Required";
    if (!form.newPassword) e.newPassword = "Required";
    else if (form.newPassword.length < 8) e.newPassword = "Min 8 characters";
    else if (!/(?=.*[A-Z])(?=.*\d)/.test(form.newPassword))
      e.newPassword = "Must contain uppercase and number";
    if (!form.confirmPassword) e.confirmPassword = "Required";
    else if (form.newPassword !== form.confirmPassword)
      e.confirmPassword = "Passwords do not match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
  };

  const PasswordInput = ({ field, label, showKey }) => (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="relative">
        <input
          type={show[showKey] ? "text" : "password"}
          className={`${inputCls} pr-10 ${errors[field] ? "border-red-400" : ""}`}
          value={form[field]}
          onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
          placeholder="••••••••"
        />
        <button
          type="button"
          onClick={() => setShow((p) => ({ ...p, [showKey]: !p[showKey] }))}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show[showKey] ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
      {errors[field] && (
        <p className="text-red-500 text-xs mt-1">{errors[field]}</p>
      )}
    </div>
  );

  // Password strength
  const strength = (() => {
    const p = form.newPassword;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { label: "Weak", color: "bg-red-500", width: "25%" };
    if (score === 2)
      return { label: "Fair", color: "bg-yellow-500", width: "50%" };
    if (score === 3)
      return { label: "Good", color: "bg-blue-500", width: "75%" };
    return { label: "Strong", color: "bg-green-500", width: "100%" };
  })();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="p-5 pb-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-orange-600" />
          Change Password
        </h3>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,480px)_1fr] gap-6 items-stretch">
          <div className="space-y-4">
            <PasswordInput
              field="currentPassword"
              label="Current Password"
              showKey="current"
            />
            <div>
              <PasswordInput
              field="newPassword"
              label="New Password"
              showKey="new"
            />
              {strength && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Password strength</span>
                    <span
                      className={
                        strength.label === "Strong"
                          ? "text-green-600"
                          : strength.label === "Good"
                            ? "text-blue-600"
                            : "text-gray-500"
                      }
                    >
                      {strength.label}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${strength.color}`}
                      style={{ width: strength.width }}
                    />
                  </div>
                </div>
              )}
            </div>
            <PasswordInput
              field="confirmPassword"
              label="Confirm New Password"
              showKey="confirm"
            />
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white w-full"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                "Change Password"
              )}
            </Button>
          </div>
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-xs text-gray-500 space-y-2">
            <p className="font-medium text-gray-600">Password requirements:</p>
            {[
              ["At least 8 characters", form.newPassword.length >= 8],
              ["One uppercase letter", /[A-Z]/.test(form.newPassword)],
              ["One number", /\d/.test(form.newPassword)],
            ].map(([text, met]) => (
              <div
                key={text}
                className={`flex items-center gap-1.5 ${met ? "text-green-600" : "text-gray-400"}`}
              >
                <CheckCircle className="w-3 h-3" />
                <span>{text}</span>
              </div>
            ))}
            <p className="pt-2 leading-5 text-gray-500">
              Use a unique password that you do not use on other services.
              Password changes take effect immediately after saving.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Main Profile Page ─────────────────────────────────────────

const Profile = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-profile"],
    queryFn: authService.me,
    staleTime: 60000,
  });

  const user = data?.user || data;

  const { mutate: saveProfile, isPending: isSaving } = useMutation({
    mutationFn: (updates) => authService.updateProfile(updates),
    onSuccess: (updatedUser) => {
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: ["candidate-profile"] });
    },
    onError: (err) => toast.error(err.message || "Failed to update profile"),
  });

  const handleSave = (updates, onDone) => {
    saveProfile(updates, { onSuccess: onDone });
  };

  const completion = calcCompletion(user);
  const missingFields = COMPLETION_FIELDS.filter(
    (f) => !user?.[f.key] && user?.[f.key] !== false,
  );

  if (isLoading)
    return (
      <CandidateLayout title="My Profile">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <span className="ml-3 text-gray-600">Loading profile...</span>
        </div>
      </CandidateLayout>
    );

  return (
    <CandidateLayout title="My Profile">
      <div className="space-y-6">
        {/* Profile Header Card */}
        <Card className="bg-gradient-to-r from-orange-600 to-orange-700 text-white border-0">
          <CardContent className="p-6">
            <div className="flex items-center gap-5">
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center text-3xl font-bold text-white border-4 border-white/30">
                  {user?.fullName
                    ? user.fullName
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                    : user?.email?.[0]?.toUpperCase() || "C"}
                </div>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold truncate text-white">
                  {user?.fullName || "Complete your profile"}
                </h2>
                <p className="text-white/90 text-sm mt-0.5">{user?.email}</p>
                <div className="flex flex-wrap items-center gap-3 mt-2">
                  {user?.category && (
                    <Badge className="bg-white/20 text-white border-0 text-xs uppercase">
                      {user.category}
                    </Badge>
                  )}
                  {user?.gender && (
                    <Badge className="bg-white/20 text-white border-0 text-xs capitalize">
                      {user.gender}
                    </Badge>
                  )}
                  {user?.registeredMobile && (
                    <span className="text-white/90 text-xs flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      +91 {user.registeredMobile}
                    </span>
                  )}
                </div>
              </div>

              {/* Completion */}
              <div className="hidden sm:block text-right flex-shrink-0">
                <div className="text-3xl font-bold text-white">{completion}%</div>
                <div className="text-white/90 text-xs mt-0.5">
                  Profile Complete
                </div>
                <div className="w-24 bg-white/20 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-white h-1.5 rounded-full transition-all"
                    style={{ width: `${completion}%` }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Completion Warning */}
        {completion < 100 && missingFields.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-orange-800">
                    Complete your profile to improve application success
                  </p>
                  <p className="text-xs text-orange-700 mt-1">
                    Missing: {missingFields.map((f) => f.label).join(", ")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sections */}
        <PersonalSection user={user} onSave={handleSave} isSaving={isSaving} />
        <AccountSection user={user} />
        <PasswordSection />
      </div>
    </CandidateLayout>
  );
};

export default Profile;
