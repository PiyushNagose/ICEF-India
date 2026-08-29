import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Bell,
  Trash2,
  CheckCircle,
  Clock,
  Search,
  Loader2,
  CreditCard,
  FileText,
  Briefcase,
  AlertTriangle,

  Info,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { adminService } from "../../services/admin.service";
import { REALTIME_ENABLED } from "../../api/config";

const TYPE_CFG = {
  payment_success: {
    icon: CreditCard,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Payment",
  },
  payment_failed: {
    icon: CreditCard,
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Payment",
  },
  application_submitted: {
    icon: FileText,
    bg: "bg-blue-100",
    text: "text-blue-700",
    label: "Application",
  },
  application_approved: {
    icon: FileText,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Application",
  },
  application_rejected: {
    icon: FileText,
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Application",
  },
  application_updated: {
    icon: FileText,
    bg: "bg-orange-100",
    text: "text-orange-700",
    label: "Correction",
  },
  application_correction: {
    icon: AlertTriangle,
    bg: "bg-orange-100",
    text: "text-orange-700",
    label: "Correction",
  },
  document_verified: {
    icon: CheckCircle,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Document",
  },
  document_rejected: {
    icon: AlertTriangle,
    bg: "bg-red-100",
    text: "text-red-700",
    label: "Document",
  },
  new_job_posted: {
    icon: Briefcase,
    bg: "bg-purple-100",
    text: "text-purple-700",
    label: "Job",
  },
  ticket_reply: {
    icon: Info,
    bg: "bg-amber-100",
    text: "text-amber-700",
    label: "Support",
  },
  ticket_resolved: {
    icon: CheckCircle,
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    label: "Support",
  },
  general: {
    icon: Bell,
    bg: "bg-gray-100",
    text: "text-gray-700",
    label: "General",
  },
};

const getCfg = (type) => TYPE_CFG[type] || TYPE_CFG.general;
const HIGH_VOLUME_ADMIN_TYPES = new Set([
  "payment_success",
  "application_submitted",
]);

const formatTime = (date) => {
  const diff = Date.now() - new Date(date);
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "application_", label: "Applications" },
  { id: "new_job_posted", label: "Jobs" },
  { id: "general", label: "General" },
];

const AdminNotifications = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("unread");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const queryParams = {
    page,
    limit: 20,
    ...(filter === "unread" && { isRead: "false" }),
    ...(filter !== "all" && filter !== "unread" && { type: filter }),
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-notifications", filter, page],
    queryFn: () => adminService.getAdminNotifications(queryParams),
    refetchInterval: REALTIME_ENABLED ? false : 60000,
    staleTime: 30000,
  });

  const notifications = (data?.notifications || []).filter((n) => {
    if (HIGH_VOLUME_ADMIN_TYPES.has(n.type)) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      n.title?.toLowerCase().includes(term) ||
      n.message?.toLowerCase().includes(term)
    );
  });
  const unreadCount = data?.unreadCount || 0;

  const { mutateAsync: markRead } = useMutation({
    mutationFn: (id) => adminService.markAdminNotificationRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-notifications-count"],
      });
    },
  });

  const { mutate: markAllRead, isPending: markingAll } = useMutation({
    mutationFn: adminService.markAllAdminNotificationsRead,
    onSuccess: () => {
      toast.success("All notifications marked as read");
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [notificationToDelete, setNotificationToDelete] = useState(null);

  const { mutate: deleteNotif } = useMutation({
    mutationFn: (id) => adminService.deleteAdminNotification(id),
    onSuccess: () => {
      toast.success("Notification deleted");
      setDeleteModalOpen(false);
      setNotificationToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["admin-notifications"] });
    },
  });

  const handleNotificationClick = async (notification) => {
    if (!notification) return;
    if (!notification.isRead) {
      try {
        await markRead(notification._id);
      } catch { /* ignore */ }
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <AdminLayout title="Notifications">
      <div className="min-h-full p-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
                : "All caught up!"}
            </p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllRead()}
              disabled={markingAll}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle className="w-4 h-4" />
              )}
              Mark all as read
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notifications..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f.id
                  ? "bg-orange-600 text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-orange-300"
              }`}
            >
              {f.label}
              {f.id === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          )}

          {!isLoading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Bell className="w-12 h-12 text-gray-200 mb-3" />
              <p className="font-medium text-gray-500">No notifications</p>
              <p className="text-sm mt-1">
                {search ? "Try adjusting your search" : "You're all caught up!"}
              </p>
            </div>
          )}

          <div className="hover-scroll max-h-[70vh] overflow-y-auto pr-1">
            {notifications.map((n) => {
              const cfg = getCfg(n.type);
              const Icon = cfg.icon;
              return (
                <div
                  key={n._id}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  className={`flex items-start gap-4 px-5 py-4 border-b border-gray-50 last:border-0 transition-colors ${
                    !n.isRead
                      ? "w-full text-left bg-orange-50/50 hover:bg-orange-100/60"
                      : "w-full text-left hover:bg-gray-50/50"
                  }`}
                >
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}
                  >
                    <Icon className={`w-5 h-5 ${cfg.text}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 text-sm">
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="w-3 h-3" />
                            {formatTime(n.createdAt)}
                          </span>
                          <span
                            className={`whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}
                          >
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!n.isRead && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markRead(n._id);
                        }}
                        className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Mark as read"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNotificationToDelete(n._id);
                        setDeleteModalOpen(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <ConfirmDeleteModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setNotificationToDelete(null);
        }}
        onConfirm={() => deleteNotif(notificationToDelete)}
        title="Delete Notification"
        message="Are you sure you want to delete this notification? This action cannot be undone."
      />
    </AdminLayout>
  );
};

export default AdminNotifications;





