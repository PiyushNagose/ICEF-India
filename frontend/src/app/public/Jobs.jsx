import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Briefcase,
  Calendar,
  MapPin,
  Search,
  Users,
  IndianRupee,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  PlayCircle,
  Filter,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import PublicLayout from "../../components/layouts/PublicLayout";
import { publicContainer } from "./PublicPageShell";
import { jobService } from "../../services/job.service";
import { candidateService } from "../../services/candidate.service";
import { applicationService } from "../../services/application.service";
import { useAuth, isCandidateUser } from "../../hooks/useAuth";
import {
  getFirstApplicationRoute,
  getRouteForApplicationStep,
  persistApplicationDraft,
} from "../../utils/applicationFlow";
import ShareJobButton from "../../components/ui/ShareJobButton";

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const daysLeft = (deadline) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "â€”";

const DaysChip = ({ deadline }) => {
  const days = daysLeft(deadline);
  if (days === null) return null;
  if (days < 0)
    return (
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
        Closed
      </span>
    );
  if (days <= 3)
    return (
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse">
        {days}d left
      </span>
    );
  if (days <= 7)
    return (
      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">
        {days}d left
      </span>
    );
  return (
    <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
      {days}d left
    </span>
  );
};

// â”€â”€ Job Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const JobCard = ({
  job,
  existingApp,
  isLoggedIn,
  isCandidate,
  applyingId,
  onApply,
}) => {
  const navigate = useNavigate();
  const isClosed =
    daysLeft(job.applicationDeadline) !== null &&
    daysLeft(job.applicationDeadline) < 0;
  const isApplying = applyingId === job._id;
  const fee = job.applicationFee?.general || job.applicationFee?.amount || 0;
  const isApplied = !!existingApp;
  const isDraft = existingApp?.status === "draft";

  const handleAction = () => {
    if (!existingApp) {
      onApply(job._id);
      return;
    }
    persistApplicationDraft({ applicationId: existingApp._id, jobId: job._id });
    if (isDraft) {
      navigate(
        getRouteForApplicationStep(
          { ...existingApp, jobId: job },
          existingApp.currentStep || 1,
        ),
        {
          state: { applicationId: existingApp._id, jobId: job._id },
        },
      );
    } else {
      navigate(`/candidate/applications/${existingApp._id}`);
    }
  };

  const renderActionButton = () => {
    if (existingApp) {
      return (
        <button
          onClick={handleAction}
          className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all ${
            isDraft
              ? "bg-orange-600 hover:bg-orange-700 text-white"
              : "bg-green-600 hover:bg-green-700 text-white"
          }`}
        >
          {isDraft ? (
            <>
              <PlayCircle className="w-4 h-4" />
              Resume
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              Applied
            </>
          )}
        </button>
      );
    }
    if (!isLoggedIn || !isCandidate) {
      return (
        <Link
          to="/auth/candidate-login"
          state={{ jobId: job._id }}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold bg-[#f97316] hover:bg-orange-600 text-white transition-all"
        >
          Apply
        </Link>
      );
    }
    return (
      <button
        onClick={handleAction}
        disabled={isApplying || isClosed}
        className={`flex-1 flex items-center justify-center gap-1.5 h-10 rounded-lg text-sm font-bold transition-all ${
          isClosed
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-[#f97316] hover:bg-orange-600 text-white"
        }`}
      >
        {isApplying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Starting...
          </>
        ) : isClosed ? (
          "Closed"
        ) : (
          "Apply Now"
        )}
      </button>
    );
  };

  return (
    <div
      className={`h-full bg-white border-2 rounded-xl overflow-hidden shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col ${
        isApplied
          ? "border-green-400"
          : "border-[#e0d7cd] hover:border-orange-300"
      }`}
    >
      <div className="p-5 flex h-full flex-col">
        {/* Header row â€” title + chips */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-lg text-[#1f1d1b] leading-snug truncate">
              {job.title}
            </h2>
            <p className="text-sm text-[#6d6761] mt-0.5 truncate">
              {job.department}
            </p>
          </div>
          {/* Right side: days chip + applied badge + share icon â€” all inline */}
          <div className="flex items-center gap-1.5 shrink-0">
            <DaysChip deadline={job.applicationDeadline} />
            {isApplied && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                  isDraft
                    ? "bg-orange-100 text-orange-700"
                    : "bg-green-100 text-green-700"
                }`}
              >
                <CheckCircle className="w-3 h-3" />
                {isDraft ? "Draft" : "Applied"}
              </span>
            )}
            <ShareJobButton job={job} />
          </div>
        </div>

        {/* Stats */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-[#4b4744]">
            <Users className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span>{job.totalPosts || 0} vacancies</span>
            {fee > 0 && (
              <>
                <span className="text-gray-300 mx-1">·</span>
                <IndianRupee className="w-4 h-4 text-orange-500 flex-shrink-0" />
                <span>₹{fee.toLocaleString("en-IN")} fee</span>
              </>
            )}
            {fee === 0 && (
              <>
                <span className="text-gray-300 mx-1">Â·</span>
                <span className="text-green-600 font-medium">Free</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-[#4b4744]">
            <Calendar className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span>Apply by {formatDate(job.applicationDeadline)}</span>
          </div>
          {(job.workLocation || job.projectId?.state) && (
            <div className="flex items-center gap-2 text-sm text-[#4b4744]">
              <MapPin className="w-4 h-4 text-orange-500 flex-shrink-0" />
              <span className="truncate">
                {job.workLocation || job.projectId?.state}
              </span>
            </div>
          )}
        </div>

        {/* Description preview */}
        {job.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mb-4 leading-relaxed">
            {job.description}
          </p>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-3 border-t border-[#f0e8e0] mt-auto">
          <Link
            to={`/jobs/${job._id}`}
            className="flex-1 flex items-center justify-center h-10 rounded-lg text-sm font-bold border-2 border-[#e0d7cd] text-[#5f5752] hover:border-orange-400 hover:text-orange-600 transition-all"
          >
            View Details
          </Link>
          {renderActionButton()}
        </div>
      </div>
    </div>
  );
};

// â”€â”€ Skeleton â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SkeletonCard = () => (
  <div className="h-full bg-white border border-[#e0d7cd] rounded-lg p-5 animate-pulse">
    <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
    <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
    <div className="space-y-2 mb-4">
      <div className="h-3 bg-gray-100 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-1/2" />
    </div>
    <div className="flex gap-2 pt-3 border-t border-gray-100">
      <div className="flex-1 h-10 bg-gray-100 rounded-lg" />
      <div className="flex-1 h-10 bg-orange-100 rounded-lg" />
    </div>
  </div>
);

// â”€â”€ Main Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const Jobs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { token, user } = useAuth();
  const isLoggedIn = !!(token && user);
  const isCandidate = isLoggedIn && isCandidateUser(user);

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [applyingId, setApplyingId] = useState(null);
  const [page, setPage] = useState(1);
  const LIMIT = 12;

  const { data, isLoading } = useQuery({
    queryKey: ["public-jobs", search, department, page],
    queryFn: () =>
      jobService.getPublicJobs({
        search: search || undefined,
        department: department || undefined,
        limit: LIMIT,
        page,
      }),
    keepPreviousData: true,
  });

  // Fetch candidate's applications to show applied status
  const { data: myAppsData } = useQuery({
    queryKey: ["candidate-applications-ids"],
    queryFn: () => candidateService.getMyApplications({ limit: 200 }),
    enabled: isCandidate,
    staleTime: 30000,
  });

  const { data: deptData } = useQuery({
    queryKey: ["job-departments"],
    queryFn: jobService.getDepartments,
    staleTime: 300000,
  });

  const jobs = data?.jobs || data?.data || [];
  const totalJobs =
    data?.pagination?.totalItems || data?.meta?.total || jobs.length;
  const totalPages =
    data?.pagination?.totalPages || Math.ceil(totalJobs / LIMIT) || 1;

  const myApps = Array.isArray(myAppsData)
    ? myAppsData
    : myAppsData?.applications || myAppsData?.data || [];
  const appliedMap = useMemo(() => {
    const map = {};
    myApps.forEach((a) => {
      map[a.jobId?._id || a.jobId] = a;
    });
    return map;
  }, [myApps]);

  const departments = deptData?.departments || deptData || [];

  const applyMutation = useMutation({
    mutationFn: (jobId) => applicationService.createApplication(jobId),
    onSuccess: (result, jobId) => {
      setApplyingId(null);
      toast.success("Application started!");
      queryClient.invalidateQueries({
        queryKey: ["candidate-applications-ids"],
      });
      const application = result?.application;
      persistApplicationDraft({ applicationId: application?._id, jobId });
      navigate(getFirstApplicationRoute(application?.jobId || application), {
        state: { applicationId: application?._id, jobId },
      });
    },
    onError: (err, jobId) => {
      setApplyingId(null);
      if (err.status === 409) {
        toast("You have already applied for this job", { icon: "â„¹ï¸" });
        navigate("/candidate/applications");
      } else {
        toast.error(err.message || "Failed to start application");
      }
    },
  });

  const handleApply = (jobId) => {
    if (!isLoggedIn || !isCandidate) {
      navigate("/auth/candidate-login", { state: { jobId } });
      return;
    }
    setApplyingId(jobId);
    applyMutation.mutate(jobId);
  };

  const hasFilters = search || department;

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-122px)] bg-[#f5efe9] py-8 lg:py-10">
        <div className={`${publicContainer} space-y-5`}>
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black text-[#1f1d1b]">
                Active Job Listings
              </h1>
              <p className="text-[#6d6761] mt-1 text-sm">
                {totalJobs > 0
                  ? `${totalJobs} active positions available`
                  : "Browse government job opportunities"}
              </p>
            </div>
            {isLoggedIn && isCandidate && (
              <Link
                to="/candidate/applications"
                className="inline-flex items-center gap-2 text-sm font-semibold text-orange-600 hover:underline"
              >
                My Applications <ChevronRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {/* Search + Filter */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search jobs, departments, post codes..."
                className="w-full pl-11 pr-10 py-3 bg-white border border-[#e0d7cd] rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowFilters((f) => !f)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                showFilters || department
                  ? "bg-orange-50 border-orange-300 text-orange-600"
                  : "bg-white border-[#e0d7cd] text-gray-600 hover:border-orange-300"
              }`}
            >
              <Filter className="w-4 h-4" />
              Filter
              {department && (
                <span className="w-2 h-2 bg-orange-600 rounded-full" />
              )}
            </button>
          </div>

          {/* Filter panel */}
          {showFilters && (
            <div className="bg-white border border-[#e0d7cd] rounded-xl p-4 flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                  Department
                </label>
                <select
                  className="admin-select text-sm"
                  value={department}
                  onChange={(e) => {
                    setDepartment(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Departments</option>
                  {(Array.isArray(departments) ? departments : []).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              {hasFilters && (
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setSearch("");
                      setDepartment("");
                      setPage(1);
                    }}
                    className="text-xs text-orange-600 hover:underline flex items-center gap-1 pb-2"
                  >
                    <X className="w-3 h-3" />
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#e0d7cd] rounded-lg p-8 sm:p-10 text-center shadow-sm"
            >
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 font-semibold">No jobs found</p>
              <p className="text-gray-400 text-sm mt-1">
                {hasFilters
                  ? "Try adjusting your search or filters"
                  : "No active job postings at the moment. Check back soon."}
              </p>
              {hasFilters && (
                <button
                  onClick={() => {
                    setSearch("");
                    setDepartment("");
                  }}
                  className="mt-4 text-orange-600 text-sm font-semibold hover:underline"
                >
                  Clear filters
                </button>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
              {jobs.map((job, index) => (
                <motion.div
                  key={job._id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.4,
                    ease: "easeOut",
                    delay: index * 0.06,
                  }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="h-full"
                >
                  <JobCard
                    job={job}
                    existingApp={appliedMap[job._id]}
                    isLoggedIn={isLoggedIn}
                    isCandidate={isCandidate}
                    applyingId={applyingId}
                    onApply={handleApply}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-4 py-2 rounded-lg border border-[#e0d7cd] text-sm font-semibold text-gray-600 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                Prev
              </button>
              <span className="text-sm text-gray-600 px-3">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg border border-[#e0d7cd] text-sm font-semibold text-gray-600 hover:border-orange-400 disabled:opacity-40 disabled:cursor-not-allowed bg-white"
              >
                Next
              </button>
            </div>
          )}

          {/* Not logged in CTA */}
          {!isLoggedIn && (
            <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
              <div>
                <p className="font-bold text-[#1f1d1b]">Ready to apply?</p>
                <p className="text-sm text-[#6d6761] mt-0.5">
                  Create a free account to start applying for government jobs.
                </p>
              </div>
              <div className="flex gap-3 flex-shrink-0">
                <Link
                  to="/auth/register"
                  className="px-5 py-2.5 border-2 border-[#e46a1d] text-[#e46a1d] hover:bg-[#e46a1d] hover:text-white rounded-lg text-sm font-bold transition-all"
                >
                  Register
                </Link>
                <Link
                  to="/auth/candidate-login"
                  className="px-5 py-2.5 bg-[#e46a1d] hover:bg-orange-600 text-white rounded-lg text-sm font-bold transition-all"
                >
                  Login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
};

export default Jobs;
