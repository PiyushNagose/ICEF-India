import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Briefcase,
  Calendar,
  FileText,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";

import PublicLayout from "../../components/layouts/PublicLayout";
import heroBg from "../../assets/herobg.jpg";
import { publicService } from "../../services/public.service";
import { jobService } from "../../services/job.service";

const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const fromSlug = (slug = "") => {
  const normalised = slug.replace(/-/g, " ").trim().toLowerCase();
  return (
    STATES.find((state) => state.toLowerCase() === normalised) ||
    normalised.replace(/\b\w/g, (char) => char.toUpperCase())
  );
};

const fmt = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not announced";

const StateLanding = () => {
  const { stateSlug } = useParams();
  const navigate = useNavigate();
  const stateName = useMemo(() => fromSlug(stateSlug), [stateSlug]);

  const { data: cmsData } = useQuery({
    queryKey: ["public-state-cms", stateName],
    queryFn: () => jobService.getStateBanner(stateName),
    enabled: !!stateName,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: projectsData,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["public-state-projects", stateName],
    queryFn: () => publicService.getActiveProjects({ state: stateName, limit: 50 }),
    enabled: !!stateName,
    staleTime: 15 * 1000,
  });

  const page = cmsData?.page || null;
  const projects = projectsData?.projects || [];
  const announcements = page?.announcements || [];
  const heroImage = page?.bannerImage || heroBg;
  const hasCmsImage = Boolean(page?.bannerImage);
  const tickerItems = announcements.length
    ? Array.from({ length: 6 }, (_, repeatIndex) =>
        announcements.map((item, itemIndex) => ({
          ...item,
          key: `${item.text || item.title || "update"}-${repeatIndex}-${itemIndex}`,
        })),
      ).flat()
    : [];

  return (
    <PublicLayout>
      <div className="min-h-screen bg-[#f3efe8]">
        <style>{`
          @keyframes stateTicker {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }

          .state-ticker-track {
            animation: stateTicker 30s linear infinite;
          }

          .state-ticker-track:hover {
            animation-play-state: paused;
          }

          @media (prefers-reduced-motion: reduce) {
            .state-ticker-track {
              animation: none;
            }
          }
        `}</style>
        <section className="relative min-h-[560px] overflow-hidden bg-[#171513] lg:min-h-[620px]">
          <img
            src={heroImage}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover object-center opacity-45 blur-[1px]"
          />
          <div className="absolute inset-0 bg-black/38" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/44 to-black/22" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_48%,rgba(0,0,0,0.62)_100%)]" />
          {hasCmsImage && (
            <div className="absolute inset-y-0 right-0 hidden w-[48%] items-center justify-center pr-10 lg:flex">
              <img
                src={heroImage}
                alt={`${stateName} recruitment banner`}
                className="max-h-[430px] w-full max-w-[780px] object-contain drop-shadow-[0_30px_52px_rgba(0,0,0,0.5)]"
              />
            </div>
          )}
          <div className="relative mx-auto flex min-h-[560px] max-w-[1380px] items-center px-4 py-14 sm:px-6 lg:min-h-[620px] lg:px-8 lg:py-0">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/95 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white">
                <MapPin className="h-4 w-4" />
                {stateName} Recruitment Portal
              </div>
              <h1 className="mt-6 text-[30px] sm:text-[42px] lg:text-[48px] font-black leading-[1.04] tracking-normal text-white">
                {page?.heroTitle || `${stateName} Public Recruitment`}
              </h1>
              <p className="mt-5 max-w-[560px] text-[13px] sm:text-[15px] leading-6 text-white/80">
                {page?.heroSubtitle ||
                  "Browse official recruitment projects, check deadlines, and apply through the verified candidate portal."}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  onClick={() => document.getElementById("state-projects")?.scrollIntoView({ behavior: "smooth" })}
                  className="h-12 rounded-[4px] bg-[#e46a1d] px-6 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#cb5d16]"
                >
                  View Active Recruitments
                </button>
                <button
                  onClick={() => navigate("/check-status")}
                  className="h-12 rounded-[4px] border border-white/40 bg-white/10 px-6 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-white/20"
                >
                  Check Application Status
                </button>
              </div>
              {hasCmsImage && (
                <div className="mt-8 lg:hidden">
                  <img
                    src={heroImage}
                    alt={`${stateName} recruitment banner`}
                    className="max-h-[280px] w-full object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)]"
                  />
                </div>
              )}
            </div>
          </div>
        </section>

        {tickerItems.length > 0 && (
          <section className="border-y border-[#27221d] bg-[#171513]">
            <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-4">
                <span className="inline-flex shrink-0 items-center gap-2 rounded-[4px] bg-[#e46a1d] px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-white">
                  <Bell className="h-3.5 w-3.5" />
                  Latest Updates
                </span>
                <div className="relative min-w-0 flex-1 overflow-hidden">
                  <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#171513] to-transparent" />
                  <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#171513] to-transparent" />
                  <div className="state-ticker-track flex w-max items-center gap-10 whitespace-nowrap text-xs font-bold text-white/85">
                    {tickerItems.map((item) => (
                      <span key={item.key} className="inline-flex items-center gap-3">
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                        {item.text || item.title}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        <section id="state-projects" className="py-10 lg:py-12">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-orange-600">
                  Official Projects
                </p>
                <h2 className="mt-2 text-[24px] font-black tracking-normal text-[#1f1d1b]">
                  Active Recruitments in {stateName}
                </h2>
              </div>
              <button
                onClick={() => navigate("/eligible-jobs", { state: { state: stateName } })}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[4px] border border-[#d8d0c6] bg-white px-4 text-xs font-black uppercase tracking-[0.12em] text-[#e46a1d] hover:bg-[#fff7ef]"
              >
                <Search className="h-4 w-4" />
                Filter by Eligibility
              </button>
            </div>

            {isLoading && (
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-8 text-[#6d6761]">
                <Loader2 className="mr-2 inline h-5 w-5 animate-spin text-orange-600" />
                Loading active recruitments...
              </div>
            )}

            {isError && (
              <div className="rounded-[8px] border border-red-200 bg-white p-8 text-red-600">
                <AlertCircle className="mr-2 inline h-5 w-5" />
                Unable to load state recruitments right now.
              </div>
            )}

            {!isLoading && !isError && projects.length === 0 && (
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-8 text-[#6d6761]">
                No active recruitment projects are published for {stateName} right now.
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project, index) => (
                <motion.article
                  key={project._id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: index * 0.04 }}
                  className="flex min-h-[270px] flex-col rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[6px] bg-orange-50 text-orange-600">
                      <FileText className="h-6 w-6" />
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                      Active
                    </span>
                  </div>
                  <h3 className="mt-5 min-h-[52px] text-[20px] font-black leading-tight tracking-normal text-[#1f1d1b] line-clamp-2">
                    {project.name}
                  </h3>
                  <p className="mt-2 min-h-[48px] line-clamp-2 text-sm leading-6 text-[#6d6761]">
                    {project.description || `${project.department} recruitment project for ${project.state}.`}
                  </p>
                  <div className="mt-auto grid grid-cols-2 gap-3 pt-5 text-xs">
                    <div className="rounded-[6px] bg-[#faf7f2] p-3">
                      <Briefcase className="mb-1 h-4 w-4 text-orange-600" />
                      <p className="font-bold text-[#1f1d1b]">{project.totalJobs || 0} Jobs</p>
                    </div>
                    <div className="rounded-[6px] bg-[#faf7f2] p-3">
                      <Calendar className="mb-1 h-4 w-4 text-orange-600" />
                      <p className="font-bold text-[#1f1d1b]">{fmt(project.endDate)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate(`/apply/${project.publicSlug}`)}
                    className="mt-4 flex h-11 items-center justify-center gap-2 rounded-[4px] bg-[#e46a1d] text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#cb5d16]"
                  >
                    Open Recruitment
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default StateLanding;
