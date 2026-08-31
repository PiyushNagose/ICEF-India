import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  CheckCircle2,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";

/* eslint-disable react-refresh/only-export-components */
export const publicContainer =
  "max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8";

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.06 },
  }),
};

export const formatDate = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not announced";

export const getFee = (job) =>
  job?.applicationFee?.general ??
  job?.applicationFee?.amount ??
  job?.paymentConfig?.applicationFee ??
  0;

export const PageHero = ({ eyebrow, title, description, children }) => (
  <section className="bg-[#201d1a] text-white">
    <div className={`${publicContainer} flex min-h-[228px] flex-col justify-center py-9 lg:py-10`}>
      <p className="text-[11px] uppercase tracking-[0.16em] font-black text-orange-300">
        {eyebrow}
      </p>
      <div className="mt-3 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:items-center">
        <div>
          <h1 className="text-[32px] font-black leading-[1.12] text-white sm:text-[40px] lg:text-[48px]">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-[14px] leading-[26px] text-white/75 font-medium sm:text-base">
            {description}
          </p>
        </div>
        {children}
      </div>
    </div>
  </section>
);

export const PublicHero3D = ({
  title = "Official Recruitment Portal",
  subtitle = "Verified notices, secure applications, transparent updates.",
  stats = [],
}) => {
  const displayStats = stats.filter(Boolean).slice(0, 3);

  return (
    <div className="public-hero-3d-stage" aria-hidden="true">
      <div className="public-hero-3d-scene">
        <div className="public-hero-3d-backplate" />
        <div className="public-hero-3d-document">
          <div className="flex items-start justify-between gap-4 border-b border-[#eadfd2] pb-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e46a1d]">
                Public Notice
              </p>
              <h3 className="mt-1 line-clamp-2 text-[18px] font-black leading-tight text-[#1f1d1b]">
                {title}
              </h3>
            </div>
            <span className="flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
          </div>

          <p className="mt-3 line-clamp-2 text-sm font-semibold leading-6 text-[#5f5752]">
            {subtitle}
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-[8px] border border-[#eadfd2] bg-[#201d1a] p-2.5">
            {displayStats.map((stat) => (
              <div key={stat.label} className="min-w-0">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.08em] text-white/55">
                  {stat.label}
                </p>
                <p className="mt-1 truncate font-mono text-sm font-black text-white sm:text-base">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-2.5 space-y-1.5">
            {["OTP verification", "Published deadlines", "Candidate tracking"].map(
              (item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-[6px] border border-[#efe5dc] bg-[#fbf7f1] px-3 py-1.5 text-xs font-black text-[#332d28]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  {item}
                </div>
              ),
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export const PageFrame = ({ children }) => (
  <PublicLayout>
    <div className="min-h-[calc(100vh-122px)] bg-[#f5efe9]">{children}</div>
  </PublicLayout>
);

export const LoadingState = ({ label = "Loading latest data..." }) => (
  <div className="flex items-center justify-center gap-3 rounded-[8px] border border-[#e0d7cd] bg-white p-8 text-[#6d6761] shadow-sm">
    <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

export const ErrorState = ({ message }) => (
  <div className="rounded-[8px] border border-red-200 bg-white p-8 text-center">
    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
    <p className="font-bold text-red-700">Unable to load this section</p>
    <p className="mt-1 text-sm text-red-500">{message}</p>
  </div>
);

export const EmptyState = ({ icon: Icon = FileText, title, description }) => (
  <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-8 text-center shadow-sm">
    <Icon className="w-12 h-12 text-[#c7bdb3] mx-auto mb-4" />
    <h2 className="text-[24px] font-black leading-tight text-[#1f1d1b]">{title}</h2>
    <p className="mt-2 max-w-xl mx-auto text-[14px] leading-[26px] text-[#5f5752] font-medium">
      {description}
    </p>
  </div>
);

export const StatTile = ({ label, value }) => (
  <div className="h-full rounded-[8px] border border-white/15 bg-white/10 px-5 py-4">
    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/55">
      {label}
    </p>
    <p className="mt-2 text-[24px] font-black font-mono leading-none text-white">{value}</p>
  </div>
);

export const JobListCard = ({ job, meta, actionLabel = "View Details" }) => (
  <article className="h-full rounded-[8px] border border-[#e0d7cd] bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.16em] font-black text-orange-700">
          <span className="truncate max-w-[200px]" title={job.department || "Department"}>{job.department || "Department"}</span>
          {job.postCode && <span className="text-[#9a8f86]">#{job.postCode}</span>}
        </div>
        <h2 className="mt-2 text-[24px] font-black leading-tight text-[#1f1d1b] break-words line-clamp-2" title={job.title}>{job.title}</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-[14px] leading-[26px] text-[#5f5752] font-medium">
          <span className="inline-flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-orange-500" />
            {job.totalPosts || 0} posts
          </span>
          <span className="inline-flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-500" />
            Apply by {formatDate(job.applicationDeadline)}
          </span>
          {(job.workLocation || job.projectId?.state) && (
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-4 h-4 text-orange-500" />
              {job.workLocation || job.projectId?.state}
            </span>
          )}
        </div>
        {meta && <p className="mt-3 text-[14px] leading-[26px] text-[#5f5752] font-medium line-clamp-3">{meta}</p>}
      </div>
      <Link
        to={job?.projectId?.publicSlug ? `/apply/${job.projectId.publicSlug}/jobs/${job._id}` : "/check-status"}
        className="shrink-0 inline-flex h-10 items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition-all hover:bg-[#cb5d16]"
      >
        {actionLabel}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  </article>
);

export const ResourceCard = ({ icon: Icon = Download, title, description, to, className = "" }) => (
  <Link
    to={to}
    className={`block h-full rounded-[8px] border border-[#e0d7cd] bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md ${className}`}
  >
    <Icon className="w-6 h-6 text-orange-600" />
    <h2 className="mt-4 text-[24px] font-black leading-tight text-[#1f1d1b]">{title}</h2>
    <p className="mt-2 text-[14px] leading-[26px] text-[#5f5752] font-medium">{description}</p>
  </Link>
);

export const HelpPanel = () => (
  <div className="rounded-[8px] bg-[#e46a1d] p-6 text-white shadow-md shadow-orange-200">
    <HelpCircle className="w-7 h-7" />
    <h2 className="mt-4 text-[24px] font-black leading-tight text-white">Need Assistance?</h2>
    <div className="mt-4 space-y-3 text-[14px] leading-[26px] font-medium text-orange-50">
      <p className="flex items-center gap-2">
        <Phone className="w-4 h-4" />
        1800-123-4567
      </p>
      <p className="flex items-center gap-2">
        <Mail className="w-4 h-4" />
        support@recruitment.gov.in
      </p>
    </div>
  </div>
);

export const SearchInput = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a8179]" />
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-[6px] border border-[#d8cec4] bg-white pl-10 pr-4 text-sm outline-none transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
    />
  </div>
);
