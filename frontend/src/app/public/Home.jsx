import { useState } from "react";
import { motion } from "framer-motion";

import {
  Search,
  ArrowRight,
  Users,
  ShieldCheck,
  LogIn,
  CircleHelp,
  Phone,
  ChevronDown,
  MapPin,
  Megaphone,
  Briefcase,
  Calendar,
  FileText,
  BadgeCheck,
  ClipboardList,
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import PublicLayout from "../../components/layouts/PublicLayout";
import heroBg from "../../assets/herobg.jpg";
import { jobService } from "../../services/job.service";
import { getStoredUser } from "../../services/auth.service";
import CustomSelect from "../../components/ui/CustomSelect";
import { publicService } from "../../services/public.service";

// Reusable fade-up variant for scroll sections
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};

const STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
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

const toSlug = (value = "") =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const Home = () => {
  const navigate = useNavigate();

  const [eligibilityForm, setEligibilityForm] = useState({
    qualification: "",
    age: "",
    category: "general",
  });

  const [openFaq, setOpenFaq] = useState(null);
  const [selectedState, setSelectedState] = useState("");

  // â”€â”€ Detect logged-in candidate's state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const storedUser = getStoredUser();
  const candidateState = storedUser?.state || "";

  // Fetch CMS state banner if candidate has a state
  const { data: cmsData } = useQuery({
    queryKey: ["public-cms-banner", candidateState],
    queryFn: () => jobService.getStateBanner(candidateState),
    enabled: !!candidateState,
    staleTime: 5 * 60 * 1000,
  });
  const stateBanner = cmsData?.page || null;
  const announcements = stateBanner?.announcements || [];

  const handleEligibilityCheck = () => {
    if (!eligibilityForm.qualification && !eligibilityForm.age) {
      navigate("/eligible-jobs");
      return;
    }
    navigate("/eligible-jobs", { state: eligibilityForm });
  };

  const handleNewUser = () => {
    navigate("/jobs");
  };

  const handleLogin = () => {
    navigate("/check-status");
  };

  const handleGetHelp = () => {
    navigate("/help-center");
  };

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ["public-home-projects", selectedState],
    queryFn: () =>
      publicService.getActiveProjects({
        limit: 6,
        state: selectedState || undefined,
      }),
    staleTime: 15 * 1000,
  });

  const { data: statsData } = useQuery({
    queryKey: ["public-home-stats"],
    queryFn: jobService.getPublicStats,
    staleTime: 15 * 1000,
  });

  const activeProjects = projectsData?.projects || [];

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Not announced";

  const deadlineUpdates =
    statsData?.upcomingDeadlines?.map((job) => {
      const projectName = job.projectId?.name || job.department || "Recruitment";
      return `${job.title} under ${projectName} closes on ${formatDate(
        job.applicationDeadline,
      )}`;
    }) || [];

  const projectUpdates = activeProjects.map((project) => {
    const count = project.totalJobs || project.openJobs || 0;
    return `${project.name} has ${count} active ${
      count === 1 ? "job" : "jobs"
    } available`;
  });

  const latestUpdates = announcements.length
    ? announcements.map((item) => item.text || item.title).filter(Boolean)
    : [...deadlineUpdates, ...projectUpdates].filter(Boolean);

  const tickerItems = latestUpdates.length
    ? latestUpdates
    : ["No active public recruitment notices are published right now"];

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-122px)] bg-[#f3efe8]">
        <style>{`
          @keyframes portalTicker {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }

          .portal-ticker-track {
            animation: portalTicker 28s linear infinite;
          }

          .portal-ticker-track:hover {
            animation-play-state: paused;
          }

          @media (prefers-reduced-motion: reduce) {
            .portal-ticker-track {
              animation: none;
            }
          }
        `}</style>
        {/* HERO */}

        <section
          className="relative overflow-hidden bg-cover bg-center min-h-[560px] lg:min-h-[620px]"
          style={{
            backgroundImage: `url(${
              stateBanner?.bannerImage ? stateBanner.bannerImage : heroBg
            })`,
          }}
        >
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/78 via-black/44 to-black/22" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.2)_48%,rgba(0,0,0,0.62)_100%)]" />

          {/* â”€â”€ CMS State personalisation (tag + ticker) â”€â”€ */}
          {stateBanner && (
            <>
              {/* State tag top-left */}
              <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-orange-500/90 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                <MapPin className="w-3.5 h-3.5" />
                {stateBanner.state} â€” Personalised
              </div>

              {/* Announcements ticker â€” bottom of hero */}
              {announcements.length > 0 && (
                <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/70 backdrop-blur-sm border-t border-white/10">
                  <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-3 py-2">
                    <div className="flex items-center gap-2 shrink-0">
                      <Megaphone className="w-3.5 h-3.5 text-orange-400" />
                      <span className="text-orange-400 text-[10px] font-black uppercase tracking-widest">
                        {stateBanner.state}
                      </span>
                    </div>
                    <div className="relative min-w-0 flex-1 overflow-hidden">
                      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-black/70 to-transparent" />
                      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-black/70 to-transparent" />
                      <div className="portal-ticker-track flex w-max items-center gap-10 whitespace-nowrap text-xs font-semibold text-white/90">
                        {[...announcements, ...announcements].map((item, index) => (
                          <span
                            key={`${item.text || item.title || "announcement"}-${index}`}
                            className="inline-flex items-center gap-2"
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                            {item.text || item.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="relative mx-auto flex min-h-[560px] max-w-[1380px] items-center px-4 py-12 sm:px-6 lg:min-h-[620px] lg:px-8 lg:py-0">
            <div className="grid w-full grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_410px] xl:grid-cols-[minmax(0,1fr)_440px]">
              {/* LEFT */}

              <div className="max-w-[820px]">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className="mb-6 inline-flex items-center gap-2 rounded-full bg-orange-500/95 px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_30px_rgba(228,106,29,0.28)]"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Official Government Employment Gateway
                </motion.div>

                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="text-[30px] sm:text-[42px] lg:text-[48px] leading-[1.04] tracking-normal font-black text-white"
                >
                  {stateBanner?.heroTitle
                    ? stateBanner.heroTitle
                    : <>Your Career in Public Service<br />Starts Here.</>
                  }
                </motion.h1>

                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
                  className="mt-5 max-w-[560px] text-[13px] sm:text-[15px] leading-6 text-white/80"
                >
                  {stateBanner?.heroSubtitle ||
                    "Transparent, accessible, and reliable government job opportunities for every qualified citizen. Find your role today."}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                  className="mt-7 inline-flex items-center gap-2 text-orange-300 text-[12px] font-bold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Verified recruitment notices and secure candidate access
                </motion.div>
              </div>

              {/* FILTER CARD */}

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                className="h-fit overflow-hidden rounded-[8px] border border-white/15 bg-[#f8f5f0] shadow-[0_28px_60px_rgba(0,0,0,0.42)] lg:self-center"
              >
                <div className="border-b border-[#e3d9ce] px-6 py-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">
                    Start Here
                  </p>
                  <h3 className="mt-1.5 text-[22px] tracking-normal font-black text-[#1f1d1b]">
                    Smart Eligibility Filter
                  </h3>
                  <p className="mt-1.5 text-[13px] leading-5 text-[#6d6761]">
                    Match your profile with active public recruitment projects.
                  </p>
                </div>

                <div className="p-6 space-y-4">
                  {/* QUALIFICATION */}

                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-[#3f3b37] mb-2">
                      Qualification
                    </label>

                    <CustomSelect
                      value={eligibilityForm.qualification}
                      onChange={(val) =>
                        setEligibilityForm({ ...eligibilityForm, qualification: val })
                      }
                      options={[
                        { value: "", label: "Any Qualification" },
                        { value: "10th", label: "10th Pass" },
                        { value: "12th", label: "12th Pass" },
                        { value: "Graduation", label: "Graduation / Degree" },
                        { value: "Post Graduation", label: "Post Graduation" },
                      ]}
                      placeholder="Any Qualification"
                      className="rounded-[4px]"
                    />
                  </div>

                  {/* GRID */}

                  <div className="grid grid-cols-2 gap-4">
                    {/* AGE */}

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-[#3f3b37] mb-2">
                        Your Age
                      </label>

                      <input
                        type="number"
                        min="18"
                        max="60"
                        value={eligibilityForm.age}
                        onChange={(e) =>
                          setEligibilityForm({
                            ...eligibilityForm,
                            age: e.target.value,
                          })
                        }
                        placeholder="e.g. 25"
                        className="w-full h-[50px] rounded-[4px] border border-[#d7cfc6] bg-white px-4 text-[14px] text-[#272421] outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>

                    {/* CATEGORY */}

                    <div>
                      <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-[#3f3b37] mb-2">
                        Category
                      </label>

                      <CustomSelect
                        value={eligibilityForm.category}
                        onChange={(val) =>
                          setEligibilityForm({ ...eligibilityForm, category: val })
                        }
                        options={[
                          { value: "general", label: "General" },
                          { value: "obc", label: "OBC" },
                          { value: "sc", label: "SC" },
                          { value: "st", label: "ST" },
                          { value: "ews", label: "EWS" },
                          { value: "pwd", label: "PwD" },
                        ]}
                        placeholder="Select Category"
                        className="rounded-[4px]"
                      />
                    </div>
                  </div>

                  {/* BUTTON */}

                  <button
                    onClick={handleEligibilityCheck}
                    className="w-full h-[52px] bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] text-[12px] uppercase tracking-[0.12em] font-black transition-all flex items-center justify-center gap-2 shadow-[0_18px_35px_rgba(228,106,29,0.24)]"
                  >
                    <Search className="w-4 h-4" />
                    Check Eligible Jobs
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* NEWS BAR */}

        <div className="bg-[#111111] border-y border-[#2a2a2a]">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4 py-3 text-white text-[11px] uppercase tracking-[0.08em]">
              <span className="shrink-0 rounded-[4px] bg-[#e46a1d] px-4 py-2 text-white font-black">
                Latest Updates
              </span>

              <div className="relative min-w-0 flex-1 overflow-hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#111111] to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#111111] to-transparent" />
                <div className="portal-ticker-track flex w-max items-center gap-10 whitespace-nowrap text-white/85">
                  {[...tickerItems, ...tickerItems].map((update, index) => (
                    <span
                      key={`${update}-${index}`}
                      className="inline-flex items-center gap-3 font-bold"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                      {update}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS */}

        <section className="py-10 lg:py-12">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  icon: Users,
                  color: "text-[#4f6ef7]",
                  bg: "bg-[#eef2ff]",
                  title: "New User?",
                  desc: "Browse active recruitments and start with OTP verification.",
                  action: "View Openings",
                  onClick: handleNewUser,
                },
                {
                  icon: LogIn,
                  color: "text-[#19a452]",
                  bg: "bg-[#ecfff2]",
                  title: "Already Applied?",
                  desc: "Check status, download admit cards, and results.",
                  action: "Check Status",
                  onClick: handleLogin,
                },
                {
                  icon: CircleHelp,
                  color: "text-[#9257ff]",
                  bg: "bg-[#f3ecff]",
                  title: "Need Help?",
                  desc: "Get recruitment assistance and support resources.",
                  action: "Get Help",
                  onClick: handleGetHelp,
                },
              ].map((card, index) => (
                <motion.div
                  key={index}
                  custom={index}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  onClick={card.onClick}
                  className="h-full bg-white rounded-[8px] border border-[#e0d7cd] p-6 text-center cursor-pointer flex flex-col"
                >
                  <div
                    className={`w-14 h-14 rounded-full ${card.bg} flex items-center justify-center mx-auto`}
                  >
                    <card.icon className={`w-7 h-7 ${card.color}`} />
                  </div>
                  <h3 className="mt-5 text-[20px] tracking-[-0.5px] font-black text-[#1f1d1b]">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-[#6d6761] text-[14px] leading-7">
                    {card.desc}
                  </p>
                  <button className="mt-auto pt-5 text-[#e46a1d] text-[12px] uppercase tracking-[0.12em] font-black flex items-center gap-1.5 mx-auto">
                    {card.action}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* STATE DISCOVERY */}

        <section id="state-recruitments" className="pb-12">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="grid grid-cols-1 gap-5 lg:grid-cols-[420px_minmax(0,1fr)]"
            >
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-orange-600">
                  State Recruitment Hub
                </p>
                <h2 className="mt-3 text-[26px] font-black tracking-[-0.8px] text-[#1f1d1b]">
                  Choose your state to view official projects.
                </h2>
                <p className="mt-3 text-sm leading-7 text-[#6d6761]">
                  State pages show CMS-managed banners, notices, active projects,
                  and direct application links for candidates.
                </p>

                <div className="mt-6 space-y-3">
                  <CustomSelect
                    value={selectedState}
                    onChange={(val) => setSelectedState(val)}
                    options={[
                      { value: "", label: "All States" },
                      ...STATES.map((state) => ({ value: state, label: state })),
                    ]}
                    placeholder="Select state"
                    className="rounded-[4px]"
                  />
                  <button
                    onClick={() =>
                      selectedState
                        ? navigate(`/state/${toSlug(selectedState)}`)
                        : navigate("/eligible-jobs")
                    }
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-[4px] bg-[#e46a1d] text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-[#cb5d16]"
                  >
                    {selectedState ? "Open State Page" : "Browse All Jobs"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3">
                  {[
                    {
                      icon: ClipboardList,
                      label: "Application Status",
                      desc: "Track submitted forms",
                      to: "/check-status",
                    },
                    {
                      icon: BadgeCheck,
                      label: "Admit Card",
                      desc: "Download after release",
                      to: "/admit-cards",
                    },
                    {
                      icon: FileText,
                      label: "Results",
                      desc: "View published results",
                      to: "/results",
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={() => navigate(item.to)}
                      className="flex items-center gap-3 rounded-[6px] border border-[#eadfd4] bg-[#fffdfb] p-3 text-left transition-all hover:border-orange-300 hover:bg-[#fff7ef]"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-orange-50 text-orange-600">
                        <item.icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block text-sm font-black text-[#1f1d1b]">
                          {item.label}
                        </span>
                        <span className="block text-xs text-[#6d6761]">
                          {item.desc}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6">
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-[24px] font-black tracking-[-0.8px] text-[#1f1d1b]">
                      Active Recruitment Projects
                    </h2>
                    <p className="mt-1 text-sm text-[#6d6761]">
                      {selectedState
                        ? `Showing active projects for ${selectedState}`
                        : "Showing latest active projects across states"}
                    </p>
                  </div>
                  {selectedState && (
                    <button
                      onClick={() => navigate(`/state/${toSlug(selectedState)}`)}
                      className="text-xs font-black uppercase tracking-[0.12em] text-[#e46a1d] hover:text-[#bf5514]"
                    >
                      View State Page
                    </button>
                  )}
                </div>

                {projectsLoading && (
                  <div className="rounded-[6px] bg-[#faf7f2] p-5 text-sm text-[#6d6761]">
                    Loading projects...
                  </div>
                )}

                {!projectsLoading && activeProjects.length === 0 && (
                  <div className="rounded-[6px] bg-[#faf7f2] p-5 text-sm text-[#6d6761]">
                    No active recruitment projects are published right now.
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {activeProjects.map((project) => (
                    <button
                      key={project._id}
                      onClick={() => navigate(`/apply/${project.publicSlug}`)}
                      className="group rounded-[6px] border border-[#eadfd4] bg-[#fffdfb] p-4 text-left transition-all hover:border-orange-300 hover:bg-[#fff7ef]"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[4px] bg-orange-50 text-orange-600">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 text-base font-black leading-tight text-[#1f1d1b]">
                            {project.name}
                          </h3>
                          <p className="mt-1 text-xs text-[#6d6761]">
                            {project.state} · {project.department}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                        <span className="flex items-center gap-1.5 text-[#6d6761]">
                          <Briefcase className="h-3.5 w-3.5 text-orange-600" />
                          {project.totalJobs || 0} jobs
                        </span>
                        <span className="flex items-center gap-1.5 text-[#6d6761]">
                          <Calendar className="h-3.5 w-3.5 text-orange-600" />
                          {formatDate(project.nearestDeadline || project.endDate)}
                        </span>
                      </div>
                      <span className="mt-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[#e46a1d] group-hover:gap-3">
                        Open Project
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* HELPLINE */}

        <section className="pb-12">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="bg-[#e46a1d] rounded-[8px] px-6 py-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 text-white"
            >
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center">
                  <Phone className="w-7 h-7" />
                </div>

                <div>
                  <p className="uppercase tracking-[0.12em] text-[10px] font-black text-orange-100">
                    Technical Support Helpline
                  </p>

                  <p className="mt-2 text-orange-100 text-[14px]">
                    Monday to Friday, 9:00 AM to 6:00 PM
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="uppercase tracking-[0.12em] text-[10px] font-black text-orange-100">
                  Toll Free Number
                </p>

                <h3 className="mt-2 text-[34px] tracking-[-1px] font-black">
                  1800-123-4567
                </h3>
              </div>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}

        <section className="pb-14">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.1 }}
              className="bg-white rounded-[8px] border border-[#e0d7cd] overflow-hidden"
            >
              {/* HEADER */}

              <div className="px-7 py-6 border-b border-[#ebe2d8]">
                <h2 className="text-[26px] tracking-[-1px] font-black text-[#1f1d1b]">
                  Frequently Asked Questions
                </h2>
              </div>

              {/* ITEMS */}

              {[
                {
                  q: "How do I verify my eligibility for multiple posts?",
                  a: "Use the Smart Eligibility Filter to enter your qualification, age, and category, or open your state recruitment page to review active projects and their published jobs.",
                },
                {
                  q: "Can I edit my application after submission?",
                  a: "Once submitted, applications cannot be edited. Please review all details carefully before final submission. You can save a draft and return to complete it before the deadline.",
                },
                {
                  q: "What documents are mandatory for registration?",
                  a: "You will need a valid photo ID (Aadhaar/PAN), educational certificates, caste certificate (if applicable), passport-size photograph, and signature scan. Specific posts may require additional documents.",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="border-b border-[#ebe2d8] last:border-0"
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    className="w-full px-7 py-5 flex items-center justify-between hover:bg-[#faf7f2] transition-all text-left"
                  >
                    <span className="text-[#2a2724] text-[14px] font-medium">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: openFaq === index ? 180 : 0 }}
                      transition={{ duration: 0.25 }}
                      className="flex-shrink-0 ml-4"
                    >
                      <ChevronDown className="w-5 h-5 text-[#8a8179]" />
                    </motion.span>
                  </button>
                  <motion.div
                    initial={false}
                    animate={{
                      height: openFaq === index ? "auto" : 0,
                      opacity: openFaq === index ? 1 : 0,
                    }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-7 pb-5 text-[#6d6761] text-[14px] leading-7">
                      {item.a}
                    </p>
                  </motion.div>
                </div>
              ))}
            </motion.div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
};

export default Home;


