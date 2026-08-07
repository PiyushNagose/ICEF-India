import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  IndianRupee,
  Loader2,
  MapPin,
  Phone,
  Users,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { publicService } from "../../services/public.service";
import PublicLayout from "../../components/layouts/PublicLayout";

/* ── helpers ─────────────────────────────────────────────────── */
const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not announced";

const daysLeft = (d) =>
  d ? Math.max(0, Math.ceil((new Date(d) - Date.now()) / 86400000)) : null;

const fee = (job, cat = "general") => {
  const f = job?.applicationFee || {};
  if (cat === "sc" || cat === "st") return f.scSt ?? f.scst ?? 0;
  if (cat === "obc") return f.obc ?? f.general ?? 0;
  if (cat === "ews") return f.ews ?? f.general ?? 0;
  if (cat === "pwd") return f.pwd ?? 0;
  return f.general ?? 0;
};

/* ── status badge ───────────────────────────────────────────── */
const StatusBadge = ({ open }) =>
  open ? (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
      <CheckCircle2 className="w-3.5 h-3.5" /> Open
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 border border-red-200">
      <XCircle className="w-3.5 h-3.5" /> Closed
    </span>
  );

/* ── date row ───────────────────────────────────────────────── */
const DateRow = ({ label, value, highlight }) => (
  <div
    className={`flex items-center justify-between py-2.5 border-b border-[#f0e8e0] last:border-0 ${
      highlight ? "text-orange-700 font-bold" : "text-[#4a4540]"
    }`}
  >
    <span className="text-[12px] text-[#7a716a]">{label}</span>
    <span className="text-[12px] font-semibold">{value}</span>
  </div>
);

