import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  Calendar,
  Download,
  FileText,
  HelpCircle,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";

export const publicContainer =
  "max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8";

export const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.08 },
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
    <div className={`${publicContainer} py-8 lg:py-10 lg:py-12`}>
      <p className="text-[11px] uppercase tracking-[0.16em] font-black text-orange-300">
        {eyebrow}
      </p>
      <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_360px] lg:items-end">
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm sm:text-base leading-7 text-white/75">
            {description}
          </p>
        </div>
        {children}
      </div>
    </div>
  </section>
);

export const PageFrame = ({ children }) => (
  <PublicLayout>
    <div className="min-h-[calc(100vh-122px)] bg-[#f5efe9]">{children}</div>
  </PublicLayout>
);

export const LoadingState = ({ label = "Loading latest data..." }) => (
  <div className="bg-white border border-[#e0d7cd] rounded-lg p-8 flex items-center justify-center gap-3 text-[#6d6761] shadow-sm">
    <Loader2 className="w-5 h-5 animate-spin text-orange-600" />
    <span className="text-sm font-semibold">{label}</span>
  </div>
);

export const ErrorState = ({ message }) => (
  <div className="bg-white border border-red-200 rounded-lg p-8 text-center">
    <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
    <p className="font-bold text-red-700">Unable to load this section</p>
    <p className="mt-1 text-sm text-red-500">{message}</p>
  </div>
);

export const EmptyState = ({ icon: Icon = FileText, title, description }) => (
  <div className="bg-white border border-[#e0d7cd] rounded-lg p-8 text-center shadow-sm">
    <Icon className="w-12 h-12 text-[#c7bdb3] mx-auto mb-4" />
    <h2 className="text-lg font-black text-[#1f1d1b]">{title}</h2>
    <p className="mt-2 max-w-xl mx-auto text-sm leading-6 text-[#6d6761]">
      {description}
    </p>
  </div>
);

export const StatTile = ({ label, value }) => (
  <div className="h-full bg-white/10 border border-white/15 rounded-lg px-5 py-4">
    <p className="text-[10px] uppercase tracking-[0.14em] font-black text-white/55">
      {label}
    </p>
    <p className="mt-2 text-2xl font-black text-white">{value}</p>
  </div>
);

export const JobListCard = ({ job, meta, actionLabel = "View Details" }) => (
  <article className="h-full bg-white border border-[#e0d7cd] rounded-lg p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.12em] font-black text-orange-700">
          <span>{job.department || "Department"}</span>
          {job.postCode && <span className="text-[#9a8f86]">#{job.postCode}</span>}
        </div>
        <h2 className="mt-2 text-xl font-black text-[#1f1d1b]">{job.title}</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#5f5752]">
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
        {meta && <p className="mt-3 text-sm text-[#6d6761]">{meta}</p>}
      </div>
      <Link
        to={`/jobs/${job._id}`}
        className="inline-flex h-10 items-center justify-center gap-2 rounded px-4 bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16]"
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
    className={`block h-full bg-white border border-[#e0d7cd] rounded-lg p-6 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md transition-all ${className}`}
  >
    <Icon className="w-6 h-6 text-orange-600" />
    <h2 className="mt-4 text-lg font-black text-[#1f1d1b]">{title}</h2>
    <p className="mt-2 text-sm leading-6 text-[#6d6761]">{description}</p>
  </Link>
);

export const HelpPanel = () => (
  <div className="bg-[#e46a1d] text-white rounded-lg p-6 shadow-md shadow-orange-200">
    <HelpCircle className="w-7 h-7" />
    <h2 className="mt-4 text-xl font-black">Need Assistance?</h2>
    <div className="mt-4 space-y-3 text-sm text-orange-50">
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
      className="w-full h-11 pl-10 pr-4 rounded border border-[#d8cec4] bg-white text-sm outline-none focus:ring-2 focus:ring-orange-500"
    />
  </div>
);


