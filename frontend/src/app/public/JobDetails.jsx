import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  FileBadge,
  FileText,
  GraduationCap,
  IndianRupee,
  ListChecks,
  MapPin,
  PlayCircle,
  Users,
  Dumbbell,
  ClipboardList,
  CalendarDays,
  FolderOpen,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import Button from "../../components/ui/Button";
import { jobService } from "../../services/job.service";
import { candidateService } from "../../services/candidate.service";
import { useAuth, isCandidateUser } from "../../hooks/useAuth";
import { publicContainer } from "./PublicPageShell";
import {
  getApplicationAction,
  getJobAvailability,
} from "../../utils/jobAvailability";

/* ─────────────────────────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const daysLeft = (deadline) => {
  if (!deadline) return null;
  const today = new Date();
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const endDate = new Date(deadline);
  const end = new Date(
    endDate.getFullYear(),
    endDate.getMonth(),
    endDate.getDate(),
  );
  return Math.max(0, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not announced";

const getPublicApplyPath = (job) => {
  const slug = job?.projectId?.publicSlug;
  return slug ? `/apply/${slug}/start?jobId=${job._id}` : "/check-status";
};

const persistPublicApplyContext = ({ job, applicationId }) => {
  const project = job?.projectId || {};
  sessionStorage.setItem(
    "publicApplyContext",
    JSON.stringify({
      projectId: project._id,
      projectSlug: project.publicSlug,
      projectName: project.name,
      jobId: job?._id,
      jobTitle: job?.title,
      applicationId,
    }),
  );
};

const getEducationItems = (education = {}) => {
  if (Array.isArray(education.essential)) return education.essential;
  if (education.essential?.degree) return [education.essential];
  if (education.minimumQualification) {
    return [{ degree: education.minimumQualification }];
  }
  return [];
};

const isBuiltInFormSection = (title = "") =>
  [
    "personal details",
    "personal information",
    "educational info",
    "educational information",
    "additional information",
    "address details",
  ].includes(String(title).trim().toLowerCase());

const getFeeValue = (fee) => {
  if (fee === undefined || fee === null) return "Not set";
  return Number(fee) === 0 ? "Free" : `₹${Number(fee).toLocaleString("en-IN")}`;
};

/* ─────────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────────── */
const SectionHeader = ({ icon: Icon, title }) => (
  <div className="mb-5 flex items-center gap-3 border-b border-[#f0e8e0] pb-4">
    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
      <Icon className="h-4 w-4 text-orange-600" />
    </div>
    <h3 className="text-[16px] font-black text-[#1f1d1b]">{title}</h3>
  </div>
);

/* ─────────────────────────────────────────────────────────────
   CONTENT CARD (animated)
───────────────────────────────────────────────────────────── */
const ContentCard = ({ children, className = "" }) => (
  <motion.div
    variants={fadeUp}
    initial="hidden"
    whileInView="visible"
    viewport={{ once: true, amount: 0.08 }}
    className={`rounded-2xl border border-[#e0d7cd] bg-white p-6 shadow-sm ${className}`}
  >
    {children}
  </motion.div>
);

