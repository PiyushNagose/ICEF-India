import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Search,
  Briefcase,
  Calendar,
  MapPin,
  IndianRupee,
  Users,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Building2,
  Tag,
  X,
  Eye,
  PlayCircle,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { jobService } from "../../services/job.service";
import { candidateService } from "../../services/candidate.service";
import {
  getFirstApplicationRoute,
  getRouteForApplicationStep,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

// ── Helpers ───────────────────────────────────────────────────

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const daysLeft = (deadline) => {
  if (!deadline) return null;
  const diff = Math.ceil(
    (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24),
  );
  return diff;
};

const feeLabel = (job) => {
  const fee = job.applicationFee?.general || job.applicationFee?.amount || 0;
  return fee === 0 ? "Free" : `₹${fee.toLocaleString("en-IN")}`;
};

const DaysLeftBadge = ({ deadline }) => {
  const days = daysLeft(deadline);
  if (days === null) return null;
  if (days < 0)
    return <Badge className="bg-red-100 text-red-700 text-xs">Closed</Badge>;
  if (days <= 3)
    return (
      <Badge className="bg-red-100 text-red-700 text-xs animate-pulse">
        {days}d left
      </Badge>
    );
  if (days <= 7)
    return (
      <Badge className="bg-orange-100 text-orange-700 text-xs">
        {days}d left
      </Badge>
    );
  return (
    <Badge className="bg-green-100 text-green-700 text-xs">{days}d left</Badge>
  );
};

// ── Job Card ──────────────────────────────────────────────────

const JobCard = ({
  job,
  existingApp,
  applyingId,
  onApply,
  onView,
  onViewApp,
}) => {
  const isDraft = existingApp?.status === "draft";
  const isSubmitted = existingApp && !isDraft;
  const isApplying = applyingId === job._id;
  const isClosed =
    daysLeft(job.applicationDeadline) !== null &&
    daysLeft(job.applicationDeadline) < 0;
  const stepPct = existingApp
    ? Math.round(((existingApp.currentStep || 1) / 9) * 100)
    : 0;

  return (
    <div
      className={`flex h-full flex-col bg-white rounded-xl border transition-all hover:shadow-md ${
        isSubmitted
          ? "border-green-200"
          : isDraft
            ? "border-orange-200"
            : "border-gray-200 hover:border-orange-300"
      }`}
    >
      {/* Status ribbon */}
      {isDraft && (
        <div className="bg-orange-500 text-white text-xs font-semibold px-4 py-1.5 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PlayCircle className="w-3.5 h-3.5" />
            Draft — {stepPct}% complete
          </div>
          <span>Step {existingApp.currentStep || 1}/9</span>
        </div>
      )}
      {isSubmitted && (
        <div className="bg-green-600 text-white text-xs font-semibold px-4 py-1.5 rounded-t-xl flex items-center gap-1.5">
          <CheckCircle className="w-3.5 h-3.5" />
          Applied · {existingApp.status?.replace("_", " ")}
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-snug truncate">
              {job.title}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 text-gray-500 text-sm">
              <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{job.department}</span>
            </div>
          </div>
          <DaysLeftBadge deadline={job.applicationDeadline} />
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {job.category && (
            <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">
              {job.category}
            </span>
          )}
          {job.postCode && (
            <span className="text-xs bg-gray-50 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full font-mono">
              {job.postCode}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Users className="w-3.5 h-3.5 text-orange-500" />
            <span>{job.totalPosts || 0} vacancies</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <IndianRupee className="w-3.5 h-3.5 text-orange-500" />
            <span>{feeLabel(job)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-orange-500" />
            <span>Deadline: {formatDate(job.applicationDeadline)}</span>
          </div>
          {(job.workLocation || job.projectId?.state) && (
            <div className="flex items-center gap-1.5 text-xs text-gray-600">
              <MapPin className="w-3.5 h-3.5 text-orange-500" />
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
        <div className="mt-auto flex gap-2 pt-4 border-t border-gray-100">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(job._id)}
            className="h-11 flex-1 text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-600"
          >
            View Details
          </Button>

          {isDraft ? (
            // Draft — continue filling the form
            <Button
              size="sm"
              onClick={() => onViewApp(existingApp)}
              className="h-11 flex-1 bg-orange-600 hover:bg-orange-700 text-white gap-1"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              Continue
            </Button>
          ) : isSubmitted ? (
            // Submitted — view application status
            <Button
              size="sm"
              onClick={() => onViewApp(existingApp)}
              className="h-11 flex-1 bg-green-600 hover:bg-green-700 text-white gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              Track Status
            </Button>
          ) : isClosed ? (
            <Button
              size="sm"
              disabled
              className="h-11 flex-1 bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              Closed
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onApply(job._id)}
              disabled={isApplying}
              className="h-11 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  Apply Now <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────

const CandidateJobs = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("");
  const [category, setCategory] = useState("");
  const [sortBy, setSortBy] = useState("deadline"); // deadline | newest | fee
  const [page, setPage] = useState(1);
  const [applyingId, setApplyingId] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const LIMIT = 12;

  // Fetch jobs
  const { data: jobsData, isLoading: loadingJobs } = useQuery({
    queryKey: ["candidate-jobs", search, department, category, page],
    queryFn: () =>
      jobService.getPublicJobs({
        search: search || undefined,
        department: department || undefined,
        category: category || undefined,
        limit: LIMIT,
        page,
      }),
    keepPreviousData: true,
  });

  // Fetch my applications to know which jobs are already applied
  const { data: myAppsData } = useQuery({
    queryKey: ["candidate-applications-ids"],
    queryFn: () => candidateService.getMyApplications({ limit: 200 }),
    staleTime: 30000,
  });

  // Fetch departments for filter
  const { data: deptData } = useQuery({
    queryKey: ["job-departments"],
    queryFn: jobService.getDepartments,
    staleTime: 300000,
  });

  const jobs = jobsData?.jobs || jobsData?.data || [];
  const totalJobs =
    jobsData?.pagination?.totalItems || jobsData?.meta?.total || jobs.length;
  const totalPages =
    jobsData?.pagination?.totalPages || Math.ceil(totalJobs / LIMIT) || 1;

  const myApps = Array.isArray(myAppsData)
    ? myAppsData
    : myAppsData?.applications || myAppsData?.data || [];

  // Map jobId → full application object for status-aware rendering
  const appliedMap = useMemo(() => {
    const map = {};
    myApps.forEach((a) => {
      map[a.jobId?._id || a.jobId] = a;
    });
    return map;
  }, [myApps]);

  const departments = deptData?.departments || deptData || [];

  // Sort jobs client-side
  const sortedJobs = useMemo(() => {
    const arr = [...jobs];
    if (sortBy === "deadline") {
      arr.sort((a, b) => {
        if (!a.applicationDeadline) return 1;
        if (!b.applicationDeadline) return -1;
        return (
          new Date(a.applicationDeadline) - new Date(b.applicationDeadline)
        );
      });
    } else if (sortBy === "newest") {
      arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    } else if (sortBy === "fee") {
      arr.sort(
        (a, b) =>
          (a.applicationFee?.general || 0) - (b.applicationFee?.general || 0),
      );
    }
    return arr;
  }, [jobs, sortBy]);

  const appliedCount = jobs.filter((j) => appliedMap[j._id]).length;
  const openCount = jobs.filter(
    (j) =>
      daysLeft(j.applicationDeadline) === null ||
      daysLeft(j.applicationDeadline) >= 0,
  ).length;

  // Apply mutation
  const applyMutation = useMutation({
    mutationFn: (jobId) => candidateService.createApplication(jobId),
    onSuccess: (result, jobId) => {
      setApplyingId(null);
      toast.success("Application started!");
      queryClient.invalidateQueries({
        queryKey: ["candidate-applications-ids"],
      });
      const application = result?.application;
      persistApplicationDraft({ applicationId: application?._id, jobId });
      navigate(getFirstApplicationRoute(application?.jobId || application), {
        state: { applicationId: result?.application?._id, jobId },
      });
    },
    onError: (err, jobId) => {
      setApplyingId(null);
      if (err.status === 409) {
        toast("You have already applied for this job", { icon: "ℹ️" });
        navigate("/candidate/applications");
      } else {
        toast.error(err.message || "Failed to start application");
      }
    },
  });

  const handleApply = (jobId) => {
    setApplyingId(jobId);
    applyMutation.mutate(jobId);
  };

  const handleView = (jobId) => {
    navigate(`/jobs/${jobId}`);
  };

  const handleViewApp = (app) => {
    if (!app) return;
    persistApplicationDraft({ applicationId: app._id, jobId: app.jobId?._id });
    if (app.status === "draft") {
      navigate(getRouteForApplicationStep(app, app.currentStep || 1), {
        state: { applicationId: app._id, jobId: app.jobId?._id },
      });
    } else {
      navigate(`/candidate/applications/${app._id}`);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setDepartment("");
    setCategory("");
    setPage(1);
  };

  const hasFilters = search || department || category;

  return (
    <CandidateLayout title="Available Jobs">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Available Jobs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalJobs > 0
                ? `${totalJobs} active positions`
                : "Browse government job opportunities"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters((f) => !f)}
            className={`border-gray-200 ${showFilters ? "bg-orange-50 border-orange-300 text-orange-600" : "text-gray-600"}`}
          >
            <Filter className="w-4 h-4 mr-1.5" />
            Filters
            {hasFilters && (
              <span className="ml-1.5 w-2 h-2 bg-orange-600 rounded-full" />
            )}
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Jobs",
              value: totalJobs,
              icon: Briefcase,
              color: "text-orange-600",
            },
            {
              label: "Open Now",
              value: openCount,
              icon: Clock,
              color: "text-green-600",
            },
            {
              label: "Applied",
              value: appliedCount,
              icon: CheckCircle,
              color: "text-blue-600",
            },
          ].map((s) => (
            <Card key={s.label} className="bg-white">
              <CardContent className="p-4 flex items-center gap-3">
                <s.icon className={`w-5 h-5 ${s.color} flex-shrink-0`} />
                <div>
                  <p className="text-lg font-bold text-gray-800">{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search + Filters */}
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by job title, department, or post code..."
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
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

          {/* Expanded filters */}
          {showFilters && (
            <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Department
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Category
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All Categories</option>
                  {[
                    "Teaching",
                    "Engineering",
                    "Administrative",
                    "Medical",
                    "Police",
                    "Forest",
                    "Other",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                  Sort By
                </label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                >
                  <option value="deadline">Deadline (Soonest)</option>
                  <option value="newest">Newest First</option>
                  <option value="fee">Fee (Low to High)</option>
                </select>
              </div>
              {hasFilters && (
                <div className="sm:col-span-3 flex justify-end">
                  <button
                    onClick={clearFilters}
                    className="text-xs text-orange-600 hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active filter chips */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2">
            {search && (
              <span className="flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full">
                <Search className="w-3 h-3" />"{search}"
                <button onClick={() => setSearch("")}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {department && (
              <span className="flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full">
                <Building2 className="w-3 h-3" />
                {department}
                <button onClick={() => setDepartment("")}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {category && (
              <span className="flex items-center gap-1.5 text-xs bg-orange-50 text-orange-700 border border-orange-200 px-3 py-1 rounded-full">
                <Tag className="w-3 h-3" />
                {category}
                <button onClick={() => setCategory("")}>
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Jobs Grid */}
        {loadingJobs ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse"
              >
                <div className="h-5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-3 bg-gray-100 rounded" />
                  ))}
                </div>
                <div className="flex gap-2 pt-3 border-t border-gray-100">
                  <div className="h-8 bg-gray-100 rounded flex-1" />
                  <div className="h-8 bg-orange-100 rounded flex-1" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedJobs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No jobs found</p>
            <p className="text-gray-400 text-sm mt-1">
              {hasFilters
                ? "Try adjusting your filters"
                : "No active job postings at the moment"}
            </p>
            {hasFilters && (
              <Button
                variant="outline"
                onClick={clearFilters}
                className="mt-4 text-orange-600 border-orange-200"
              >
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {sortedJobs.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                existingApp={appliedMap[job._id]}
                applyingId={applyingId}
                onApply={handleApply}
                onView={handleView}
                onViewApp={handleViewApp}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} · {totalJobs} total jobs
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-gray-200"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              {/* Page numbers */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = Math.max(1, Math.min(page - 2, totalPages - 4)) + i;
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      p === page
                        ? "bg-orange-600 text-white"
                        : "text-gray-600 hover:bg-orange-50"
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border-gray-200"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-800">
              <p className="font-medium">Before you apply</p>
              <p className="text-orange-700 text-xs mt-0.5">
                Ensure your profile is complete and all documents are ready.
                Application fees are non-refundable once payment is processed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </CandidateLayout>
  );
};

export default CandidateJobs;