/* ── job card ───────────────────────────────────────────────── */
const JobCard = ({ job, onApply }) => {
  const dl = daysLeft(job.applicationDeadline);
  const generalFee = fee(job, "general");
  const scstFee = fee(job, "sc");

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="bg-white border border-[#e0d7cd] rounded-xl p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
    >
      {/* top row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-black text-orange-600">
            {job.department} {job.postCode && `· #${job.postCode}`}
          </p>
          <h3 className="mt-1 text-xl font-black text-[#1f1d1b] leading-tight">
            {job.title}
          </h3>
        </div>
        <StatusBadge open={job.isApplicationOpen} />
      </div>

      {/* stats */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9a8f86] font-black">
            Posts
          </p>
          <p className="mt-1 text-base font-black text-[#1f1d1b] flex items-center gap-1">
            <Users className="w-4 h-4 text-orange-500" />
            {(job.totalPosts || 0).toLocaleString("en-IN")}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9a8f86] font-black">
            Fee (Gen)
          </p>
          <p className="mt-1 text-base font-black text-[#1f1d1b] flex items-center gap-1">
            <IndianRupee className="w-3.5 h-3.5 text-orange-500" />
            {generalFee === 0 ? "Free" : `₹${generalFee}`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9a8f86] font-black">
            Fee (SC/ST)
          </p>
          <p className="mt-1 text-base font-black text-[#1f1d1b] flex items-center gap-1">
            <IndianRupee className="w-3.5 h-3.5 text-orange-500" />
            {scstFee === 0 ? "Free" : `₹${scstFee}`}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-[#9a8f86] font-black">
            Last Date
          </p>
          <p
            className={`mt-1 text-base font-black flex items-center gap-1 ${
              dl !== null && dl <= 7 ? "text-red-600" : "text-[#1f1d1b]"
            }`}
          >
            <Calendar className="w-4 h-4 text-orange-500" />
            {fmt(job.applicationDeadline)}
          </p>
        </div>
      </div>

      {/* days-left banner */}
      {dl !== null && dl <= 7 && dl > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-2 text-red-700 text-sm font-semibold flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Only {dl} day{dl !== 1 ? "s" : ""} left to apply!
        </div>
      )}

      {/* important dates */}
      <div className="mt-5 bg-[#faf7f2] rounded-lg p-4">
        <p className="text-[10px] uppercase tracking-widest font-black text-[#7a716a] mb-3">
          Important Dates
        </p>
        <DateRow label="Application Start" value={fmt(job.applicationStartDate)} />
        <DateRow
          label="Application End"
          value={fmt(job.applicationDeadline)}
          highlight
        />
        {job.correctionStartDate && (
          <DateRow
            label="Correction Window"
            value={`${fmt(job.correctionStartDate)} – ${fmt(job.correctionDeadline)}`}
          />
        )}
        <DateRow
          label="Admit Card"
          value={fmt(job.admitCardReleaseDate)}
        />
        <DateRow label="Exam Date" value={fmt(job.examDate)} />
        <DateRow label="Result Date" value={fmt(job.resultDate)} />
      </div>

      {/* apply */}
      {job.isApplicationOpen && (
        <button
          onClick={() => onApply(job)}
          className="mt-6 w-full h-12 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-lg text-sm font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
        >
          Apply Now — {job.title}
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
};

/* ── main page ──────────────────────────────────────────────── */
export default function ProjectLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["public-project", slug],
    queryFn: () => publicService.getProjectBySlug(slug),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const project = data?.project;
  const jobs = data?.jobs || [];
  const openJobs = jobs.filter((j) => j.isApplicationOpen);

  const handleApply = (job) => {
    // Store the selected job and project in session storage for the application flow
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

  /* loading */
  if (isLoading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-[#f5efe9] flex items-center justify-center">
          <div className="flex items-center gap-3 text-[#6d6761]">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            <span className="font-semibold">Loading recruitment details...</span>
          </div>
        </div>
      </PublicLayout>
    );
  }

  /* error / not found */
  if (isError || !project) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-[#f5efe9] flex items-center justify-center p-6">
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center max-w-md w-full">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-black text-[#1f1d1b]">
              Recruitment Not Found
            </h1>
            <p className="mt-2 text-sm text-[#6d6761]">
              {error?.message ||
                "The recruitment link you visited is invalid or has been removed."}
            </p>
            <button
              onClick={() => navigate("/")}
              className="mt-6 px-6 py-3 bg-[#e46a1d] text-white rounded-lg text-sm font-black uppercase tracking-widest"
            >
              Go to Home
            </button>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f5efe9]">

        {/* ── HERO ─────────────────────────────────────────────── */}
        <section className="bg-[#201d1a] text-white">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
            {/* breadcrumb */}
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-black text-white/40 mb-6">
              <button onClick={() => navigate("/")} className="hover:text-white/70 transition-colors">
                Home
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-orange-400">{project.department}</span>
            </div>

            <div className="grid lg:grid-cols-[1fr_300px] gap-8 items-start">
              {/* left */}
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] font-black text-orange-400">
                  Official Recruitment Notification
                </p>
                <h1 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black leading-tight tracking-tight">
                  {project.name}
                </h1>
                {project.description && (
                  <p className="mt-4 text-white/70 text-sm leading-7 max-w-2xl">
                    {project.description}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-4 text-sm text-white/60">
                  <span className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-400" />
                    {project.state} — {project.department}
                  </span>
                  <span className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-orange-400" />
                    {jobs.length} post{jobs.length !== 1 ? "s" : ""} available
                  </span>
                  <span className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-orange-400" />
                    Application open till {fmt(project.endDate)}
                  </span>
                </div>
              </div>

              {/* right — stats */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Posts", value: jobs.reduce((a, j) => a + (j.totalPosts || 0), 0).toLocaleString("en-IN") },
                  { label: "Open Now", value: openJobs.length },
                  { label: "Department", value: project.department },
                  { label: "Status", value: project.status },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-white/10 border border-white/15 rounded-lg px-4 py-4"
                  >
                    <p className="text-[10px] uppercase tracking-widest font-black text-white/50">
                      {s.label}
                    </p>
                    <p className="mt-2 text-xl font-black text-white">{s.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* apply CTA */}
            {openJobs.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    document
                      .getElementById("job-listings")
                      ?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 h-12 px-6 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-lg text-sm font-black uppercase tracking-widest transition-colors"
                >
                  View All Posts & Apply
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigate("/admit-cards")}
                  className="inline-flex items-center gap-2 h-12 px-6 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-black uppercase tracking-widest transition-colors border border-white/20"
                >
                  <Download className="w-4 h-4" />
                  Download Admit Card
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── IMPORTANT NOTICE ─────────────────────────────────── */}
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-amber-800 text-xs font-semibold">
              Verify email and mobile to apply. Your secure application session
              will be created and your Registration Number will be issued after
              successful payment.
            </p>
          </div>
        </div>

        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid lg:grid-cols-[1fr_320px] gap-8">

            {/* ── MAIN — job listings ───────────────────────────── */}
            <div id="job-listings" className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black text-[#1f1d1b]">
                  Available Posts
                </h2>
                <span className="text-sm text-[#6d6761]">
                  {openJobs.length} open · {jobs.length - openJobs.length} closed
                </span>
              </div>

              {jobs.length === 0 ? (
                <div className="bg-white border border-[#e0d7cd] rounded-xl p-10 text-center">
                  <FileText className="w-12 h-12 text-[#c7bdb3] mx-auto mb-4" />
                  <h3 className="text-lg font-black text-[#1f1d1b]">
                    No Posts Available
                  </h3>
                  <p className="mt-2 text-sm text-[#6d6761]">
                    No job posts have been published for this recruitment yet.
                    Check back soon.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {jobs.map((job) => (
                    <JobCard key={job._id} job={job} onApply={handleApply} />
                  ))}
                </div>
              )}
            </div>

            {/* ── SIDEBAR ──────────────────────────────────────── */}
            <aside className="space-y-5 lg:sticky lg:top-6 self-start">

              {/* how to apply */}
              <div className="bg-white border border-[#e0d7cd] rounded-xl p-6">
                <h3 className="text-base font-black text-[#1f1d1b] mb-4">
                  How to Apply
                </h3>
                <ol className="space-y-3">
                  {[
                    'Click "Apply Now" on any open post',
                    "Fill the multi-step application form",
                    "Upload required documents",
                    "Pay application fee online",
                    "Receive Registration Number via Email/SMS",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-6 h-6 rounded-full bg-orange-100 text-orange-700 text-xs font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-[#4a4540]">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* public services */}
              <div className="bg-white border border-[#e0d7cd] rounded-xl p-6 space-y-3">
                <h3 className="text-base font-black text-[#1f1d1b]">
                  Public Services
                </h3>
                {[
                  {
                    label: "Check Application Status",
                    to: "/check-status",
                    icon: FileText,
                  },
                  {
                    label: "Download Admit Card",
                    to: "/admit-cards",
                    icon: Download,
                  },
                  {
                    label: "Request Correction",
                    to: "/correction-request",
                    icon: AlertCircle,
                  },
                  {
                    label: "Contact Support",
                    to: "/contact",
                    icon: Phone,
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => navigate(item.to)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-[#e0d7cd] hover:border-orange-300 hover:bg-orange-50 transition-all"
                  >
                    <span className="flex items-center gap-3 text-sm font-semibold text-[#1f1d1b]">
                      <item.icon className="w-4 h-4 text-orange-500" />
                      {item.label}
                    </span>
                    <ChevronRight className="w-4 h-4 text-[#9a8f86]" />
                  </button>
                ))}
              </div>

              {/* help */}
              <div className="bg-[#e46a1d] text-white rounded-xl p-6">
                <Phone className="w-6 h-6 mb-3" />
                <h3 className="font-black text-lg">Need Help?</h3>
                <p className="mt-1 text-orange-100 text-sm">
                  Mon–Fri, 9 AM – 6 PM
                </p>
                <p className="mt-3 text-2xl font-black">1800-123-4567</p>
                <p className="mt-1 text-orange-200 text-xs">Toll-free helpline</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
