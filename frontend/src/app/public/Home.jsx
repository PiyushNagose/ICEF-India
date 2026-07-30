import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

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
} from "lucide-react";

import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import PublicLayout from "../../components/layouts/PublicLayout";
import heroBg from "../../assets/herobg.jpg";
import { jobService } from "../../services/job.service";
import { getStoredUser } from "../../services/auth.service";
import { getDashboardPath, isAdminUser, isCandidateUser } from "../../hooks/useAuth";
import CustomSelect from "../../components/ui/CustomSelect";
import ShareJobButton from "../../components/ui/ShareJobButton";

// Reusable fade-up variant for scroll sections
const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};

const Home = () => {
  const navigate = useNavigate();

  const [eligibilityForm, setEligibilityForm] = useState({
    qualification: "",
    age: "",
    category: "general",
  });

  const [openFaq, setOpenFaq] = useState(null);
  const [tickerIdx, setTickerIdx] = useState(0);

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

  // Apply Now â€” redirect to login if not logged in as candidate
  const handleApplyNow = (jobId) => {
    const user = getStoredUser();
    if (isCandidateUser(user)) {
      navigate(`/candidate/jobs/${jobId}`);
    } else if (isAdminUser(user)) {
      navigate("/admin/dashboard");
    } else {
      navigate("/auth/candidate-login", {
        state: { jobId, redirectTo: `/candidate/jobs/${jobId}` },
      });
    }
  };

  const handleNewUser = () => {
    const user = getStoredUser();
    if (user) {
      navigate(getDashboardPath(user));
    } else {
      navigate("/auth/register");
    }
  };

  const handleLogin = () => {
    const user = getStoredUser();
    if (user) {
      navigate(getDashboardPath(user));
    } else {
      navigate("/auth/candidate-login");
    }
  };

  const handleGetHelp = () => {
    navigate("/help-center");
  };

  const { data: jobsData, isLoading: jobsLoading } = useQuery({
    queryKey: ["public-featured-jobs"],
    queryFn: () =>
      jobService.getPublicJobs({
        limit: 2,
        sortBy: "publishedAt",
        sortOrder: "desc",
      }),
  });

  const featuredJobs = jobsData?.jobs || [];

  const formatDate = (date) =>
    date
      ? new Date(date).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "Not announced";

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-122px)] bg-[#f3efe8]">
        {/* HERO */}

        <section
          className="relative bg-cover bg-center overflow-hidden min-h-[560px] lg:min-h-[calc(100vh-110px)]"
          style={{
            backgroundImage: `url(${
              stateBanner?.bannerImage ? stateBanner.bannerImage : heroBg
            })`,
          }}
        >
          {/* OVERLAY â€” lighter when CMS image is set so it shows clearly */}
          <div className={`absolute inset-0 ${stateBanner?.bannerImage ? 'bg-black/35' : 'bg-black/55'}`} />
          <div className={`absolute inset-0 bg-gradient-to-r ${stateBanner?.bannerImage ? 'from-black/50 via-black/20 to-transparent' : 'from-black/70 via-black/40 to-black/20'}`} />

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
                    <div className="flex-1 overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.p
                          key={tickerIdx}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          onAnimationComplete={() => {
                            setTimeout(() => {
                              setTickerIdx((i) => (i + 1) % announcements.length);
                            }, 3500);
                          }}
                          className="text-white/90 text-xs truncate"
                        >
                          {announcements[tickerIdx % announcements.length]?.text}
                        </motion.p>
                      </AnimatePresence>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {announcements.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setTickerIdx(i)}
                          className={`w-1.5 h-1.5 rounded-full transition-colors ${
                            i === tickerIdx % announcements.length
                              ? 'bg-orange-400'
                              : 'bg-white/30'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="relative max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8 lg:gap-10 items-center lg:min-h-[calc(100vh-220px)]">
              {/* LEFT */}

              <div className="max-w-[760px] flex flex-col gap-8 lg:gap-[3.25rem] xl:gap-14 lg:self-center">
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.7, ease: "easeOut" }}
                  className="text-[28px] sm:text-[42px] lg:text-[44px] xl:text-[48px] leading-[1.02] tracking-[-1.5px] font-black text-white"
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
                  className="text-[13px] sm:text-[15px] leading-6 text-white/80 max-w-[560px]"
                >
                  {stateBanner?.heroSubtitle ||
                    "Transparent, accessible, and reliable government job opportunities for every qualified citizen. Find your role today."}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                  className="inline-flex items-center gap-2 text-orange-300 text-[12px] font-bold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Official Government Employment Gateway
                </motion.div>
              </div>

              {/* FILTER CARD */}

              <motion.div
                initial={{ opacity: 0, x: 40 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.7, ease: "easeOut", delay: 0.2 }}
                className="h-fit lg:self-center bg-[#f8f5f0] rounded-[6px] border border-[#d8d0c6] shadow-[0_25px_50px_rgba(0,0,0,0.35)] overflow-hidden"
              >
                <div className="px-6 pt-6">
                  <h3 className="text-[20px] tracking-[-0.5px] font-black text-[#1f1d1b]">
                    Smart Eligibility Filter
                  </h3>
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
                        className="w-full h-[48px] rounded-[4px] border border-[#d7cfc6] bg-white px-4 text-[13px] text-[#272421] outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full h-[52px] bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] text-[12px] uppercase tracking-[0.12em] font-black transition-all flex items-center justify-center gap-2"
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
            <div className="flex flex-col lg:flex-row lg:items-center gap-3 py-2.5 text-white text-[11px] uppercase tracking-[0.08em]">
              <span className="bg-[#e46a1d] px-3 py-1 rounded text-white font-black w-fit">
                Latest Updates
              </span>

              <div className="flex flex-wrap items-center gap-6 text-white/80">
                <span>
                  Admit Card for Assistant Manager Exam 2026 now available
                </span>

                <span>
                  Junior Engineer application extended till 30th October
                </span>
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
                  desc: "Create your profile and apply to multiple openings.",
                  action: "Register Now",
                  onClick: handleNewUser,
                },
                {
                  icon: LogIn,
                  color: "text-[#19a452]",
                  bg: "bg-[#ecfff2]",
                  title: "Already Applied?",
                  desc: "Check status, download admit cards, and results.",
                  action: "Login Here",
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

        {/* FEATURED JOBS */}

        <section className="pb-12">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            {/* HEADER */}

            <motion.div
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6"
            >
              <div>
                <h2 className="text-[28px] font-black tracking-[-1px] text-[#1f1d1b]">
                  Featured Opportunities
                </h2>

                <p className="mt-2 text-[#6d6761] text-[14px]">
                  Handpicked active recruitment notices
                </p>
              </div>

              <button
                onClick={() => navigate("/jobs")}
                className="hidden sm:flex items-center gap-2 text-[#e46a1d] text-[12px] uppercase tracking-[0.12em] font-black hover:gap-3 transition-all"
              >
                View All Openings
                <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            {/* CARDS */}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
              {jobsLoading && (
                <div className="col-span-full bg-white rounded-[8px] border border-[#e0d7cd] p-6 text-[#6d6761]">
                  Loading active opportunities...
                </div>
              )}

              {!jobsLoading && featuredJobs.length === 0 && (
                <div className="col-span-full bg-white rounded-[8px] border border-[#e0d7cd] p-6 text-[#6d6761]">
                  No active job opportunities are published right now.
                </div>
              )}

              {featuredJobs.map((job, index) => (
                <motion.div
                  key={job._id}
                  custom={index}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.15 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="h-full bg-white rounded-[8px] border border-[#e0d7cd] p-6 flex flex-col"
                >
                  {/* TOP */}

                  <div className="flex items-center justify-between mb-5">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.12em] font-black ${
                        (job.daysLeft || 0) > 7
                          ? "bg-[#e8fff0] text-[#13984b]"
                          : "bg-[#fff4df] text-[#c28500]"
                      }`}
                    >
                      {(job.daysLeft || 0) > 7 ? "ACTIVE" : "CLOSING SOON"}
                    </span>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#857d77]">
                        Ref. No: {job.postCode || "N/A"}
                      </span>
                      <ShareJobButton job={job} />
                    </div>
                  </div>

                  {/* TITLE */}

                  <h3 className="text-[22px] tracking-[-0.5px] font-black text-[#1f1d1b]">
                    {job.title}
                  </h3>

                  <p className="mt-2 text-[#6d6761] text-[14px]">
                    {job.department}
                  </p>

                  {/* STATS */}

                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8179] font-black">
                        Vacancies
                      </div>

                      <div className="mt-2 text-[#1f1d1b] font-black text-[14px]">
                        {job.totalPosts || 0}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8179] font-black">
                        Fee
                      </div>

                      <div className="mt-2 text-[#1f1d1b] font-black text-[14px]">
                        {(
                          job.applicationFee?.general ||
                          job.applicationFee?.amount ||
                          0
                        ).toLocaleString("en-IN")}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-[0.12em] text-[#8a8179] font-black">
                        Last Date
                      </div>

                      <div className="mt-2 text-[#d85f14] font-black text-[14px]">
                        {formatDate(job.applicationDeadline)}
                      </div>
                    </div>
                  </div>

                  {/* BUTTONS */}

                  <div className="flex gap-4 mt-auto pt-7">
                    <button
                      onClick={() => navigate(`/jobs/${job._id}`)}
                      className="flex-1 h-[46px] border border-[#e0d7cd] hover:bg-[#f6f1ea] text-[#1f1d1b] rounded-[4px] uppercase tracking-[0.12em] text-[11px] font-black transition-all"
                    >
                      View Details
                    </button>

                    <button
                      onClick={() => handleApplyNow(job._id)}
                      className="flex-1 h-[46px] bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[4px] uppercase tracking-[0.12em] text-[11px] font-black transition-all"
                    >
                      Apply Now
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
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
                  a: "Use the Smart Eligibility Filter on this page to enter your qualification, age, and category. The system will show all matching job openings you are eligible to apply for.",
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


