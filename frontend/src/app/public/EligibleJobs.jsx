import { useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Search,
  Filter,
  ChevronDown,
  MapPin,
  Calendar,
  Users,
  IndianRupee,
  ArrowRight,
  AlertCircle,
  Loader,
  X,
  SlidersHorizontal,
  Briefcase,
} from "lucide-react";

import PublicLayout from "../../components/layouts/PublicLayout";
import CustomSelect from "../../components/ui/CustomSelect";
import { jobService } from "../../services/job.service";
import { getJobAvailability } from "../../utils/jobAvailability";

// -- Indian states list --------------------------------------------------------
const INDIAN_STATES = [
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
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

const QUALIFICATION_OPTIONS = [
  { value: "", label: "All Levels" },
  { value: "10th", label: "10th Pass" },
  { value: "12th", label: "12th Pass" },
  { value: "Graduation", label: "Graduation" },
  { value: "Post Graduation", label: "Post Graduation" },
];

const CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "obc", label: "OBC" },
  { value: "sc", label: "SC" },
  { value: "st", label: "ST" },
  { value: "ews", label: "EWS" },
  { value: "pwd", label: "PWD" },
];

const STATE_OPTIONS = [
  { value: "", label: "All States" },
  ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
];

// -- Animation variants --------------------------------------------------------
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// -- Helper: days-left badge colour -------------------------------------------
const deadlineBadge = (daysLeft) => {
  if (daysLeft === null || daysLeft === undefined)
    return { bg: "bg-gray-100", text: "text-gray-500", label: "No deadline" };
  if (daysLeft <= 0)
    return { bg: "bg-red-100", text: "text-red-600", label: "Closed" };
  if (daysLeft <= 7)
    return {
      bg: "bg-amber-100",
      text: "text-amber-700",
      label: `${daysLeft}d left`,
    };
  return {
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: `${daysLeft}d left`,
  };
};

