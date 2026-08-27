import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "../../hooks/useDebounce";
import toast from "react-hot-toast";
import {
  Archive,
  Database,
  FileText,
  Eye,
  CheckCircle,
  Search,
  Download,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Clock,
  CreditCard,
  FileSpreadsheet,
  Printer,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import CustomSelect from "../../components/ui/CustomSelect";
import Button from "../../components/ui/Button";
import { adminService } from "../../services/admin.service";

const STATUS_CONFIG = {
  draft: {
    label: "Draft",
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-400",
  },
  submitted: {
    label: "Auto Approved",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  under_review: {
    label: "Under Review",
    bg: "bg-amber-100",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  verified: {
    label: "Approved",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  approved: {
    label: "Approved",
    bg: "bg-emerald-100",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
  clarification_required: {
    label: "Clarification Required",
    bg: "bg-orange-100",
    text: "text-orange-800",
    dot: "bg-orange-500",
  },
  rejected: {
    label: "Rejected",
    bg: "bg-red-100",
    text: "text-red-800",
    dot: "bg-red-500",
  },
};

const PAYMENT_CONFIG = {
  paid: { label: "Paid", bg: "bg-emerald-100", text: "text-emerald-800" },
  success: { label: "Paid", bg: "bg-emerald-100", text: "text-emerald-800" },
  pending: { label: "Pending", bg: "bg-amber-100", text: "text-amber-800" },
  failed: { label: "Failed", bg: "bg-red-100", text: "text-red-800" },
  initiated: { label: "Initiated", bg: "bg-blue-100", text: "text-blue-800" },
  unpaid: { label: "Unpaid", bg: "bg-gray-100", text: "text-gray-600" },
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const PaymentBadge = ({ status }) => {
  const cfg = PAYMENT_CONFIG[status] || PAYMENT_CONFIG.unpaid;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
};

const CandidateAvatar = ({ name }) => {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  const colors = [
    "bg-orange-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-teal-500",
    "bg-rose-500",
    "bg-indigo-500",
  ];
  const color = colors[(initials.charCodeAt(0) || 0) % colors.length];
  return (
    <div
      className={`w-8 h-8 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
    >
      {initials}
    </div>
  );
};

const Applications = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [page, setPage] = useState(1);

  const status = activeTab === "all" ? undefined : activeTab;
  const selectedJobId = searchParams.get("job") || "";

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-applications", status, debouncedSearch, selectedJobId, page],
    queryFn: () =>
      adminService.getApplications({
        status,
        limit: 10,
        page,
        ...(selectedJobId && { jobId: selectedJobId }),
        ...(debouncedSearch && { search: debouncedSearch }),
      }),
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin-application-stats", selectedJobId],
    queryFn: () =>
      adminService.getApplicationStats({
        ...(selectedJobId && { jobId: selectedJobId }),
      }),
  });

  const { data: jobsData } = useQuery({
    queryKey: ["admin-jobs-export-list"],
    queryFn: () => adminService.getAdminJobs({ limit: 200 }),
  });

  const applications = data?.applications || [];
  const pagination = data?.pagination || {};
  const totalPages = pagination.totalPages || 1;
  const totalItems = pagination.totalItems || applications.length;

  const statusStats = statsData?.statusStats || [];
  const countByStatus = (key) =>
    statusStats.find((item) => item._id === key)?.count || 0;
  const total =
    statsData?.totalApplications ?? totalItems ?? applications.length;
  const exportJobs =
    jobsData?.jobs || jobsData?.items || jobsData?.data || jobsData || [];
  const selectedJob = Array.isArray(exportJobs)
    ? exportJobs.find((job) => String(job._id || job.id) === String(selectedJobId))
    : null;
  const jobOptions = [
    { value: "", label: "All jobs" },
    ...(Array.isArray(exportJobs)
      ? exportJobs.map((job) => ({
          value: job._id || job.id,
          label: `${job.title || "Untitled Job"}${job.postCode || job.code ? ` - ${job.postCode || job.code}` : ""}`,
        }))
      : []),
  ];

  const stats = [
    {
      title: "Total Applications",
      value: total,
      icon: FileText,
      gradient: "from-orange-500 to-orange-600",
      bg: "bg-orange-50",
      iconColor: "text-orange-600",
      change: null,
    },
    {
      title: "Auto Approved",
      value:
        countByStatus("submitted") +
        countByStatus("verified") +
        countByStatus("approved"),
      icon: CheckCircle,
      gradient: "from-emerald-500 to-emerald-600",
      bg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      change: null,
    },
    {
      title: "Clarification",
      value: countByStatus("clarification_required"),
      icon: AlertCircle,
      gradient: "from-orange-500 to-orange-600",
      bg: "bg-orange-50",
      iconColor: "text-orange-600",
      change: null,
    },
    {
      title: "Drafts",
      value: countByStatus("draft"),
      icon: Clock,
      gradient: "from-slate-500 to-slate-600",
      bg: "bg-slate-50",
      iconColor: "text-slate-600",
      change: null,
    },
  ];

  const tabs = [
    { id: "all", label: "All", count: total },
    { id: "submitted", label: "Auto Approved", count: countByStatus("submitted") },
    { id: "approved", label: "Approved", count: countByStatus("approved") },
    {
      id: "clarification_required",
      label: "Clarification",
      count: countByStatus("clarification_required"),
    },
    { id: "draft", label: "Drafts", count: countByStatus("draft") },
  ];

  const exportActions = [
    {
      type: "register",
      title: "Application Register",
      description: "Candidate master CSV",
      icon: FileSpreadsheet,
      filename: "application-register.csv",
    },
    {
      type: "documents",
      title: "Document Manifest",
      description: "Storage URLs and file status",
      icon: Database,
      filename: "document-manifest.csv",
    },
    {
      type: "payments",
      title: "Payment Register",
      description: "Fee and transaction CSV",
      icon: CreditCard,
      filename: "payment-register.csv",
    },
    {
      type: "corrections",
      title: "Correction Register",
      description: "Clarification audit CSV",
      icon: AlertCircle,
      filename: "correction-register.csv",
    },
    {
      type: "print",
      title: "Printable Register",
      description: "A4 hard-copy HTML",
      icon: Printer,
      filename: "printable-application-register.html",
    },
    {
      type: "bundle",
      title: "Govt Handover ZIP",
      description: "CSV + print register",
      icon: Archive,
      filename: "government-handover.zip",
      featured: true,
    },
  ];

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExport = async (type = "bundle") => {
    const action =
      exportActions.find((item) => item.type === type) || exportActions[0];
    try {
      toast.loading("Preparing export...", {
        id: "export",
      });

      const blob = await adminService.downloadApplicationExport(type, {
        ...(status && { status }),
        ...(search && { search }),
        ...(selectedJobId && { jobId: selectedJobId }),
      });
      const suffix = new Date().toISOString().slice(0, 10);
      const jobSlug = selectedJob
        ? `-${String(
            selectedJob.postCode ||
              selectedJob.code ||
              selectedJob.title ||
              "job",
          )
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")}`
        : "";
      const filename = action.filename.replace(
        /(\.csv|\.zip|\.html)$/,
        `${jobSlug}-${suffix}$1`,
      );
      downloadBlob(blob, filename);

      toast.success("Export downloaded successfully", {
        id: "export",
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to export applications", {
        id: "export",
      });
    }
  };

  const handleRepairManifests = async () => {
    try {
      toast.loading("Repairing storage manifests...", { id: "repair-manifest" });
      const result = await adminService.repairApplicationStorageManifests({
        ...(status && { status }),
        ...(selectedJobId && { jobId: selectedJobId }),
      });
      toast.success(
        `${result?.updatedCount || 0} application manifests updated`,
        { id: "repair-manifest" },
      );
    } catch (error) {
      console.error(error);
      toast.error("Unable to repair manifests", { id: "repair-manifest" });
    }
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setPage(1);
  };

  const handleSearch = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleJobChange = (jobId) => {
    const nextParams = new URLSearchParams(searchParams);
    if (jobId) nextParams.set("job", jobId);
    else nextParams.delete("job");
    setSearchParams(nextParams, { replace: true });
    setPage(1);
  };

  // Helper: get candidate name from aggregation result (backend returns "candidate" not "candidateId")
  const getCandidateName = (app) =>
    app.personalDetails?.fullName ||
    app.candidate?.fullName ||
    app.candidateId?.fullName ||
    null;

  const getCandidateEmail = (app) =>
    app.contactEmail ||
    app.candidate?.email ||
    app.candidateId?.email ||
    app.personalDetails?.email ||
    null;

  const getCandidateMobile = (app) =>
    app.contactMobile ||
    app.personalDetails?.registeredMobile ||
    app.candidate?.registeredMobile ||
    app.candidateId?.registeredMobile ||
    null;

  const getJobTitle = (app) => app.job?.title || app.jobId?.title || null;

  const getJobDept = (app) =>
    app.job?.department || app.jobId?.department || null;

  const hasPendingCorrection = (app) =>
    app.correction?.status === "submitted" ||
    (app.corrections || []).some((item) =>
      ["pending", "more_info_needed"].includes(item.status),
    );

  return (
    <AdminLayout title="Applications">
      <div className="p-6 space-y-6">
        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              {selectedJob
                ? `Review applications and KPI count for ${selectedJob.title || "the selected job"}`
                : "Review and manage all candidate applications"}
            </p>
          </div>
          <div className="w-full sm:w-[360px]">
            <CustomSelect
              value={selectedJobId}
              onChange={handleJobChange}
              options={jobOptions}
              className="w-full border-gray-200 bg-white shadow-sm"
            />
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.title}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-normal mb-2">
                      {stat.title}
                    </p>
                    <p className="text-3xl font-bold text-gray-900">
                      {Number(stat.value || 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}
                  >
                    <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Main Card ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="grid grid-cols-1 xl:grid-cols-[330px_1fr] gap-4 items-stretch">
            <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-4 flex flex-col justify-between">
              <div>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 w-10 h-10 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Archive className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold leading-6 text-gray-900">
                    Government Handover Exports
                  </h2>
                  <p className="mt-1 text-sm leading-5 text-gray-500">
                    Select a job for official hard-copy and digital handover.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <span className="inline-flex max-w-full items-center rounded-full border border-orange-100 bg-white px-3 py-1.5 text-xs font-semibold text-orange-700">
                  <span className="truncate">
                    {selectedJob
                      ? `${selectedJob.title || "Selected Job"}${selectedJob.postCode || selectedJob.code ? ` - ${selectedJob.postCode || selectedJob.code}` : ""}`
                      : "All jobs"}
                  </span>
                </span>
              </div>
              </div>

              <button
                type="button"
                onClick={handleRepairManifests}
                className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-orange-600 hover:text-orange-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Repair old storage manifests
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
              {exportActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.type}
                    type="button"
                    onClick={() => handleExport(action.type)}
                    className={`group text-left rounded-xl border p-4 h-[124px] transition-all hover:-translate-y-0.5 hover:shadow-md ${
                      action.featured
                        ? "border-orange-500 bg-orange-50 text-orange-700 md:col-span-2 2xl:col-span-1"
                        : "border-gray-200 bg-white text-gray-800 hover:border-orange-200"
                    }`}
                  >
                    <div className="flex h-full flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            action.featured
                              ? "bg-orange-100 text-orange-600"
                              : "bg-gray-50 text-gray-500"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <Download className="w-4 h-4 text-gray-400 group-hover:text-orange-500" />
                      </div>
                      <p className="mt-3 text-sm font-bold leading-5">
                        {action.title}
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <p className="text-xs leading-5 text-gray-500">
                          {action.description}
                        </p>
                        {action.featured && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-normal text-orange-700">
                            ZIP
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-gray-200 px-6">
            <nav className="-mb-px flex space-x-1 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`py-4 px-3 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.id
                      ? "border-orange-500 text-orange-600"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold ${
                      activeTab === tab.id
                        ? "bg-orange-100 text-orange-700"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </nav>
          </div>

          {/* Search */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3 flex-wrap bg-gray-50/50">
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, mobile, registration, or application ID..."
                className="w-full pl-9 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-sm bg-white"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {isFetching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[1120px] table-fixed">
              <colgroup>
                <col className="w-[22%]" />
                <col className="w-[18%]" />
                <col className="w-[20%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
                <col className="w-[8%]" />
              </colgroup>
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Candidate
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Registration / Application
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Job Applied
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Payment
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Submitted
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                        <span className="text-sm">Loading applications...</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isLoading && applications.length === 0 && (
                  <tr>
                    <td colSpan="7" className="py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-gray-400">
                        <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                          <FileText className="w-7 h-7 text-gray-300" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">
                            No applications found
                          </p>
                          <p className="text-xs text-gray-400 mt-1">
                            {search || selectedJobId
                              ? "Try adjusting your search query"
                              : "Applications will appear here once submitted"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
                {applications.map((app) => {
                  const candidateName = getCandidateName(app);
                  const candidateEmail = getCandidateEmail(app);
                  const candidateMobile = getCandidateMobile(app);
                  const jobTitle = getJobTitle(app);
                  const jobDept = getJobDept(app);

                  return (
                    <tr
                      key={app._id}
                      className="group transition-colors hover:bg-gray-50/80"
                    >
                      {/* Candidate */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <CandidateAvatar name={candidateName} />
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {candidateName || (
                                <span className="text-gray-400 italic font-normal">
                                  Not provided
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {candidateEmail || "—"}
                            </p>
                            {candidateMobile && (
                              <p className="text-xs text-gray-400 truncate">
                                {candidateMobile}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Registration / Application ID */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {app.registrationNumber ? (
                            <span className="font-mono text-sm font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                              {app.registrationNumber}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              Registration pending
                            </span>
                          )}
                          <span className="font-mono text-xs text-gray-500">
                            {app.applicationId}
                          </span>
                        </div>
                      </td>

                      {/* Job */}
                      <td className="py-4 px-4">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 text-sm truncate max-w-[180px]">
                            {jobTitle || (
                              <span className="text-gray-400 italic font-normal">
                                Not assigned
                              </span>
                            )}
                          </p>
                          {jobDept && (
                            <p className="text-xs text-gray-500 truncate">
                              {jobDept}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex flex-col items-center gap-1.5">
                          <StatusBadge status={app.status} />
                          {hasPendingCorrection(app) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-[11px] font-semibold text-orange-700">
                              <AlertCircle className="h-3 w-3" />
                              Correction Pending
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Payment */}
                      <td className="py-4 px-4 text-center">
                        <PaymentBadge status={app.paymentStatus || "unpaid"} />
                      </td>

                      {/* Submitted */}
                      <td className="py-4 px-4 text-center">
                        <span className="text-sm text-gray-700">
                          {app.submittedAt ? (
                            new Date(app.submittedAt).toLocaleDateString(
                              "en-IN",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            )
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() =>
                              navigate(`/admin/applications/${app._id}`)
                            }
                            className="p-2 text-orange-600 hover:bg-orange-100 rounded-lg transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!isLoading && applications.length > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                Showing{" "}
                <span className="font-medium text-gray-700">
                  {applications.length}
                </span>{" "}
                of{" "}
                <span className="font-medium text-gray-700">
                  {Number(total).toLocaleString("en-IN")}
                </span>{" "}
                applications
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="border-gray-300"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                {(() => {
                  const pages = [];
                  if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) pages.push(i);
                  } else {
                    pages.push(1);
                    if (page > 3) pages.push("...");
                    for (
                      let i = Math.max(2, page - 1);
                      i <= Math.min(totalPages - 1, page + 1);
                      i++
                    )
                      pages.push(i);
                    if (page < totalPages - 2) pages.push("...");
                    pages.push(totalPages);
                  }
                  return pages.map((p, i) =>
                    p === "..." ? (
                      <span
                        key={`d${i}`}
                        className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-colors ${p === page ? "bg-orange-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                      >
                        {p}
                      </button>
                    ),
                  );
                })()}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="border-gray-300"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default Applications;
