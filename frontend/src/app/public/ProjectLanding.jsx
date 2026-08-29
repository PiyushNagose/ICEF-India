import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  Phone,
  SearchCheck,
  ShieldCheck,
  Users,
  XCircle,
  CircleHelp,
  Mail,
  Bell,
  BookOpen,
  ChevronRight,
  X,
} from "lucide-react";
import { publicService } from "../../services/public.service";
import { adminService } from "../../services/admin.service";
import PublicLayout from "../../components/layouts/PublicLayout";
import { candidateService } from "../../services/candidate.service";
import { isCandidateUser, useAuth } from "../../hooks/useAuth";
import {
  getApplicationAction,
  getJobAvailability,
} from "../../utils/jobAvailability";
import { readCmsPreviewDraft } from "../../utils/cmsPreview";
import { PublicHero3D } from "./PublicPageShell";
import heroBg from "../../assets/herobg.jpg";

/* ─────────────────────────────────────────────────────────────
   ANIMATION VARIANTS
───────────────────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.06 },
  }),
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.45, ease: "easeOut" },
  },
};

/* ─────────────────────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────────────────────── */
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not announced";

const daysLeft = (d) =>
  d
    ? Math.max(
        0,
        Math.ceil(
          (new Date(new Date(d).setHours(23, 59, 59, 999)) - new Date()) /
            86400000,
        ),
      )
    : null;

const fee = (job, cat = "general") => {
  const f = job?.applicationFee || {};
  if (cat === "sc" || cat === "st") return f.scSt ?? f.scst ?? 0;
  if (cat === "obc") return f.obc ?? f.general ?? 0;
  if (cat === "ews") return f.ews ?? f.general ?? 0;
  if (cat === "pwd") return f.pwd ?? 0;
  return f.general ?? 0;
};

const getNoticeText = (notice) =>
  typeof notice === "string"
    ? notice
    : notice?.text || notice?.title || notice?.label || "";

const getNoticeHref = (notice, slug) => {
  if (typeof notice === "string") return "#available-posts";
  const raw = notice?.url || notice?.link || notice?.href || "";
  if (raw) {
    if (/^https?:\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("#")) {
      return raw;
    }
    return `/${raw.replace(/^\/+/, "")}`;
  }
  if (notice?.jobId) return `/apply/${slug}/jobs/${notice.jobId}`;
  return "#available-posts";
};

const normalizeNoticeText = (text = "") =>
  text.replace(/\s+/g, " ").trim().toLowerCase();

const isGenericDeadlineNotice = (text = "") =>
  /last date to apply|application deadline|check each post/i.test(text);