// -- Main component ------------------------------------------------------------
const EligibleJobs = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFilters = location.state || {};

  const [filters, setFilters] = useState({
    qualification: initialFilters.qualification || "",
    age: initialFilters.age || "",
    category: initialFilters.category || "general",
    state: "",
    department: "",
    search: "",
    page: 1,
    limit: 12,
  });

  const [showFilters, setShowFilters] = useState(false);

  // -- Fetch eligible jobs ---------------------------------------------------
  const {
    data: jobsData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["eligible-jobs", filters],
    queryFn: () =>
      jobService.getEligibleJobs({
        q: filters.search || undefined,
        qualification: filters.qualification || undefined,
        age: filters.age ? String(filters.age) : undefined,
        candidateCategory: filters.category,
        department: filters.department || undefined,
        state: filters.state || undefined,
        page: filters.page,
        limit: filters.limit,
      }),
    staleTime: 5 * 60 * 1000,
    keepPreviousData: true,
  });

  // -- Fetch departments -----------------------------------------------------
  const { data: departmentsData } = useQuery({
    queryKey: ["departments"],
    queryFn: () => jobService.getDepartments(),
    staleTime: 30 * 60 * 1000,
  });

  const jobs = jobsData?.jobs || [];
  const pagination = jobsData?.pagination || {};
  const departments = departmentsData?.departments || [];

  const departmentOptions = [
    { value: "", label: "All Departments" },
    ...departments.map((d) => ({ value: d, label: d })),
  ];

  // -- Handlers --------------------------------------------------------------
  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleApplyNow = (job) => {
    const slug = job?.projectId?.publicSlug;
    navigate(slug ? `/apply/${slug}/start?jobId=${job._id}` : `/jobs/${job._id}`);
  };

  const handleViewDetails = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  const handlePageChange = (newPage) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleResetFilters = () => {
    setFilters({
      qualification: "",
      age: "",
      category: "general",
      state: "",
      department: "",
      search: "",
      page: 1,
      limit: 12,
    });
  };

  // -- Computed --------------------------------------------------------------
  const hasActiveFilters = useMemo(
    () =>
      filters.qualification ||
      filters.age ||
      filters.category !== "general" ||
      filters.state ||
      filters.department ||
      filters.search,
    [filters],
  );

  const totalPages = pagination.totalPages || 1;
  const currentPage = pagination.currentPage || 1;

  // -- Render ----------------------------------------------------------------
  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-122px)] bg-[#f3efe8]">
        {/* -- Page Header ---------------------------------------------------- */}
        <div className="relative overflow-hidden bg-[#1f1d1b] text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(228,106,29,0.22),transparent_34%),linear-gradient(90deg,rgba(0,0,0,0.05),rgba(0,0,0,0.28))]" />
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="relative py-10 lg:py-12"
            >
              <p className="text-[10px] font-black tracking-[0.24em] text-orange-400 mb-3 uppercase">
                Smart Eligibility Filter
              </p>
              <h1 className="max-w-[720px] text-[30px] sm:text-[42px] lg:text-[48px] leading-[1.04] font-black tracking-normal">
                Eligible Jobs for You
              </h1>
              <p className="mt-4 max-w-[560px] text-[13px] sm:text-[15px] leading-6 text-white/80">
                {isLoading
                  ? "Searching matching opportunities..."
                  : jobs.length > 0
                    ? `Found ${pagination.totalItems ?? jobs.length} job${(pagination.totalItems ?? jobs.length) !== 1 ? "s" : ""} matching your criteria`
                    : "No jobs found — try adjusting your filters"}
              </p>
            </motion.div>
          </div>
        </div>

        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          {/* -- Filter Panel ----------------------------------------------- */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-[8px] border border-[#ded4c8] shadow-[0_10px_24px_rgba(31,29,27,0.06)] mb-7 overflow-hidden"
          >
            {/* Filter header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebe2d8] bg-[#fffdf9]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                <span className="text-[15px] font-black text-[#1f1d1b]">
                  Filters
                </span>
                {hasActiveFilters && (
                  <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2.5 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 text-xs font-bold text-[#6d6761] hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
                {/* Mobile toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden flex items-center gap-1.5 text-xs font-bold text-orange-700 border border-orange-200 px-3 py-1.5 rounded-[6px]"
                >
                  <Filter size={14} />
                  {showFilters ? "Hide" : "Show"}
                  <ChevronDown
                    size={14}
                    className={`transition-transform ${showFilters ? "rotate-180" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Filter grid */}
            <div className={`p-5 ${!showFilters ? "hidden md:block" : ""}`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-12 gap-4">
                {/* Search */}
                <div className="xl:col-span-4">
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    Search
                  </label>
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      placeholder="Job title, post code..."
                      value={filters.search}
                      onChange={(e) =>
                        handleFilterChange("search", e.target.value)
                      }
                      className="w-full h-12 pl-9 pr-4 border border-[#d8d0c6] rounded-[6px] text-[14px] text-[#1f1d1b] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition bg-white placeholder:text-[#9aa1ae]"
                    />
                  </div>
                </div>

                {/* Qualification */}
                <div className="xl:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    Qualification
                  </label>
                  <CustomSelect
                    value={filters.qualification}
                    onChange={(val) => handleFilterChange("qualification", val)}
                    options={QUALIFICATION_OPTIONS}
                    placeholder="All Levels"
                  />
                </div>

                {/* Age */}
                <div className="xl:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    Your Age
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 28"
                    value={filters.age}
                    onChange={(e) => handleFilterChange("age", e.target.value)}
                    min="18"
                    max="65"
                    className="w-full h-12 px-4 border border-[#d8d0c6] rounded-[6px] text-[14px] text-[#1f1d1b] focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition bg-white placeholder:text-[#9aa1ae]"
                  />
                </div>

                {/* Category */}
                <div className="xl:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    Category
                  </label>
                  <CustomSelect
                    value={filters.category}
                    onChange={(val) => handleFilterChange("category", val)}
                    options={CATEGORY_OPTIONS}
                    placeholder="Select Category"
                  />
                </div>

                {/* State */}
                <div className="xl:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    State
                  </label>
                  <CustomSelect
                    value={filters.state}
                    onChange={(val) => handleFilterChange("state", val)}
                    options={STATE_OPTIONS}
                    placeholder="All States"
                  />
                </div>
              </div>

              {/* Second row — Department */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.14em] font-black text-[#6d6761] mb-2">
                    Department
                  </label>
                  <CustomSelect
                    value={filters.department}
                    onChange={(val) => handleFilterChange("department", val)}
                    options={departmentOptions}
                    placeholder="All Departments"
                  />
                </div>
              </div>
            </div>
          </motion.div>

          {/* -- Loading ----------------------------------------------------- */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader size={40} className="text-orange-500 animate-spin mb-4" />
              <p className="text-[#6d6761] text-sm font-medium">
                Loading eligible jobs...
              </p>
            </div>
          )}

          {/* -- Error ------------------------------------------------------- */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-[12px] p-6 flex items-start gap-4"
            >
              <AlertCircle
                size={22}
                className="text-red-600 flex-shrink-0 mt-0.5"
              />
              <div>
                <h3 className="font-bold text-red-900 mb-1">
                  Error Loading Jobs
                </h3>
                <p className="text-red-700 text-sm">
                  {error.message ||
                    "Failed to load eligible jobs. Please try again."}
                </p>
              </div>
            </motion.div>
          )}

          {/* -- Empty State ------------------------------------------------- */}
          {!isLoading && !error && jobs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[8px] border border-[#ded4c8] p-8 sm:p-10 text-center"
            >
              <AlertCircle size={44} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-black text-[#1f1d1b] mb-2">
                No Jobs Found
              </h3>
              <p className="text-[#6d6761] text-sm mb-6 max-w-sm mx-auto">
                We couldn't find any jobs matching your criteria. Try adjusting
                your filters or check back later.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-6 h-11 bg-[#e46a1d] hover:bg-[#cb5d16] text-white text-sm font-black rounded-[6px] transition-colors"
              >
                Clear Filters
              </button>
            </motion.div>
          )}

          {/* -- Jobs Grid --------------------------------------------------- */}
          {!isLoading && !error && jobs.length > 0 && (
            <>
              <motion.div
                variants={containerVariants}
                initial="hidden"
                animate="visible"
                className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6 items-stretch"
              >
                {jobs.map((job) => {
                  const availability = getJobAvailability(job);
                  const badge = deadlineBadge(availability.daysLeft ?? job.daysLeft);
                  const feeLabel =
                    job.applicableFee === 0
                      ? "Free"
                      : `₹${Number(job.applicableFee || 0).toLocaleString("en-IN")}`;
                  return (
                    <motion.div
                      key={job._id}
                      variants={itemVariants}
                      className="group h-full min-h-[332px] bg-white rounded-[8px] border border-[#ded4c8] hover:border-orange-300 hover:shadow-[0_18px_38px_rgba(31,29,27,0.10)] hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
                    >
                      <div className="flex h-full flex-col p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-orange-50 text-orange-600">
                            <Briefcase className="h-5 w-5" />
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ${badge.bg} ${badge.text}`}
                          >
                            {badge.label}
                          </span>
                        </div>

                        <div className="mt-4 min-h-[82px]">
                          <h3 className="min-h-[48px] text-[20px] font-black leading-tight tracking-normal text-[#1f1d1b] line-clamp-2">
                            {job.title}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] text-orange-600">
                              {job.postCode || "Ref. not assigned"}
                            </span>
                            {job.category && (
                              <span className="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700">
                                {job.category}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 min-h-[40px]">
                          <p className="line-clamp-2 text-[14px] leading-5 text-[#6d6761]">
                            {job.department || "Department not specified"}
                          </p>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-3 text-[13px]">
                          <div className="rounded-[6px] bg-[#faf7f2] p-2.5">
                            <div className="flex items-center gap-1.5 text-orange-600">
                              <Users size={14} />
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6d6761]">
                                Vacancies
                              </span>
                            </div>
                            <p className="mt-2 font-black text-[#1f1d1b]">
                              {job.totalPosts || 0}
                            </p>
                          </div>

                          <div className="rounded-[6px] bg-[#faf7f2] p-2.5">
                            <div className="flex items-center gap-1.5 text-orange-600">
                              <IndianRupee size={14} />
                              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6d6761]">
                                Fee
                              </span>
                            </div>
                            <p
                              className={`mt-2 font-black ${
                                job.applicableFee === 0
                                  ? "text-emerald-700"
                                  : "text-[#1f1d1b]"
                              }`}
                            >
                              {feeLabel}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-1.5 text-[13px] text-[#4b4744]">
                          <div className="flex items-center gap-2">
                            <MapPin
                              size={15}
                              className="shrink-0 text-orange-600"
                            />
                            <span className="truncate">
                              {job.workLocation || job.state || "Location not specified"}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar
                              size={15}
                              className="shrink-0 text-orange-600"
                            />
                            <span>
                              {availability.canApply && availability.daysLeft !== null
                                ? `${availability.daysLeft} days left`
                                : availability.label}
                            </span>
                          </div>
                        </div>

                        <div className="mt-auto grid grid-cols-2 gap-3 border-t border-[#eee6dc] pt-3">
                          <button
                            onClick={() => handleViewDetails(job._id)}
                            className="flex h-10 items-center justify-center gap-2 rounded-[6px] border border-[#ded4c8] bg-white text-[12px] font-black uppercase tracking-[0.12em] text-[#1f1d1b] transition-colors hover:border-orange-400 hover:text-orange-700"
                          >
                            Details
                            <ArrowRight size={14} />
                          </button>
                          <button
                            onClick={() => handleApplyNow(job)}
                            disabled={!availability.canApply}
                            className="h-10 rounded-[6px] bg-[#e86a1a] text-[12px] font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_28px_rgba(232,106,26,0.22)] transition-colors hover:bg-[#cf5d15] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"
                          >
                            {availability.canApply ? "Apply Now" : availability.label}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* -- Pagination -------------------------------------------- */}
              {totalPages > 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-center gap-2 mb-8"
                >
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 border border-[#e0d7cd] rounded-[6px] text-sm font-semibold text-[#1f1d1b] hover:bg-[#f6f1ea] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    (page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`w-9 h-9 rounded-[6px] text-sm font-bold transition-colors ${
                          page === currentPage
                            ? "bg-[#e46a1d] text-white"
                            : "border border-[#e0d7cd] text-[#1f1d1b] hover:bg-[#f6f1ea]"
                        }`}
                      >
                        {page}
                      </button>
                    ),
                  )}

                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 border border-[#e0d7cd] rounded-[6px] text-sm font-semibold text-[#1f1d1b] hover:bg-[#f6f1ea] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </motion.div>
              )}
            </>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default EligibleJobs;
