import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCheck,
  Loader2,
  FileText,
  CreditCard,
  HelpCircle,
  Briefcase,
  CheckCircle,
  XCircle,
  Upload,
  AlertCircle,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";
import { REALTIME_ENABLED } from "../../api/config";
import toast from "react-hot-toast";

// Match the Notification model enum values exactly
const TYPE_CONFIG = {
  application_submitted: {
    label: "Application",
    color: "bg-blue-100 text-blue-700",
    icon: FileText,
  },
  application_approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  application_rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  application_correction: {
    label: "Clarification",
    color: "bg-orange-100 text-orange-700",
    icon: AlertCircle,
  },
  document_verified: {
    label: "Document",
    color: "bg-green-100 text-green-700",
    icon: Upload,
  },
  document_rejected: {
    label: "Document",
    color: "bg-red-100 text-red-700",
    icon: Upload,
  },
  payment_success: {
    label: "Payment",
    color: "bg-green-100 text-green-700",
    icon: CreditCard,
  },
  payment_failed: {
    label: "Payment",
    color: "bg-red-100 text-red-700",
    icon: CreditCard,
  },
  ticket_reply: {
    label: "Support",
    color: "bg-orange-100 text-orange-700",
    icon: HelpCircle,
  },
  ticket_resolved: {
    label: "Support",
    color: "bg-green-100 text-green-700",
    icon: HelpCircle,
  },
  new_job_posted: {
    label: "New Job",
    color: "bg-purple-100 text-purple-700",
    icon: Briefcase,
  },
  admit_card_available: {
    label: "Admit Card",
    color: "bg-blue-100 text-blue-700",
    icon: FileText,
  },
  result_published: {
    label: "Result",
    color: "bg-orange-100 text-orange-700",
    icon: AlertCircle,
  },
  general: { label: "General", color: "bg-gray-100 text-gray-700", icon: Bell },
};

const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.general;

const TABS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

const Notifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("unread");

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-notifications"],
    queryFn: () => candidateService.getNotifications({ limit: 100 }),
    refetchInterval: REALTIME_ENABLED ? false : 60000,
    staleTime: 30000,
  });

  // API returns { notifications: [...], unreadCount: N } as data field
  const allNotifications = data?.notifications || [];
  const unreadCount =
    data?.unreadCount ?? allNotifications.filter((n) => !n.isRead).length;

  const notifications =
    activeTab === "unread"
      ? allNotifications.filter((n) => !n.isRead)
      : allNotifications;

  const { mutateAsync: markRead } = useMutation({
    mutationFn: (id) => candidateService.markNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["candidate-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["candidate-dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["candidate-notifications-count"],
      });
    },
  });

  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: candidateService.markAllNotificationsRead,
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["candidate-notifications"] });
    },
  });

  const handleClick = async (n) => {
    if (!n) return;
    if (!n.isRead) {
      try {
        await markRead(n._id);
      } catch (_) {}
    }
    if (n.link) {
      navigate(n.link);
    }
  };

  return (
    <CandidateLayout title="Notifications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Notifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount > 0 ? (
                <span className="text-orange-600 font-medium">
                  {unreadCount} unread
                </span>
              ) : (
                "All caught up!"
              )}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              onClick={() => markAllRead()}
              disabled={markingAll}
              className="border-orange-200 text-orange-600 hover:bg-orange-50"
            >
              {markingAll ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCheck className="w-4 h-4 mr-2" />
              )}
              Mark All Read
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-orange-200">
          <nav className="-mb-px flex space-x-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {tab.id === "unread" && unreadCount > 0 && (
                  <span className="ml-2 bg-orange-600 text-white text-xs rounded-full px-1.5 py-0.5">
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-8 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading notifications...
              </div>
            )}

            {!isLoading && notifications.length === 0 && (
              <div className="p-10 text-center">
                <BellOff className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {activeTab === "unread"
                    ? "No unread notifications"
                    : "No notifications yet"}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {activeTab === "unread"
                    ? "You're all caught up!"
                    : "You'll be notified about application updates, payments, and support replies here."}
                </p>
              </div>
            )}

            <div className="max-h-[70vh] overflow-y-auto">
            {notifications.map((n) => {
              const cfg = getConfig(n.type);
              const Icon = cfg.icon;
              return (
                <button
                  type="button"
                  key={n._id}
                  onClick={() => handleClick(n)}
                  className={`flex items-start gap-4 p-4 border-b border-gray-100 last:border-0 transition-colors ${
                    n.link ? "cursor-pointer" : "cursor-default"
                  } ${n.isRead ? "w-full text-left bg-white hover:bg-gray-50" : "w-full text-left bg-orange-50 hover:bg-orange-100"}`}
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      n.isRead ? "bg-gray-100" : "bg-orange-100"
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 ${n.isRead ? "text-gray-400" : "text-orange-600"}`}
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm font-semibold leading-snug ${
                          n.isRead ? "text-gray-600" : "text-gray-900"
                        }`}
                      >
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="w-2.5 h-2.5 bg-orange-500 rounded-full flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                      {n.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge className={`text-xs ${cfg.color}`}>
                        {cfg.label}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
            </div>
          </CardContent>
        </Card>
      </div>
    </CandidateLayout>
  );
};

export default Notifications;
