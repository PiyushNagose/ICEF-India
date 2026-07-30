import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Briefcase,
  Clock,
  FileText,
  Plus,
  PlayCircle,
  Eye,
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  User,
  HelpCircle,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { dashboardService } from "../../services/dashboard.service";
import { candidateService } from "../../services/candidate.service";
import { getStoredUser } from "../../services/auth.service";
import {
  getRouteForApplicationStep,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

// ── Helpers ───────────────────────────────────────────────────

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  submitted: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700",
    icon: FileText,
  },
  under_review: {
    label: "Under Review",
    color: "bg-yellow-100 text-yellow-700",
    icon: AlertCircle,
  },
  verified: {
    label: "Verified",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
};

const NOTIF_ICONS = {
  application_submitted: FileText,
  application_approved: CheckCircle,
  application_rejected: XCircle,
  document_verified: CheckCircle,
  document_rejected: XCircle,
  payment_success: CreditCard,
  ticket_reply: HelpCircle,
  ticket_resolved: HelpCircle,
  general: Bell,
};

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
      })
    : "";

const daysLeft = (deadline) => {
  if (!deadline) return null;
  return Math.ceil((new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24));
};

// ── Stat Card ─────────────────────────────────────────────────

const Stat = ({ icon: Icon, label, value, color = "text-orange-600", sub }) => (
  <Card className="bg-white">
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
          <Icon className="w-5 h-5 text-orange-500" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Main Dashboard ────────────────────────────────────────────

const CandidateDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = getStoredUser();

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-dashboard"],
    queryFn: dashboardService.candidateDashboard,
    staleTime: 30000,
  });

  const rawApplications = data?.applications;
  const applications = Array.isArray(rawApplications)
    ? rawApplications
    : rawApplications?.applications ||
      rawApplications?.data ||
      data?.data?.applications ||
      [];

  const jobs = Array.isArray(data?.jobs) ? data.jobs : data?.jobs?.jobs || [];
  const rawNotifications = data?.notifications;
  const notifications = Array.isArray(rawNotifications)
    ? rawNotifications
    : rawNotifications?.notifications ||
      rawNotifications?.data?.notifications ||
      rawNotifications?.data ||
      [];
  const unreadCount =
    rawNotifications?.unreadCount ??
    rawNotifications?.data?.unreadCount ??
    0;
  const unreadNotifications = notifications.filter((n) => !n.isRead);

  const submittedCount = applications.filter(
    (a) => a.status !== "draft",
  ).length;
  const draftCount = applications.filter((a) => a.status === "draft").length;
  const completionPct = user?.profileCompletionPercentage || 0;

  const { mutateAsync: markNotificationRead } = useMutation({
    mutationFn: (id) => candidateService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-notifications"] });
      queryClient.invalidateQueries({
        queryKey: ["candidate-notifications-count"],
      });
    },
  });

  const handleAppAction = (app) => {
    persistApplicationDraft({ applicationId: app._id, jobId: app.jobId?._id });
    if (app.status === "draft") {
      navigate(getRouteForApplicationStep(app, app.currentStep || 1), {
        state: { applicationId: app._id, jobId: app.jobId?._id },
      });
    } else {
      // Navigate to the dedicated application status page
      navigate(`/candidate/applications/${app._id}`);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    if (!notification.isRead) {
      try {
        await markNotificationRead(notification._id);
      } catch (_) {}
    }
    if (notification.link) {
      navigate(notification.link);
    } else {
      navigate("/candidate/notifications");
    }
  };

  return (
    <CandidateLayout title="Dashboard">
      <div className="space-y-6">
        {/* Welcome banner */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-700 rounded-xl p-6 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back,{" "}
                {user?.fullName?.split(" ")[0] ||
                  user?.email?.split("@")[0] ||
                  "Candidate"}{" "}
                👋
              </h1>
              <p className="text-white/90 text-sm mt-1">
                {draftCount > 0
                  ? `You have ${draftCount} draft application${draftCount > 1 ? "s" : ""} waiting to be completed.`
                  : "Track your applications and stay updated on recruitment news."}
              </p>
            </div>
            <Button
              asChild
              className="bg-white text-orange-600 hover:bg-orange-50 flex-shrink-0"
            >
              <Link to="/candidate/jobs">
                <Plus className="w-4 h-4 mr-2" />
                Apply for Jobs
              </Link>
            </Button>
          </div>

          {/* Profile completion bar */}
          {completionPct < 100 && (
            <div className="mt-4 pt-4 border-t border-orange-500/40">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/90">
                  Profile Completion
                </span>
                <span className="text-xs font-bold text-white">
                  {completionPct}%
                </span>
              </div>
              <div className="w-full bg-orange-500/40 rounded-full h-1.5">
                <div
                  className="bg-white h-1.5 rounded-full transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
              <Link
                to="/candidate/profile"
                className="text-xs text-white/90 hover:text-white mt-1.5 inline-flex items-center gap-1"
              >
                Complete your profile <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat
            icon={FileText}
            label="Total Applications"
            value={applications.length}
          />
          <Stat
            icon={Clock}
            label="Drafts"
            value={draftCount}
            color="text-yellow-600"
            sub="Incomplete"
          />
          <Stat
            icon={Briefcase}
            label="Submitted"
            value={submittedCount}
            color="text-blue-600"
          />
          <Stat
            icon={Bell}
            label="Unread Alerts"
            value={unreadCount}
            color={unreadCount > 0 ? "text-red-600" : "text-gray-600"}
          />
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 items-stretch gap-6">
          {/* Applications — 2/3 width */}
          <Card className="lg:col-span-2 overflow-hidden h-full flex flex-col">
            <CardHeader className="p-5 pb-4 border-b border-gray-100">
              <div className="flex justify-between items-center gap-4">
                <h3 className="font-semibold text-gray-800">My Applications</h3>
                <Link
                  to="/candidate/applications"
                  className="text-xs text-orange-600 hover:underline font-medium flex items-center gap-1"
                >
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto customer-data-scroll">
              {isLoading && (
                <div className="p-6 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-gray-100 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              )}
              {!isLoading && applications.length === 0 && (
                <div className="min-h-[220px] p-8 text-center flex flex-col items-center justify-center">
                  <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm font-medium">
                    No applications yet
                  </p>
                  <Link
                    to="/candidate/jobs"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm text-orange-600 font-semibold hover:underline"
                  >
                    Browse Jobs <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              )}
              {applications.slice(0, 5).map((app) => {
                const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.draft;
                const StatusIcon = cfg.icon;
                const isDraft = app.status === "draft";
                const stepPct = Math.round(((app.currentStep || 1) / 9) * 100);

                return (
                  <div
                    key={app._id}
                    className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-0 hover:bg-orange-50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${isDraft ? "bg-gray-100" : "bg-orange-100"}`}
                      >
                        <FileText
                          className={`w-4 h-4 ${isDraft ? "text-gray-500" : "text-orange-600"}`}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">
                          {app.jobId?.title || "Job Application"}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-gray-500 truncate">
                            {app.applicationId}
                          </p>
                          {isDraft && (
                            <div className="flex items-center gap-1">
                              <div className="w-16 bg-gray-200 rounded-full h-1">
                                <div
                                  className="bg-orange-500 h-1 rounded-full"
                                  style={{ width: `${stepPct}%` }}
                                />
                              </div>
                              <span className="text-xs text-orange-600">
                                {stepPct}%
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      <Badge className={`${cfg.color} text-xs hidden sm:flex`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {cfg.label}
                      </Badge>
                      <button
                        onClick={() => handleAppAction(app)}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          isDraft
                            ? "bg-orange-600 hover:bg-orange-700 text-white"
                            : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                        }`}
                      >
                        {isDraft ? (
                          <>
                            <PlayCircle className="w-3.5 h-3.5" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            View
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="grid grid-cols-1 gap-5 min-w-0">
            {/* Active Jobs */}
            <Card className="overflow-hidden h-full flex flex-col">
              <CardHeader className="p-5 pb-4 border-b border-gray-100">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="font-semibold text-gray-800">Active Jobs</h3>
                  <Link
                    to="/candidate/jobs"
                    className="text-xs text-orange-600 hover:underline font-medium"
                  >
                    View All
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
                {jobs.length === 0 && (
                  <div className="min-h-[132px] px-5 py-6 text-center flex flex-col items-center justify-center">
                    <Briefcase className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No active jobs right now.</p>
                  </div>
                )}
                {jobs.slice(0, 4).map((job) => {
                  const days = daysLeft(job.applicationDeadline);
                  return (
                    <Link
                      key={job._id}
                      to={`/jobs/${job._id}`}
                      className="grid grid-cols-[minmax(0,1fr)_56px] items-center gap-3 px-5 py-3.5 border-b border-gray-100 last:border-0 hover:bg-orange-50 transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate group-hover:text-orange-600 transition-colors">
                          {job.title}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {job.department}
                        </p>
                      </div>
                      {days !== null && (
                        <span
                          className={`justify-self-end text-center min-w-10 text-xs font-bold px-2 py-0.5 rounded-full ${
                            days < 0
                              ? "bg-red-100 text-red-700"
                              : days <= 7
                                ? "bg-orange-100 text-orange-700"
                                : "bg-green-100 text-green-700"
                          }`}
                        >
                          {days < 0 ? "Closed" : `${days}d`}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card className="overflow-hidden h-full flex flex-col">
              <CardHeader className="p-5 pb-4 border-b border-gray-100">
                <div className="flex justify-between items-center gap-3">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="bg-orange-600 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                        {unreadCount}
                      </span>
                    )}
                  </h3>
                  <Link
                    to="/candidate/notifications"
                    className="text-xs text-orange-600 hover:underline font-medium"
                  >
                    View All
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0 overflow-y-auto">
                {unreadNotifications.length === 0 && (
                  <div className="min-h-[132px] px-5 py-6 text-center flex flex-col items-center justify-center">
                    <Bell className="w-8 h-8 text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">No unread notifications.</p>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto">
                {unreadNotifications.map((n) => {
                  const Icon = NOTIF_ICONS[n.type] || Bell;
                  return (
                    <button
                      type="button"
                      key={n._id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 px-5 py-3.5 border-b border-gray-100 last:border-0 transition-colors ${
                        "w-full text-left bg-orange-50 hover:bg-orange-100"
                      }`}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 bg-orange-100"
                      >
                        <Icon
                          className="w-3.5 h-3.5 text-orange-600"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate text-gray-900">
                          {n.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {formatDate(n.createdAt)}
                        </p>
                      </div>
                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0 mt-1.5" />
                    </button>
                  );
                })}
                </div>
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card className="overflow-hidden h-full flex flex-col">
              <CardHeader className="p-5 pb-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800">Quick Actions</h3>
              </CardHeader>
              <CardContent className="p-3 space-y-1">
                {[
                  {
                    to: "/candidate/profile",
                    icon: User,
                    label: "Complete Profile",
                  },
                  {
                    to: "/candidate/jobs",
                    icon: Briefcase,
                    label: "Browse Jobs",
                  },
                  {
                    to: "/candidate/applications",
                    icon: FileText,
                    label: "My Applications",
                  },
                  {
                    to: "/candidate/support",
                    icon: HelpCircle,
                    label: "Get Support",
                  },
                  {
                    to: "/candidate/payments",
                    icon: CreditCard,
                    label: "Payment History",
                  },
                ].map(({ to, icon: Icon, label }) => (
                  <Link
                    key={to}
                    to={to}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-700 transition-colors group"
                  >
                    <Icon className="w-4 h-4 text-gray-400 group-hover:text-orange-500 transition-colors" />
                    {label}
                    <ChevronRight className="w-3.5 h-3.5 ml-auto text-gray-300 group-hover:text-orange-400" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
};

export default CandidateDashboard;