/* ─────────────────────────────────────────────────────────────
   CRITERIA TABLE
───────────────────────────────────────────────────────────── */
const CriteriaTable = ({ criteria = [] }) => {
  const visible = criteria.filter(
    (item) =>
      item?.label ||
      item?.male ||
      item?.female ||
      item?.value ||
      item?.unit ||
      item?.notes,
  );
  if (!visible.length) return null;
  return (
    <div className="overflow-hidden rounded-xl border border-[#e0d7cd]">
      <div className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] bg-[#faf7f2] px-4 py-2.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
        <span>Criteria</span>
        <span>Male</span>
        <span>Female</span>
        <span>Common</span>
      </div>
      {visible.map((item, i) => (
        <div
          key={`${item.label}-${i}`}
          className="grid grid-cols-[1.2fr_0.9fr_0.9fr_0.9fr] gap-3 border-t border-[#e0d7cd] px-4 py-3 text-[13px] text-[#4b4744]"
        >
          <div>
            <p className="font-black text-[#1f1d1b]">
              {item.label || "Requirement"}
            </p>
            {item.notes && (
              <p className="mt-1 text-xs leading-5 text-[#9a8f86]">
                {item.notes}
              </p>
            )}
          </div>
          <span>{item.male || "-"}</span>
          <span>{item.female || "-"}</span>
          <span>
            {[item.value, item.unit].filter(Boolean).join(" ") || "-"}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   APPLY SIDEBAR — all 4 states
───────────────────────────────────────────────────────────── */
const ApplySidebar = ({ job, isLoggedIn, isCandidate, existingApp }) => {
  const navigate = useNavigate();
  const days = daysLeft(job.applicationDeadline);
  const availability = getJobAvailability(job);
  const isClosed = !availability.canApply;
  const fee = job.applicationFee?.general ?? job.applicationFee?.amount ?? 0;

  /* ── State 1: Already applied ─────────────────────────── */
  if (existingApp) {
    const isDraft = existingApp.status === "draft";
    const stepProgress = Math.round(((existingApp.currentStep || 1) / 9) * 100);
    const action = getApplicationAction(job, existingApp);

    const handleResume = () => {
      if (!action.canClick) return;
      if (isDraft) {
        persistPublicApplyContext({ job, applicationId: existingApp._id });
        const applyPath = getPublicApplyPath(job);
        navigate(`${applyPath}${applyPath.includes("?") ? "&" : "?"}resume=1`);
      } else {
        navigate("/check-status", {
          state: { applicationId: existingApp._id },
        });
      }
    };

    return (
      <div className="overflow-hidden rounded-2xl border border-[#e0d7cd] bg-white shadow-sm">
        <div
          className={`px-6 py-5 ${isDraft ? "bg-gradient-to-r from-[#e46a1d] to-[#d85a0d]" : "bg-gradient-to-r from-emerald-600 to-emerald-500"}`}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
            {isDraft ? "In Progress" : "Submitted"}
          </p>
          <h3 className="mt-1 text-[18px] font-black text-white">
            {isDraft ? "Application In Progress" : "Application Submitted"}
          </h3>
        </div>
        <div className="space-y-4 p-5">
          {isDraft ? (
            <>
              <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                <p className="text-[13px] font-black text-orange-800">
                  Draft — Not Submitted
                </p>
                <p className="mt-1 text-xs text-orange-700">
                  Step {existingApp.currentStep || 1} of 9 completed
                </p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-orange-200">
                  <div
                    className="h-1.5 rounded-full bg-orange-600 transition-all"
                    style={{ width: `${stepProgress}%` }}
                  />
                </div>
              </div>
              <Button
                onClick={handleResume}
                disabled={!action.canClick}
                className="h-11 w-full bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] text-[13px] font-black uppercase tracking-[0.12em] text-white hover:from-[#d85a0d] hover:to-[#c44e07] disabled:bg-gray-200 disabled:text-gray-400"
              >
                <PlayCircle className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <div>
                  <p className="text-[13px] font-black text-emerald-800">
                    Application Submitted
                  </p>
                  {existingApp.applicationId && (
                    <p className="mt-0.5 font-mono text-xs text-emerald-700">
                      {existingApp.applicationId}
                    </p>
                  )}
                </div>
              </div>
              <Button
                onClick={handleResume}
                className="h-11 w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-[13px] font-black uppercase tracking-[0.12em] text-white hover:from-emerald-700 hover:to-emerald-600"
              >
                <Eye className="mr-2 h-4 w-4" />
                {action.label}
              </Button>
            </>
          )}
          <button
            onClick={() => navigate("/check-status")}
            className="w-full text-center text-xs font-semibold text-[#9a8f86] transition-colors hover:text-[#e46a1d]"
          >
            View Application Status →
          </button>
        </div>
      </div>
    );
  }

  /* ── State 2: Not logged in ───────────────────────────── */
  if (!isLoggedIn) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#e0d7cd] bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
            {availability.canApply ? "Online Application" : "Application Status"}
          </p>
          <h3 className="mt-1 text-[18px] font-black text-white">
            {availability.canApply ? "Apply for this Job" : "This job is closed"}
          </h3>
        </div>
        <div className="space-y-4 p-5">
          {availability.canApply ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[13px] font-black text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Applications Open
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-3 text-[13px] font-black text-[#6d6761]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {availability.label}
            </div>
          )}
          {!availability.canApply && (
            <p className="rounded-xl border border-[#e0d7cd] bg-white p-3 text-xs leading-5 text-[#6d6761]">
              {availability.reason} You can view the notification details or
              return to the recruitment page for other active posts.
            </p>
          )}
          {fee > 0 && (
            <div className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4 text-center">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                Application Fee
              </p>
              <p className="mt-1.5 text-[28px] font-black leading-none text-[#e46a1d]">
                ₹{fee.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-[11px] text-[#9a8f86]">Non-refundable</p>
            </div>
          )}
          <Link
            to={getPublicApplyPath(job)}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-black uppercase tracking-[0.12em] transition-all ${
              isClosed
                ? "cursor-not-allowed bg-[#f0ebe5] text-[#9a8f86] pointer-events-none"
                : "bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/40"
            }`}
          >
            {availability.canApply ? "Verify & Apply" : availability.label}
            {availability.canApply && <ChevronRight className="h-4 w-4" />}
          </Link>
          <p className="text-center text-xs leading-5 text-[#9a8f86]">
            Email and mobile OTP verification required before starting.
          </p>
        </div>
      </div>
    );
  }

  /* ── State 3: Admin viewing ───────────────────────────── */
  if (!isCandidate) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[#e0d7cd] bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#4b5563] to-[#374151] px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/60">
            Preview Mode
          </p>
          <h3 className="mt-1 text-[18px] font-black text-white">Admin View</h3>
        </div>
        <div className="p-5">
          <p className="text-center text-[13px] text-[#6d6761]">
            Admins cannot apply for jobs. Switch to a candidate account to test
            the flow.
          </p>
        </div>
      </div>
    );
  }

  /* ── State 4: Logged-in candidate, not yet applied ────── */
  const handleStart = () => {
    persistPublicApplyContext({ job });
    navigate(getPublicApplyPath(job));
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#e0d7cd] bg-white shadow-sm">
      <div className="bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] px-6 py-5">
        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/70">
          {availability.canApply ? "Online Application" : "Application Status"}
        </p>
        <h3 className="mt-1 text-[18px] font-black text-white">
          {availability.canApply ? "Apply for this Job" : "This job is closed"}
        </h3>
      </div>
      <div className="space-y-4 p-5">
        {availability.canApply ? (
          <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <span className="flex items-center gap-2 text-[13px] font-black text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Applications Open
            </span>
            {days !== null && days <= 7 && days > 0 && (
              <span className="rounded-lg bg-red-100 px-2 py-0.5 text-[11px] font-black text-red-700">
                {days}d left!
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-3 text-[13px] font-black text-[#6d6761]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {availability.label}
          </div>
        )}
        {!availability.canApply && (
          <p className="rounded-xl border border-[#e0d7cd] bg-white p-3 text-xs leading-5 text-[#6d6761]">
            {availability.reason} You can view the notification details or
            return to the recruitment page for other active posts.
          </p>
        )}
        {fee > 0 && (
          <div className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4 text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
              Application Fee
            </p>
            <p className="mt-1.5 text-[28px] font-black leading-none text-[#e46a1d]">
              ₹{fee.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-[#9a8f86]">Non-refundable</p>
          </div>
        )}
        <Button
          onClick={handleStart}
          disabled={!availability.canApply}
          className="h-11 w-full bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] text-[13px] font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-orange-500/25 hover:from-[#d85a0d] hover:to-[#c44e07] hover:shadow-xl hover:shadow-orange-500/40 disabled:bg-[#f0ebe5] disabled:text-[#9a8f86] disabled:shadow-none disabled:from-[#f0ebe5] disabled:to-[#f0ebe5]"
        >
          {!availability.canApply ? availability.label : "Apply Now"}
        </Button>
        <p className="text-center text-xs leading-5 text-[#9a8f86]">
          Ensure your profile is complete before applying.
        </p>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
const JobDetails = () => {
  const { id, slug } = useParams();
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isLoggedIn = !!(token && user);
  const isCandidate = isLoggedIn && isCandidateUser(user);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-job", id],
    queryFn: () => jobService.getPublicJob(id),
    enabled: Boolean(id),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const { data: myAppsData } = useQuery({
    queryKey: ["candidate-applications-ids"],
    queryFn: () => candidateService.getMyApplications({ limit: 200 }),
    enabled: isCandidate,
    staleTime: 30000,
  });

  const job = data?.job || data;
  const projectSlug = slug || job?.projectId?.publicSlug;
  const projectPath = projectSlug ? `/apply/${projectSlug}` : "/check-status";

  useEffect(() => {
    if (!job?.projectId?.publicSlug) return;
    window.sessionStorage.setItem("lastPublicProjectSlug", job.projectId.publicSlug);
    if (!slug && window.location.pathname.startsWith("/jobs/")) {
      navigate(`/apply/${job.projectId.publicSlug}/jobs/${id}`, { replace: true });
    }
  }, [id, job?.projectId?.publicSlug, navigate, slug]);

  const myApps = Array.isArray(myAppsData)
    ? myAppsData
    : myAppsData?.applications || myAppsData?.data || [];
  const existingApp = myApps.find((a) => (a.jobId?._id || a.jobId) === id);

  const days = daysLeft(job?.applicationDeadline);
  const availability = job ? getJobAvailability(job) : null;
  const isOpen = availability?.status === "open";

  /* ── Loading skeleton ──────────────────────────────────── */
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-[#f5efe9]">
          {/* Dark hero skeleton */}
          <div className="animate-pulse bg-[#1f1d1b] px-6 py-14">
            <div className={publicContainer}>
              <div className="mb-6 h-4 w-48 rounded-lg bg-white/10" />
              <div className="mb-3 h-5 w-40 rounded-lg bg-white/10" />
              <div className="mb-2 h-10 w-2/3 rounded-xl bg-white/15" />
              <div className="mb-8 h-5 w-64 rounded-lg bg-white/10" />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[1, 2, 3, 4].map((k) => (
                  <div key={k} className="h-28 rounded-2xl bg-white/10" />
                ))}
              </div>
            </div>
          </div>
          {/* Content skeleton */}
          <div className={`${publicContainer} py-8`}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="space-y-5">
                <div className="h-48 animate-pulse rounded-2xl bg-white" />
                <div className="h-64 animate-pulse rounded-2xl bg-white" />
                <div className="h-32 animate-pulse rounded-2xl bg-white" />
              </div>
              <div className="space-y-5">
                <div className="h-64 animate-pulse rounded-2xl bg-white" />
                <div className="h-40 animate-pulse rounded-2xl bg-white" />
              </div>
            </div>
          </div>
        </div>
      </PublicLayout>
    );
  }

  /* ── Error state ──────────────────────────────────────── */
  if (error && !isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-[calc(100vh-122px)] items-center justify-center bg-[#f5efe9] p-6">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-10 text-center shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="mt-6 text-2xl font-black text-[#1f1d1b]">
              Unable to Load Job
            </h1>
            <p className="mt-3 text-[13px] leading-6 text-[#6d6761]">
              {error.message ||
                "The job details could not be loaded. Please try again."}
            </p>
            <Link
              to={projectPath}
              className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-[#e46a1d] px-6 text-[13px] font-black uppercase tracking-[0.12em] text-white hover:bg-[#d85a0d]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Recruitment
            </Link>
          </motion.div>
        </div>
      </PublicLayout>
    );
  }

  if (!job && !isLoading) return null;

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9]">
        {/* ── TOP BAR: breadcrumb + status ── */}
        <div className="border-b border-[#e0d7cd] bg-white">
          <div
            className={`${publicContainer} flex flex-wrap items-center justify-between gap-3 py-3.5`}
          >
            <div className="flex items-center gap-2 text-[13px]">
              <Link
                to={projectPath}
                className="flex items-center gap-1.5 font-bold text-[#6d6761] transition-colors hover:text-[#e46a1d]"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {job?.projectId?.name || "Recruitment"}
              </Link>
              <ChevronRight className="h-3 w-3 text-[#c7bdb3]" />
              <span
                className="max-w-[240px] truncate font-semibold text-[#1f1d1b]"
                title={job?.title}
              >
                {job?.title}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] ${isOpen ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isOpen ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`}
                />
                {availability?.label || job?.status || "Active"}
              </span>
              {days !== null && days <= 7 && days > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                  <Clock className="h-3 w-3" />
                  {days}d left
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── PAGE HEADER ── */}
        <section className="bg-[#201d1a] text-white shadow-sm">
          <div className={`${publicContainer} py-8 lg:py-10`}>
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="min-w-0 flex-1">
                  {/* Label row */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-500/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-orange-300 ring-1 ring-orange-300/20">
                      <Briefcase className="h-3 w-3" />
                      {job?.department}
                    </span>
                    {job?.postCode && (
                      <span className="rounded-md border border-white/15 bg-white/10 px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.14em] text-white/85">
                        #{job.postCode}
                      </span>
                    )}
                  </div>
                  {/* Title */}
                  <h1 className="mt-3 text-[32px] sm:text-[40px] lg:text-[48px] font-black leading-[1.12] text-white break-words">
                    {job?.title}
                  </h1>
                  {/* Meta row */}
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] font-semibold text-white/75">
                    {(job?.workLocation || job?.projectId?.state) && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-orange-300" />
                        {job.workLocation || job.projectId?.state}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-orange-300" />
                      {(job?.totalPosts || 0).toLocaleString("en-IN")} vacancies
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-orange-300" />
                      Apply by {formatDate(job?.applicationDeadline)}
                    </span>
                  </div>
                </div>

                {/* Right — quick stat boxes */}
                <div className="flex shrink-0 flex-wrap items-stretch gap-3">
                  <div className="flex min-w-[120px] flex-col justify-between rounded-[8px] border border-white/15 bg-white/10 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
                      Vacancies
                    </p>
                    <p className="mt-2 text-[26px] font-black leading-none text-white">
                      {(job?.totalPosts || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div
                    className="flex min-w-[136px] flex-col justify-between rounded-[8px] border border-white/15 bg-white/10 px-5 py-4"
                  >
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
                      Fee (General)
                    </p>
                    <p className="mt-2 text-[26px] font-black leading-none text-orange-300">
                      {(job?.applicationFee?.general ??
                        job?.applicationFee?.amount ??
                        0) === 0
                        ? "Free"
                        : `₹${(job?.applicationFee?.general ?? job?.applicationFee?.amount ?? 0).toLocaleString("en-IN")}`}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── MAIN CONTENT ── */}
        <div className={`${publicContainer} py-8`}>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,320px)] lg:items-start">
            {/* ── LEFT COLUMN ── */}
            <div className="space-y-5 min-w-0">
              {/* Description */}
              {job?.description && (
                <ContentCard>
                  <SectionHeader icon={FileText} title="Job Description" />
                  <p className="text-[14px] leading-[26px] text-[#5f5752] font-medium whitespace-pre-line">
                    {job.description}
                  </p>
                </ContentCard>
              )}

              {/* Posts / Vacancies */}
              {job?.posts?.length > 0 && (
                <ContentCard>
                  <SectionHeader icon={Users} title="Posts / Vacancies" />

                  <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50 px-4 py-3 text-[13px] text-orange-800">
                    <span className="font-black">Candidate selection:</span>{" "}
                    {job.postSelectionMode === "preference"
                      ? "Multiple posts with preference ordering"
                      : "Single post only"}
                  </div>

                  <div className="space-y-3">
                    {job.posts.map((post) => (
                      <div
                        key={post._id || `${post.postCode}-${post.title}`}
                        className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h4
                              className="text-[15px] font-black text-[#1f1d1b] break-words line-clamp-2"
                              title={post.title}
                            >
                              {post.title}
                            </h4>
                            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#9a8f86]">
                              {[
                                post.postCode,
                                post.designation,
                                post.department,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <span className="rounded-lg bg-orange-100 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-orange-700">
                            {(post.vacancies || 0).toLocaleString("en-IN")}{" "}
                            vacancies
                          </span>
                        </div>
                        <div className="mt-3 grid gap-2 text-[13px] text-[#6d6761] sm:grid-cols-3">
                          <span>
                            <b className="font-black text-[#1f1d1b]">Pay:</b>{" "}
                            {post.payLevel || "Not specified"}
                          </span>
                          <span>
                            <b className="font-black text-[#1f1d1b]">
                              Location:
                            </b>{" "}
                            {post.location ||
                              job.workLocation ||
                              "Not specified"}
                          </span>
                          <span>
                            <b className="font-black text-[#1f1d1b]">Status:</b>{" "}
                            {post.status || "Active"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Reservation breakdown */}
                  {job.reservedPosts && (
                    <div className="mt-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                        Reservation Breakdown
                      </p>
                      <div className="grid grid-cols-5 gap-2">
                        {[
                          ["SC", job.reservedPosts.sc],
                          ["ST", job.reservedPosts.st],
                          ["OBC", job.reservedPosts.obc],
                          ["EWS", job.reservedPosts.ews],
                          ["PwD", job.reservedPosts.pwd],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-xl border border-[#e0d7cd] bg-white px-3 py-3 text-center"
                          >
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                              {label}
                            </p>
                            <p className="mt-1.5 text-[22px] font-black leading-none text-[#1f1d1b]">
                              {value ?? 0}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </ContentCard>
              )}

              {/* Eligibility & Qualifications */}
              <ContentCard>
                <SectionHeader
                  icon={GraduationCap}
                  title="Eligibility & Qualifications"
                />
                <div className="space-y-5">
                  {/* Category */}
                  {job?.category && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                        Category
                      </p>
                      <p className="text-[13px] font-semibold text-[#1f1d1b]">
                        {job.category}
                      </p>
                    </div>
                  )}

                  {/* Salary */}
                  {(job?.salaryRange?.min || job?.salaryRange?.max) && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                        Salary Range
                      </p>
                      <p className="text-[13px] font-semibold text-[#1f1d1b]">
                        ₹{job.salaryRange?.min?.toLocaleString("en-IN")} – ₹
                        {job.salaryRange?.max?.toLocaleString("en-IN")} per
                        month
                      </p>
                    </div>
                  )}

                  {/* Education */}
                  {getEducationItems(job?.education || {}).length > 0 && (
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                        Education
                      </p>
                      <div className="space-y-2">
                        {getEducationItems(job.education).map((item, i) => (
                          <div
                            key={`${item.degree || "edu"}-${i}`}
                            className="flex items-start gap-2 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] px-4 py-3 text-[13px] text-[#1f1d1b]"
                          >
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                            <span className="font-semibold">
                              {[
                                item.degree,
                                item.specialization,
                                item.university,
                              ]
                                .filter(Boolean)
                                .join(" — ")}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Age limit */}
                  {job?.ageLimit && (
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                        Age Limit
                      </p>
                      <p className="text-[13px] font-semibold text-[#1f1d1b]">
                        {job.ageLimit.min ?? "-"} – {job.ageLimit.max ?? "-"}{" "}
                        years
                      </p>
                      {job.ageLimit.relaxation && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {[
                            ["SC", job.ageLimit.relaxation.sc],
                            ["ST", job.ageLimit.relaxation.st],
                            ["OBC", job.ageLimit.relaxation.obc],
                            ["PwD", job.ageLimit.relaxation.pwd],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] px-3 py-3 text-center"
                            >
                              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                                {label}
                              </p>
                              <p className="mt-1.5 text-[18px] font-black leading-none text-[#1f1d1b]">
                                +{value ?? 0}
                              </p>
                              <p className="mt-1 text-[10px] font-semibold text-[#9a8f86]">
                                yrs
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </ContentCard>

              {/* Application Fee */}
              {job?.applicationFee && (
                <ContentCard>
                  <SectionHeader icon={IndianRupee} title="Application Fee" />
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                    {[
                      ["General", job.applicationFee.general],
                      ["OBC", job.applicationFee.obc],
                      [
                        "SC / ST",
                        job.applicationFee.scSt ?? job.applicationFee.scst,
                      ],
                      ["EWS", job.applicationFee.ews],
                      ["PwD", job.applicationFee.pwd],
                    ].map(([cat, feeVal]) => {
                      const display = getFeeValue(feeVal);
                      const isFree = display === "Free";
                      return (
                        <div
                          key={cat}
                          className={`flex flex-col items-center rounded-xl border px-3 py-4 ${
                            isFree
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-[#e0d7cd] bg-[#faf7f2]"
                          }`}
                        >
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                            {cat}
                          </p>
                          <p
                            className={`mt-2 text-[18px] font-black leading-none ${isFree ? "text-emerald-600" : "text-[#e46a1d]"}`}
                          >
                            {display}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {job.applicationFee.note && (
                    <p className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] leading-6 text-amber-800">
                      {job.applicationFee.note}
                    </p>
                  )}
                </ContentCard>
              )}

              {/* Experience & Other Requirements */}
              {(job?.experience?.required ||
                job?.otherRequirements?.length > 0) && (
                <ContentCard>
                  <SectionHeader
                    icon={Briefcase}
                    title="Experience & Other Requirements"
                  />
                  <div className="space-y-3">
                    {job.experience?.required && (
                      <div className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4">
                        <p className="text-[15px] font-black text-[#1f1d1b]">
                          {job.experience.years || 0} year
                          {Number(job.experience.years) === 1 ? "" : "s"}{" "}
                          experience required
                        </p>
                        {(job.experience.type ||
                          job.experience.description) && (
                          <p className="mt-1 text-[13px] leading-6 text-[#6d6761]">
                            {[job.experience.type, job.experience.description]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                    {job.otherRequirements?.map((item, i) => (
                      <div
                        key={`req-${i}`}
                        className="flex items-start gap-3 text-[13px] leading-6 text-[#6d6761]"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </ContentCard>
              )}

              {/* Physical & Medical Standards */}
              {(job?.physicalStandards?.required ||
                job?.medicalStandards?.required) && (
                <ContentCard>
                  <SectionHeader
                    icon={Dumbbell}
                    title="Physical & Medical Standards"
                  />
                  <div className="space-y-6">
                    {job.physicalStandards?.required && (
                      <div>
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                          Physical Standards
                        </p>
                        <CriteriaTable
                          criteria={job.physicalStandards.criteria}
                        />
                      </div>
                    )}
                    {job.medicalStandards?.required && (
                      <div>
                        <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                          Medical Standards
                        </p>
                        <CriteriaTable
                          criteria={job.medicalStandards.criteria}
                        />
                        {(job.medicalStandards.vision ||
                          job.medicalStandards.hearing ||
                          job.medicalStandards.other) && (
                          <div className="mt-4 space-y-2 text-[13px]">
                            {job.medicalStandards.vision && (
                              <p className="text-[#6d6761]">
                                <span className="font-black text-[#1f1d1b]">
                                  Vision:{" "}
                                </span>
                                {job.medicalStandards.vision}
                              </p>
                            )}
                            {job.medicalStandards.hearing && (
                              <p className="text-[#6d6761]">
                                <span className="font-black text-[#1f1d1b]">
                                  Hearing:{" "}
                                </span>
                                {job.medicalStandards.hearing}
                              </p>
                            )}
                            {job.medicalStandards.other && (
                              <p className="text-[#6d6761]">
                                <span className="font-black text-[#1f1d1b]">
                                  Other:{" "}
                                </span>
                                {job.medicalStandards.other}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </ContentCard>
              )}

              {/* Selection Process */}
              {job?.selectionProcess?.length > 0 && (
                <ContentCard>
                  <SectionHeader icon={ListChecks} title="Selection Process" />
                  <div className="space-y-3">
                    {job.selectionProcess.map((step, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[13px] font-black text-orange-700">
                          {i + 1}
                        </span>
                        <span className="pt-1 text-[13px] leading-6 text-[#6d6761]">
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </ContentCard>
              )}

              {/* Important Dates */}
              {(job?.applicationStartDate ||
                job?.applicationDeadline ||
                job?.examDate ||
                job?.resultDate) && (
                <ContentCard>
                  <SectionHeader icon={CalendarDays} title="Important Dates" />
                  <div className="divide-y divide-[#f0e8e0]">
                    {[
                      ["Application Start", job.applicationStartDate, false],
                      ["Application Deadline", job.applicationDeadline, true],
                      [
                        "Payment Deadline",
                        job.paymentConfig?.paymentDeadline,
                        false,
                      ],
                      [
                        "Correction Window Start",
                        job.correctionStartDate,
                        false,
                      ],
                      ["Correction Deadline", job.correctionDeadline, false],
                      ["Admit Card Release", job.admitCardReleaseDate, false],
                      ["Exam Date", job.examDate, false],
                      ["Result Date", job.resultDate, false],
                    ]
                      .filter(([, d]) => d)
                      .map(([label, date, highlight]) => (
                        <div
                          key={label}
                          className={`flex items-center justify-between py-3.5 ${highlight ? "mx-[-1.5rem] px-6 bg-orange-50" : ""}`}
                        >
                          <span
                            className={`text-[13px] ${highlight ? "font-black text-orange-800" : "font-semibold text-[#6d6761]"}`}
                          >
                            {label}
                            {highlight && (
                              <span className="ml-2 rounded-md bg-orange-200 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.1em] text-orange-800">
                                Important
                              </span>
                            )}
                          </span>
                          <span
                            className={`text-[13px] font-black ${highlight ? "text-orange-700" : "text-[#1f1d1b]"}`}
                          >
                            {formatDate(date)}
                          </span>
                        </div>
                      ))}
                  </div>
                </ContentCard>
              )}

              {/* Application Form Requirements */}
              {job?.formSections?.some(
                (s) => s.fields?.length && !isBuiltInFormSection(s.title),
              ) && (
                <ContentCard>
                  <SectionHeader
                    icon={ClipboardList}
                    title="Application Form Requirements"
                  />
                  <div className="space-y-3">
                    {job.formSections
                      .filter(
                        (s) =>
                          s.fields?.length && !isBuiltInFormSection(s.title),
                      )
                      .map((section) => (
                        <div
                          key={section._id || section.title}
                          className="rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-[13px] font-black text-[#1f1d1b]">
                              {section.title}
                            </h4>
                            {section.required && (
                              <span className="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
                                Required
                              </span>
                            )}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {section.fields.map((field) => (
                              <span
                                key={field._id || field.label}
                                className="rounded-lg border border-[#e0d7cd] bg-white px-3 py-1 text-xs font-semibold text-[#6d6761]"
                              >
                                {field.label}
                                {field.required ? " *" : ""}
                                <span className="text-[#9a8f86]">
                                  {" "}
                                  · {field.type}
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ContentCard>
              )}

              {/* Documents Required */}
              <ContentCard>
                <SectionHeader icon={FolderOpen} title="Documents Required" />
                <div className="space-y-3">
                  {(job?.documentRequirements?.length
                    ? job.documentRequirements
                    : job?.requiredDocuments?.length
                      ? job.requiredDocuments
                      : [
                          "Passport Photo",
                          "Signature",
                          "Educational Certificates",
                          "Identity Proof (Aadhaar / PAN)",
                          "Category Certificate (if applicable)",
                        ]
                  ).map((doc) => (
                    <div
                      key={
                        typeof doc === "string"
                          ? doc
                          : doc._id || doc.name || doc.type
                      }
                      className="flex items-start gap-3 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4"
                    >
                      <FileBadge className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-black text-[#1f1d1b]">
                            {typeof doc === "string"
                              ? doc
                              : doc.name || doc.label || doc.type}
                          </span>
                          {typeof doc !== "string" && (
                            <span
                              className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] ${
                                doc.required
                                  ? "bg-red-50 text-red-700"
                                  : "bg-[#f0ebe5] text-[#9a8f86]"
                              }`}
                            >
                              {doc.required ? "Required" : "Optional"}
                            </span>
                          )}
                        </div>
                        {typeof doc !== "string" && doc.description && (
                          <p className="mt-1 text-[13px] leading-5 text-[#6d6761]">
                            {doc.description}
                          </p>
                        )}
                        {typeof doc !== "string" &&
                          (doc.formats?.length || doc.maxSizeKB) && (
                            <p className="mt-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-[#9a8f86]">
                              {(doc.formats || []).join(", ")}
                              {doc.maxSizeKB
                                ? ` · Max ${doc.maxSizeKB} KB`
                                : ""}
                            </p>
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              </ContentCard>
            </div>

            {/* ─── RIGHT SIDEBAR ───────────────────────────── */}
            <aside
              id="apply-sidebar"
              className="space-y-5 lg:self-start"
            >
              {/* Apply box */}
              <ApplySidebar
                job={job}
                isLoggedIn={isLoggedIn}
                isCandidate={isCandidate}
                existingApp={existingApp}
              />

              {/* Quick Info */}
              <div className="rounded-2xl border border-[#e0d7cd] bg-white p-5 shadow-sm">
                <p className="mb-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                  Quick Info
                </p>
                <div className="space-y-2">
                  {[
                    {
                      icon: Users,
                      label: "Total Posts",
                      value: (job?.totalPosts || 0).toLocaleString("en-IN"),
                    },
                    {
                      icon: Building2,
                      label: "Department",
                      value: job?.department,
                    },
                    {
                      icon: MapPin,
                      label: "Location",
                      value: job?.workLocation || job?.projectId?.state || "—",
                    },
                    {
                      icon: Briefcase,
                      label: "Post Code",
                      value: job?.postCode || "—",
                    },
                    {
                      icon: Clock,
                      label: "Deadline",
                      value: formatDate(job?.applicationDeadline),
                    },
                  ]
                    .filter(
                      ({ value }) => value !== undefined && value !== null,
                    )
                    .map(({ icon: Icon, label, value }) => (
                      <div
                        key={label}
                        className="flex items-center gap-3 rounded-xl bg-[#faf7f2] px-3 py-2.5"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-[#e0d7cd]">
                          <Icon className="h-3.5 w-3.5 text-orange-500" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#9a8f86]">
                            {label}
                          </p>
                          <p className="truncate text-[13px] font-bold text-[#1f1d1b]">
                            {value}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Important Dates mini card */}
              {(job?.applicationStartDate ||
                job?.applicationDeadline ||
                job?.examDate) && (
                <div className="rounded-2xl border border-[#e0d7cd] bg-white p-5 shadow-sm">
                  <p className="mb-4 text-[11px] font-black uppercase tracking-[0.14em] text-[#9a8f86]">
                    Key Dates
                  </p>
                  <div className="space-y-0 divide-y divide-[#f0e8e0]">
                    {[
                      ["Start", job.applicationStartDate],
                      ["Deadline", job.applicationDeadline],
                      ["Exam", job.examDate],
                      ["Result", job.resultDate],
                    ]
                      .filter(([, d]) => d)
                      .map(([label, date]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between py-2.5"
                        >
                          <span className="text-[13px] font-semibold text-[#6d6761]">
                            {label}
                          </span>
                          <span className="text-[13px] font-black text-[#1f1d1b]">
                            {formatDate(date)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Back link */}
              <Link
                to={projectPath}
                className="flex items-center justify-center gap-2 rounded-2xl border border-[#e0d7cd] bg-white p-4 text-[13px] font-black uppercase tracking-[0.12em] text-[#6d6761] shadow-sm transition-all hover:border-orange-300 hover:text-[#e46a1d]"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {job?.projectId?.name || "Recruitment"}
              </Link>
            </aside>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
};

export default JobDetails;
