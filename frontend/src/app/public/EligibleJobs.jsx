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
} from "lucide-react";

import PublicLayout from "../../components/layouts/PublicLayout";
import CustomSelect from "../../components/ui/CustomSelect";
import { jobService } from "../../services/job.service";
import { getStoredUser } from "../../services/auth.service";

// -- Indian states list --------------------------------------------------------
const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
  "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
  "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
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
    return { bg: "bg-amber-100", text: "text-amber-700", label: `${daysLeft}d left` };
  return { bg: "bg-emerald-100", text: "text-emerald-700", label: `${daysLeft}d left` };
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

  const handleApplyNow = (jobId) => {
    const user = getStoredUser();
    if (user && user.role === "candidate") {
      navigate(`/candidate/jobs/${jobId}`);
    } else {
      navigate("/auth/candidate-login", {
        state: { jobId, redirectTo: `/candidate/jobs/${jobId}` },
      });
    }
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
        <div className="bg-[#1f1d1b] text-white py-8 lg:py-10">
          <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <p className="text-[10px] font-black tracking-[0.2em] text-orange-400 mb-2 uppercase">
                Smart Eligibility Filter
              </p>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
                Eligible Jobs for You
              </h1>
              <p className="mt-2 text-white/60 text-sm">
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
            className="bg-white rounded-[12px] border border-[#e0d7cd] shadow-sm mb-6 overflow-hidden"
          >
            {/* Filter header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#ebe2d8]">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-bold text-[#1f1d1b]">Filters</span>
                {hasActiveFilters && (
                  <span className="bg-orange-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                    Active
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {hasActiveFilters && (
                  <button
                    onClick={handleResetFilters}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reset
                  </button>
                )}
                {/* Mobile toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="md:hidden flex items-center gap-1.5 text-xs font-semibold text-orange-600 border border-orange-200 px-3 py-1.5 rounded-lg"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">

                {/* Search */}
                <div className="xl:col-span-2">
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
                    Search
                  </label>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Job title, post code..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange("search", e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition bg-white"
                    />
                  </div>
                </div>

                {/* Qualification */}
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
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
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
                    Your Age
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 28"
                    value={filters.age}
                    onChange={(e) => handleFilterChange("age", e.target.value)}
                    min="18"
                    max="65"
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition bg-white"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
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
                <div>
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
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
                  <label className="block text-[10px] uppercase tracking-[0.12em] font-black text-gray-500 mb-1.5">
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
              <p className="text-[#6d6761] text-sm font-medium">Loading eligible jobs...</p>
            </div>
          )}

          {/* -- Error ------------------------------------------------------- */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 rounded-[12px] p-6 flex items-start gap-4"
            >
              <AlertCircle size={22} className="text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-1">Error Loading Jobs</h3>
                <p className="text-red-700 text-sm">
                  {error.message || "Failed to load eligible jobs. Please try again."}
                </p>
              </div>
            </motion.div>
          )}

          {/* -- Empty State ------------------------------------------------- */}
          {!isLoading && !error && jobs.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[12px] border border-[#e0d7cd] p-8 sm:p-10 text-center"
            >
              <AlertCircle size={44} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-black text-[#1f1d1b] mb-2">No Jobs Found</h3>
              <p className="text-[#6d6761] text-sm mb-6 max-w-sm mx-auto">
                We couldn't find any jobs matching your criteria. Try adjusting your filters or check back later.
              </p>
              <button
                onClick={handleResetFilters}
                className="px-6 py-2.5 bg-[#e46a1d] hover:bg-[#cb5d16] text-white text-sm font-bold rounded-[6px] transition-colors"
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
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-6 items-stretch"
              >
                {jobs.map((job) => {
                  const badge = deadlineBadge(job.daysLeft);
                  return (
                    <motion.div
                      key={job._id}
                      variants={itemVariants}
                      className="h-full bg-white rounded-[10px] border border-[#e0d7cd] hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col"
                    >
                      {/* Card header */}
                      <div className="bg-gradient-to-r from-[#1f1d1b] to-[#3a3530] p-4 text-white">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h3 className="text-[15px] font-black leading-tight line-clamp-2">
                            {job.title}
                          </h3>
                          <span className={`flex-shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/60 font-medium">{job.postCode}</p>
                      </div>

                      {/* Card body */}
                      <div className="p-4 space-y-2.5 flex-1">
                        {/* Dept + category */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#6d6761] font-medium truncate max-w-[60%]">
                            {job.department}
                          </span>
                          <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold">
                            {job.category}
                          </span>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-[#6d6761]">
                          <MapPin size={13} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs truncate">{job.workLocation || "Not specified"}</span>
                        </div>

                        {/* Vacancies */}
                        <div className="flex items-center gap-1.5 text-[#6d6761]">
                          <Users size={13} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs">
                            <strong className="text-[#1f1d1b]">{job.totalPosts}</strong> Vacancies
                          </span>
                        </div>

                        {/* Salary */}
                        {job.salaryRange?.min && job.salaryRange?.max && (
                          <div className="flex items-center gap-1.5 text-[#6d6761]">
                            <IndianRupee size={13} className="text-orange-500 flex-shrink-0" />
                            <span className="text-xs">
                              ?{job.salaryRange.min.toLocaleString("en-IN")} –{" "}
                              ?{job.salaryRange.max.toLocaleString("en-IN")}
                            </span>
                          </div>
                        )}

                        {/* Fee */}
                        <div className="flex items-center gap-1.5">
                          <IndianRupee size={13} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs">
                            Fee:{" "}
                            <strong className={job.applicableFee === 0 ? "text-emerald-600" : "text-[#1f1d1b]"}>
                              {job.applicableFee === 0 ? "Free" : `?${job.applicableFee}`}
                            </strong>
                          </span>
                        </div>

                        {/* Deadline */}
                        <div className="flex items-center gap-1.5 text-[#6d6761]">
                          <Calendar size={13} className="text-orange-500 flex-shrink-0" />
                          <span className="text-xs">
                            {job.daysLeft !== null && job.daysLeft > 0 ? (
                              <>
                                <strong className="text-[#1f1d1b]">{job.daysLeft}</strong> days left
                              </>
                            ) : (
                              "Deadline passed"
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Card footer */}
                      <div className="px-4 pb-4 flex gap-2 mt-auto">
                        <button
                          onClick={() => handleViewDetails(job._id)}
                          className="flex-1 h-9 border border-[#e0d7cd] hover:bg-[#f6f1ea] text-[#1f1d1b] rounded-[6px] text-[11px] uppercase tracking-[0.1em] font-black transition-colors flex items-center justify-center gap-1.5"
                        >
                          Details
                          <ArrowRight size={12} />
                        </button>
                        <button
                          onClick={() => handleApplyNow(job._id)}
                          disabled={job.daysLeft <= 0}
                          className="flex-1 h-9 bg-[#e46a1d] hover:bg-[#cb5d16] text-white rounded-[6px] text-[11px] uppercase tracking-[0.1em] font-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          Apply Now
                        </button>
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

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
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
                  ))}

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