const uniqueNotices = (notices) => {
  const seen = new Set();
  return notices.filter((notice) => {
    const text = getNoticeText(notice);
    const key = normalizeNoticeText(text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/* ─────────────────────────────────────────────────────────────
   STATUS BADGE COMPONENT
───────────────────────────────────────────────────────────── */
const StatusBadge = ({ job }) => {
  const availability = getJobAvailability(job);
  const isOpen = availability.status === "open";
  const isUpcoming = availability.status === "not_open";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] shadow-sm ${
        isOpen
          ? "bg-emerald-500 text-white"
          : isUpcoming
            ? "bg-amber-500 text-white"
            : "bg-gray-400 text-white"
      }`}
    >
      {isOpen ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <XCircle className="h-3.5 w-3.5" />
      )}
      {availability.label}
    </span>
  );
};

/* ─────────────────────────────────────────────────────────────
   JOB CARD COMPONENT
───────────────────────────────────────────────────────────── */
const JobCard = ({ job, existingApp, onApply, onStatus, onDetails, index }) => {
  const availability = getJobAvailability(job);
  const action = getApplicationAction(job, existingApp);
  const dl = availability.daysLeft ?? daysLeft(job.applicationDeadline);
  const generalFee = fee(job, "general");
  const scstFee = fee(job, "sc");

  return (
    <motion.article
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      className="group relative overflow-hidden rounded-2xl border border-[#e0d7cd] bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-50/0 to-orange-50/0 transition-all group-hover:from-orange-50/30 group-hover:to-transparent" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-orange-100 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                <Briefcase className="h-3 w-3" />
                {job.postCode || "Post"}
              </span>
              <span className="text-[12px] font-semibold text-[#9a8f86]">
                {job.department}
              </span>
            </div>
            <h3
              className="text-[24px] font-black leading-tight text-[#1f1d1b] transition-colors group-hover:text-orange-600 break-words line-clamp-2"
              title={job.title}
            >
              {job.title}
            </h3>
          </div>
          <StatusBadge job={job} />
        </div>

        {/* Preview-only marker: this job is still a draft and not yet public */}
        {job.previewPending && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-amber-700">
            <Eye className="h-3.5 w-3.5" />
            Not live yet — shown for preview only
          </div>
        )}

        {/* Stats Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-[#faf7f2] p-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a8f86]">
              Vacancies
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[24px] font-black font-mono leading-none text-[#1f1d1b]">
              <Users className="h-4 w-4 text-orange-500" />
              {(job.totalPosts || 0).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="rounded-xl bg-[#faf7f2] p-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a8f86]">
              Fee (Gen)
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[24px] font-black font-mono leading-none text-[#1f1d1b]">
              <IndianRupee className="h-3.5 w-3.5 text-orange-500" />
              {generalFee === 0 ? "Free" : generalFee}
            </p>
          </div>
          <div className="rounded-xl bg-[#faf7f2] p-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a8f86]">
              Fee (SC/ST)
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-[24px] font-black font-mono leading-none text-[#1f1d1b]">
              <IndianRupee className="h-3.5 w-3.5 text-orange-500" />
              {scstFee === 0 ? "Free" : scstFee}
            </p>
          </div>
          <div className="rounded-xl bg-[#faf7f2] p-3.5">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#9a8f86]">
              Last Date
            </p>
            <p
              className={`mt-2 flex items-center gap-1.5 text-[24px] font-black font-mono leading-none ${
                dl !== null && dl <= 7 ? "text-red-600" : "text-[#1f1d1b]"
              }`}
            >
              <Calendar className="h-4 w-4 text-orange-500" />
              <span>{new Date(job.applicationDeadline).getDate()}</span>
              <span className="text-[13px] font-bold">
                {new Date(job.applicationDeadline).toLocaleDateString("en-IN", {
                  month: "short",
                })}
              </span>
            </p>
          </div>
        </div>

        {/* Urgency Banner */}
        {availability.status === "open" && dl !== null && dl <= 7 && dl > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 border-l-4 border-red-500 px-4 py-3 text-red-700"
          >
            <Clock className="h-4 w-4 shrink-0" />
            <span className="text-sm font-bold">
              Only {dl} day{dl !== 1 ? "s" : ""} left to apply!
            </span>
          </motion.div>
        )}

        {/* Important Dates Accordion */}
        <details className="group/details mt-5">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl bg-gradient-to-r from-orange-50 to-transparent px-4 py-3 text-sm font-bold text-[#1f1d1b] transition-colors hover:from-orange-100">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-500" />
              View Important Dates
            </span>
            <ChevronRight className="h-4 w-4 text-orange-500 transition-transform group-open/details:rotate-90" />
          </summary>
          <div className="mt-3 space-y-2 rounded-xl border border-[#f0e8e0] bg-[#faf7f2] p-4">
            {[
              {
                label: "Application Start",
                value: fmt(job.applicationStartDate),
              },
              {
                label: "Application End",
                value: fmt(job.applicationDeadline),
                highlight: true,
              },
              job.correctionStartDate && {
                label: "Correction Window",
                value: `${fmt(job.correctionStartDate)} - ${fmt(job.correctionDeadline)}`,
              },
              {
                label: "Admit Card Release",
                value: fmt(job.admitCardReleaseDate),
              },
              { label: "Exam Date", value: fmt(job.examDate) },
              { label: "Result Date", value: fmt(job.resultDate) },
            ]
              .filter(Boolean)
              .map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${
                    item.highlight
                      ? "bg-orange-100 font-bold text-orange-700"
                      : "text-[#4a4540]"
                  }`}
                >
                  <span className="font-semibold">{item.label}</span>
                  <span
                    className={item.highlight ? "font-black" : "font-semibold"}
                  >
                    {item.value}
                  </span>
                </div>
              ))}
          </div>
        </details>

        {/* Action Buttons */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => onDetails(job)}
            className="flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-orange-200 bg-white px-5 text-sm font-black uppercase tracking-[0.12em] text-orange-600 transition-all hover:border-orange-300 hover:bg-orange-50"
          >
            <FileText className="h-4 w-4" />
            Full Details
          </button>
          {action.canClick ? (
            <button
              onClick={() =>
                existingApp ? onStatus(existingApp) : onApply(job)
              }
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] px-5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-lg shadow-orange-500/25 transition-all hover:shadow-xl hover:shadow-orange-500/40"
            >
              {existingApp ? action.label : "Apply Now"}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex h-12 items-center justify-center rounded-xl border-2 border-dashed border-[#d8cec4] bg-[#faf7f2] px-4 text-center text-xs font-black uppercase tracking-[0.12em] text-[#9a8f86]">
              {action.label}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
};

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────────────────────── */
export default function ProjectLanding({ preview = false }) {
  const params = useParams();
  const previewId = params.id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const useDraft = preview && searchParams.get("draft") === "1";
  const { token, user } = useAuth();
  const isCandidate = !preview && !!token && isCandidateUser(user);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: preview
      ? ["admin-project-preview", previewId, useDraft]
      : ["public-project", params.slug],
    queryFn: () =>
      preview
        ? adminService.getProjectPreview(previewId)
        : publicService.getProjectBySlug(params.slug),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: !preview,
    retry: 1,
  });

  const project = data?.project;
  const slug = preview ? project?.publicSlug || previewId : params.slug;
  const previewMeta = preview ? data?.preview : null;
  const savedCmsPage = data?.cmsPage;
  // In draft mode the admin's unsaved CMS edits (stashed by CmsEdit) win over
  // whatever is saved in the DB, so the preview matches the editor exactly.
  const draftCms = useMemo(
    () => (useDraft ? readCmsPreviewDraft(previewId) : null),
    [useDraft, previewId],
  );
  const cmsPage = draftCms ? { ...savedCmsPage, ...draftCms } : savedCmsPage;
  const jobs = data?.jobs || [];
  const featuredJobIds = new Set(
    (cmsPage?.featuredJobs || []).map((job) => String(job._id || job)),
  );
  const visibleJobs = featuredJobIds.size
    ? [
        ...jobs.filter((job) => featuredJobIds.has(String(job._id))),
        ...jobs.filter((job) => !featuredJobIds.has(String(job._id))),
      ]
    : jobs;
  const openJobs = visibleJobs.filter((j) => getJobAvailability(j).canApply);
  const jobsWithDeadlines = visibleJobs.filter((job) => job.applicationDeadline);
  const candidateDeadlineLabel =
    openJobs.length === 1
      ? `Apply by ${fmt(openJobs[0].applicationDeadline)}`
      : openJobs.length > 1
        ? "Job-wise deadlines"
        : jobsWithDeadlines.length === 1
          ? `Closed on ${fmt(jobsWithDeadlines[0].applicationDeadline)}`
          : "See post deadlines";
  const deadlineStatValue =
    openJobs.length === 1
      ? `${new Date(openJobs[0].applicationDeadline).getDate()} ${new Date(
          openJobs[0].applicationDeadline,
        ).toLocaleDateString("en-IN", { month: "short" })}`
      : openJobs.length > 1
        ? "By Post"
        : "Closed";
  const activeDeadlineJobs = openJobs.filter((job) => job.applicationDeadline);
  const uniqueActiveDeadlines = [
    ...new Set(
      activeDeadlineJobs.map((job) =>
        new Date(job.applicationDeadline).toDateString(),
      ),
    ),
  ];
  const jobDeadlineNotices =
    activeDeadlineJobs.length > 1 && uniqueActiveDeadlines.length === 1
      ? [
          {
            text: `Applications close on ${fmt(
              activeDeadlineJobs[0].applicationDeadline,
            )}. Check post details before applying.`,
            link: "#available-posts",
            priority: "high",
          },
        ]
      : activeDeadlineJobs.map((job) => ({
          text: `${job.title}: Apply by ${fmt(job.applicationDeadline)}`,
          link: `/apply/${slug}/jobs/${job._id}`,
          priority: "medium",
        }));
  const closedDeadlineNotice =
    !activeDeadlineJobs.length && jobsWithDeadlines.length
      ? [
          {
            text:
              jobsWithDeadlines.length === 1
                ? `Applications closed on ${fmt(
                    jobsWithDeadlines[0].applicationDeadline,
                  )}.`
                : "Applications are closed. Check individual post details for deadlines.",
            link: "#available-posts",
            priority: "medium",
          },
        ]
      : [];
  const cmsTickerNotices = (cmsPage?.announcements || []).filter(
    (notice) => !isGenericDeadlineNotice(getNoticeText(notice)),
  );
  const tickerNotices = uniqueNotices([
    ...cmsTickerNotices,
    ...jobDeadlineNotices,
    ...closedDeadlineNotice,
  ]);
  const visibility = {
    notices: cmsPage?.sectionVisibility?.notices ?? true,
    quickActions: cmsPage?.sectionVisibility?.quickActions ?? true,
    howToApply: cmsPage?.sectionVisibility?.howToApply ?? true,
    downloads: cmsPage?.sectionVisibility?.downloads ?? true,
    faqs: cmsPage?.sectionVisibility?.faqs ?? true,
    helpdesk: cmsPage?.sectionVisibility?.helpdesk ?? true,
  };
  const instructions = cmsPage?.instructions?.length
    ? cmsPage.instructions
    : [
        "Choose an open post from the list below",
        "Verify your email and mobile number",
        "Fill the application form step by step",
        "Upload required documents (photo, signature, certificates)",
        "Review all details and make payment",
        "Download your Registration Number confirmation",
      ];
  const downloads = cmsPage?.downloads || [];
  const faqs = cmsPage?.faqs?.length
    ? cmsPage.faqs
    : [
        {
          question: "How do I apply for a post?",
          answer:
            'Click "Apply Now" on any open post, verify your email/mobile, complete the form, and make payment.',
        },
        {
          question: "Can I edit my application after submission?",
          answer:
            "After payment, you can only edit during the correction window if enabled by the admin.",
        },
        {
          question: "When will I receive my admit card?",
          answer:
            "Admit cards are released on the dates mentioned in each post. Download from the Check Status page.",
        },
      ];
  const helpdesk = {
    phone: "1800-123-4567",
    email: "support@recruitment.gov.in",
    hours: "Monday to Friday, 9:00 AM to 6:00 PM",
    address: "Recruitment Portal Helpdesk",
    ...(cmsPage?.helpdesk || {}),
  };
  const quickLinks = {
    applyNow: cmsPage?.quickLinks?.applyNow ?? true,
    latestNotifications: cmsPage?.quickLinks?.latestNotifications ?? true,
    admitCards: cmsPage?.quickLinks?.admitCards ?? true,
    results: cmsPage?.quickLinks?.results ?? true,
    support: cmsPage?.quickLinks?.support ?? true,
  };

  const { data: myAppsData } = useQuery({
    queryKey: ["public-project-applications", slug, user?._id],
    queryFn: () => candidateService.getMyApplications(),
    enabled: isCandidate,
    staleTime: 30 * 1000,
  });

  const myApps = Array.isArray(myAppsData)
    ? myAppsData
    : myAppsData?.applications || myAppsData?.data || [];
  const appliedMap = myApps.reduce((map, application) => {
    map[application.jobId?._id || application.jobId] = application;
    return map;
  }, {});

  const handleApply = (job) => {
    if (preview) {
      toast("Preview mode — applications are disabled here.");
      return;
    }
    sessionStorage.setItem(
      "publicApplyContext",
      JSON.stringify({
        projectId: project._id,
        projectSlug: slug,
        projectName: project.name,
        jobId: job._id,
        jobTitle: job.title,
      }),
    );
    navigate(`/apply/${slug}/start?jobId=${job._id}`);
  };

  const handleDetails = (job) => {
    if (preview) {
      toast("Preview mode — navigation is disabled here.");
      return;
    }
    navigate(`/apply/${slug}/jobs/${job._id}`);
  };

  const handleStatus = (application, job) => {
    if (preview) {
      toast("Preview mode — actions are disabled here.");
      return;
    }
    if (application?.status === "draft") {
      const selectedJob = job || application.jobId || {};
      const jobId =
        selectedJob?._id || application.jobId?._id || application.jobId;
      sessionStorage.setItem(
        "publicApplyContext",
        JSON.stringify({
          projectId: project._id,
          projectSlug: slug,
          projectName: project.name,
          jobId,
          jobTitle: selectedJob?.title || application.jobTitle || "",
          applicationId: application._id,
        }),
      );
      navigate(`/apply/${slug}/start?jobId=${jobId}&resume=1`);
      return;
    }

    navigate("/check-status", {
      state: {
        applicationId: application?._id,
        publicApplicationId: application?.applicationId,
        registrationNumber: application?.registrationNumber,
      },
    });
  };

  /* ═══════════════════════════════════════════════════════════
     LOADING STATE
  ═══════════════════════════════════════════════════════════ */
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-[#f5efe9]">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-4"
          >
            <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
            <p className="text-sm font-bold text-[#6d6761]">
              Loading recruitment details...
            </p>
          </motion.div>
        </div>
      </PublicLayout>
    );
  }

  /* ═══════════════════════════════════════════════════════════
     ERROR / NOT FOUND STATE
  ═══════════════════════════════════════════════════════════ */
  if (isError || !project) {
    return (
      <PublicLayout>
        <div className="flex min-h-screen items-center justify-center bg-[#f5efe9] p-6">
          <motion.div
            variants={scaleIn}
            initial="hidden"
            animate="visible"
            className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-xl"
          >
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h1 className="mt-6 text-2xl font-black text-[#1f1d1b]">
              Recruitment Not Found
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6d6761]">
              {error?.message ||
                "The recruitment link you visited is invalid or has been removed."}
            </p>
            <button
              onClick={() => navigate("/jobs")}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#e46a1d] px-6 text-sm font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-[#cb5d16]"
            >
              Browse All Recruitments
              <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      </PublicLayout>
    );
  }

  const heroImage = cmsPage?.bannerImage || heroBg;

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9]">
        {/* ═══════════════════════════════════════════════════════════
            PREVIEW BANNER (admin only)
        ═══════════════════════════════════════════════════════════ */}
        {preview && (
          <div className="sticky top-0 z-50 border-b border-orange-300 bg-orange-600 text-white">
            <div className="mx-auto flex max-w-[1380px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6 lg:px-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em]">
                <Eye className="h-3.5 w-3.5" />
                Preview
              </span>
              <span className="text-xs font-semibold text-white/90">
                {useDraft
                  ? "Showing unsaved CMS draft"
                  : "Showing saved content — not yet public"}
              </span>
              {previewMeta && (
                <span className="hidden items-center gap-3 text-[11px] font-bold uppercase tracking-[0.1em] text-white/80 sm:inline-flex">
                  <span>
                    Project:{" "}
                    {previewMeta.projectPublished ? "Published" : "Not published"}
                  </span>
                  <span>CMS: {previewMeta.cmsStatus}</span>
                  <span>
                    {previewMeta.liveJobCount} live · {previewMeta.pendingJobCount}{" "}
                    pending
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => window.close()}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold transition-colors hover:bg-white/25"
              >
                <X className="h-3.5 w-3.5" />
                Close Preview
              </button>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            HERO SECTION
        ═══════════════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-[#1f1d1b] lg:min-h-[calc(100vh-132px)]">
          {/* Background Image with Overlays */}
          <div className="absolute inset-0">
            <img
              src={heroImage}
              alt=""
              className="h-full w-full object-cover opacity-90"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-black/20" />
          </div>

          <div className="relative mx-auto flex min-h-[inherit] max-w-[1380px] flex-col justify-center px-4 py-11 sm:px-6 sm:py-[52px] lg:px-8 lg:py-[58px]">
            {/* Trust Badges */}
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="mb-8 flex flex-wrap items-center gap-3"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-300 backdrop-blur-sm">
                <ShieldCheck className="h-4 w-4" />
                Official Recruitment
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white/70 backdrop-blur-sm">
                <MapPin className="h-3.5 w-3.5" />
                {project.state}
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white/70 backdrop-blur-sm">
                <Briefcase className="h-3.5 w-3.5" />
                {project.department}
              </span>
            </motion.div>

            <div className="grid w-full gap-8 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-center xl:grid-cols-[minmax(0,1fr)_400px]">
              {/* Left — Title & Description */}
              <div>
                <motion.p
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.06 }}
                  className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-400"
                >
                  {project.status === "active"
                    ? "Applications Open"
                    : "Recruitment Notice"}
                </motion.p>

                <motion.h1
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.12 }}
                  className="mt-4 max-w-5xl text-[34px] font-black leading-[1.1] text-white [text-wrap:balance] sm:text-[44px] lg:text-[54px] 2xl:text-[56px]"
                >
                  {cmsPage?.heroTitle || project.name}
                </motion.h1>

                {(cmsPage?.heroSubtitle || project.description) && (
                  <motion.p
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.45, delay: 0.18 }}
                    className="mt-5 max-w-2xl text-[14px] leading-[26px] text-white/80 font-medium"
                  >
                    {cmsPage?.heroSubtitle || project.description}
                  </motion.p>
                )}

                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.45, delay: 0.24 }}
                  className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm"
                >
                  <span className="flex items-center gap-2 text-white/70">
                    <Briefcase className="h-4 w-4 text-orange-400" />
                    <span className="font-semibold">
                      {visibleJobs.length} Post
                      {visibleJobs.length !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-white/70">
                    <Users className="h-4 w-4 text-orange-400" />
                    <span className="font-semibold">
                      {visibleJobs
                        .reduce((sum, j) => sum + (j.totalPosts || 0), 0)
                        .toLocaleString("en-IN")}{" "}
                      Vacancies
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-white/70">
                    <Calendar className="h-4 w-4 text-orange-400" />
                    <span className="font-semibold">
                      {candidateDeadlineLabel}
                    </span>
                  </span>
                </motion.div>

                {/* CTA Buttons */}
                {openJobs.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.3 }}
                    className="mt-8 flex flex-wrap gap-4"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        document
                          .getElementById("available-posts")
                          ?.scrollIntoView({ behavior: "smooth" })
                      }
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#e46a1d] to-[#d85a0d] px-8 text-sm font-black uppercase tracking-[0.14em] text-white shadow-xl shadow-orange-500/30 transition-all hover:shadow-2xl hover:shadow-orange-500/50"
                    >
                      View Posts & Apply
                      <ArrowRight className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/check-status")}
                      className="inline-flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-white/30 bg-white/10 px-8 text-sm font-black uppercase tracking-[0.14em] text-white backdrop-blur-sm transition-all hover:border-white/50 hover:bg-white/20"
                    >
                      <SearchCheck className="h-5 w-5" />
                      Check Status
                    </button>
                  </motion.div>
                )}
              </div>

              {/* Right — Quick Stats */}
              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.45, delay: 0.18 }}
                className="self-start"
              >
                <PublicHero3D
                  title={cmsPage?.heroTitle || project.name}
                  subtitle={`${project.department || "Recruitment"} application services for ${project.state || "India"}.`}
                  stats={[
                    {
                      label: "Vacancies",
                      value: visibleJobs
                        .reduce((sum, j) => sum + (j.totalPosts || 0), 0)
                        .toLocaleString("en-IN"),
                    },
                    { label: "Open Posts", value: openJobs.length },
                    { label: "Deadline", value: deadlineStatValue },
                  ]}
                />
              </motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════
            NOTICE TICKER
        ═══════════════════════════════════════════════════════════ */}
        {visibility.notices && tickerNotices.length > 0 && (
          <div className="border-b border-amber-300 bg-gradient-to-r from-amber-100 to-amber-50">
            <div className="mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-4 py-3">
                <div className="flex shrink-0 items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white">
                  <Bell className="h-3.5 w-3.5" />
                  Notice
                </div>
                <div className="public-notice-ticker min-w-0 flex-1 overflow-hidden">
                  <div className="animate-public-ticker flex w-max items-center gap-6" aria-hidden="true">
                    {[...tickerNotices, ...tickerNotices].map(
                      (notice, index) => {
                        const text = getNoticeText(notice);
                        if (!text) return null;
                        const href = getNoticeHref(notice, slug);
                        const isExternal = /^https?:\/\//i.test(href);
                        return (
                          <a
                            key={`${text}-${index}`}
                            href={href}
                            target={isExternal ? "_blank" : undefined}
                            rel={isExternal ? "noreferrer" : undefined}
                            className="inline-flex items-center gap-3 whitespace-nowrap text-sm font-black text-amber-900 transition hover:text-orange-700 max-w-[90vw] overflow-hidden text-ellipsis"
                            title={text}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" />
                            <span className="truncate">{text}</span>
                          </a>
                        );
                      },
                    )}
                  </div>
                  <p className="sr-only">
                    {tickerNotices
                      .map((a) => a.text || a.title)
                      .join(" • ")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            MAIN CONTENT
        ═══════════════════════════════════════════════════════════ */}
        <div className="mx-auto max-w-[1380px] px-4 pb-10 pt-7 sm:px-6 lg:px-8 lg:pb-14 lg:pt-10">
          {/* Section title — full width above both columns */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="mb-6 flex flex-wrap items-center justify-between gap-4"
          >
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-600">
                {openJobs.length > 0
                  ? "Applications Open"
                  : "Recruitment Posts"}
              </p>
              <h2 className="mt-2 text-[24px] font-black leading-tight text-[#1f1d1b]">
                Available Posts
              </h2>
              <p className="mt-1.5 text-[13px] font-semibold text-[#7a716a]">
                {openJobs.length} open · {visibleJobs.length - openJobs.length}{" "}
                closed
              </p>
            </div>
            {openJobs.length > 0 && (
              <button
                onClick={() =>
                  document
                    .getElementById("how-to-apply")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 text-[13px] font-black uppercase tracking-[0.12em] text-orange-600 transition-colors hover:border-orange-300 hover:bg-orange-100"
              >
                <BookOpen className="h-4 w-4" />
                How to Apply
              </button>
            )}
          </motion.div>

          <div className="space-y-6">
            {/* ═══════════════════════════════════════════════════════════
                LEFT COLUMN — JOBS
            ═══════════════════════════════════════════════════════════ */}
            <div id="available-posts" className="grid gap-5 lg:grid-cols-2">
              {/* No Jobs */}
              {visibleJobs.length === 0 && (
                <motion.div
                  variants={scaleIn}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-2xl border-2 border-dashed border-[#e0d7cd] bg-white p-12 text-center lg:col-span-2"
                >
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#faf7f2]">
                    <FileText className="h-10 w-10 text-[#c7bdb3]" />
                  </div>
                  <h3 className="mt-6 text-[24px] font-black leading-tight text-[#1f1d1b]">
                    No Posts Available
                  </h3>
                  <p className="mt-2 text-[14px] leading-[26px] text-[#5f5752] font-medium">
                    Job posts will be published soon. Check back later.
                  </p>
                </motion.div>
              )}

              {/* Job Cards */}
              {visibleJobs.map((job, index) => (
                <JobCard
                  key={job._id}
                  job={job}
                  index={index}
                  existingApp={appliedMap[job._id]}
                  onApply={handleApply}
                  onDetails={handleDetails}
                  onStatus={(application) => handleStatus(application, job)}
                />
              ))}

              {/* Downloads Section */}
              {visibility.downloads && downloads.length > 0 && (
                <motion.section
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-2xl border border-[#e0d7cd] bg-white p-6 shadow-sm lg:col-span-2"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-600">
                        Official Documents
                      </p>
                      <h3 className="mt-1 text-[18px] font-black text-[#1f1d1b]">
                        Downloads
                      </h3>
                    </div>
                    <Download className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {downloads.map((item, index) => (
                      <a
                        key={`${item.title}-${index}`}
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group flex items-center justify-between gap-3 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-4 transition-all hover:border-orange-300 hover:bg-orange-50 hover:shadow-md"
                      >
                        <div className="min-w-0 flex-1">
                          <p
                            className="line-clamp-2 text-[13px] font-bold text-[#1f1d1b] break-words"
                            title={item.title}
                          >
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#9a8f86]">
                            {item.type || "PDF"}
                          </p>
                        </div>
                        <Download className="h-4 w-4 shrink-0 text-orange-500 transition-transform group-hover:scale-110" />
                      </a>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* FAQs Section */}
              {visibility.faqs && faqs.length > 0 && (
                <motion.section
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="rounded-2xl border border-[#e0d7cd] bg-white p-6 shadow-sm lg:col-span-2"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-orange-600">
                        Frequently Asked
                      </p>
                      <h3 className="mt-1 text-[18px] font-black text-[#1f1d1b]">
                        Questions
                      </h3>
                    </div>
                    <CircleHelp className="h-5 w-5 text-orange-500" />
                  </div>
                  <div className="space-y-4">
                    {faqs.map((item, index) => (
                      <details
                        key={`${item.question}-${index}`}
                        className="group rounded-xl border border-[#f0e8e0] bg-[#faf7f2] transition-all hover:border-orange-200"
                      >
                        <summary className="flex cursor-pointer items-start justify-between gap-4 p-4 font-bold text-[#1f1d1b]">
                          <span className="text-sm">{item.question}</span>
                          <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-orange-500 transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="border-t border-[#f0e8e0] px-4 pb-4 pt-3">
                          <p className="text-sm leading-6 text-[#6d6761]">
                            {item.answer}
                          </p>
                        </div>
                      </details>
                    ))}
                  </div>
                </motion.section>
              )}
            </div>

            {/* ═══════════════════════════════════════════════════════════
                RIGHT SIDEBAR
            ═══════════════════════════════════════════════════════════ */}
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {/* How to Apply */}
              {visibility.howToApply && (
                <motion.div
                  id="how-to-apply"
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="h-full rounded-2xl border border-[#e0d7cd] bg-gradient-to-br from-white to-orange-50/30 p-6 shadow-sm"
                >
                  <div className="mb-5 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-white">
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <h3 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
                      How to Apply
                    </h3>
                  </div>
                  <ol className="space-y-3">
                    {instructions.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-xs font-black text-white">
                          {i + 1}
                        </span>
                        <span className="pt-1 text-sm leading-6 text-[#4a4540]">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-5 rounded-xl bg-amber-50 border border-amber-200 p-4">
                    <p className="text-xs font-semibold leading-5 text-amber-800">
                      <strong>Important:</strong> Your application is only
                      confirmed after successful payment.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Quick Actions */}
              {visibility.quickActions && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="h-full rounded-2xl border border-[#e0d7cd] bg-white p-5 shadow-sm"
                >
                  <h3 className="mb-4 text-[24px] font-black leading-tight text-[#1f1d1b]">
                    Quick Actions
                  </h3>
                  <div className="space-y-2">
                    {[
                      {
                        label: "Check Application Status",
                        to: "/check-status",
                        icon: SearchCheck,
                        show: true,
                      },
                      {
                        label: "Download Admit Card",
                        to: "/admit-cards",
                        icon: Download,
                        show: quickLinks.admitCards,
                      },
                      {
                        label: "View Results",
                        to: "/results",
                        icon: CheckCircle2,
                        show: quickLinks.results,
                      },
                      {
                        label: "Request Correction",
                        to: "/correction-request",
                        icon: AlertCircle,
                        show: quickLinks.latestNotifications,
                      },
                    ]
                      .filter((item) => item.show)
                      .map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => navigate(item.to)}
                          className="flex w-full items-center gap-3 rounded-xl border border-[#e0d7cd] bg-[#faf7f2] p-3 text-left transition-all hover:border-orange-300 hover:bg-orange-50 hover:shadow-sm"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                            <item.icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold text-[#1f1d1b]">
                            {item.label}
                          </span>
                          <ChevronRight className="ml-auto h-4 w-4 text-[#9a8f86]" />
                        </button>
                      ))}
                  </div>
                </motion.div>
              )}

              {/* Helpdesk */}
              {visibility.helpdesk && (
                <motion.div
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true }}
                  className="h-full rounded-2xl border border-[#e0d7cd] bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                      <Phone className="h-5 w-5" />
                    </div>
                    <h3 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
                      Need Help?
                    </h3>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <Phone className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-bold text-[#1f1d1b]">Helpline</p>
                        <p className="text-[#6d6761]">{helpdesk.phone}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-bold text-[#1f1d1b]">Email</p>
                        <p className="text-[#6d6761]">{helpdesk.email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <div>
                        <p className="font-bold text-[#1f1d1b]">Hours</p>
                        <p className="text-[#6d6761]">{helpdesk.hours}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
