import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Layers,
  Plus,
  Eye,
  Pencil,
  Trash2,
  Globe,
  FileText,
  Archive,
  Clock,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Megaphone,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import { adminService } from "../../services/admin.service";
import { hasPermission, useAuth, isSuperAdminUser } from "../../hooks/useAuth";
import ConfirmDeleteModal from "../../components/ui/ConfirmDeleteModal";
import { AdminTableShell } from "../../components/ui/AdminTable";
import AdminKpiCard from "../../components/ui/AdminKpiCard";

const STATUS_CFG = {
  published: {
    label: "Published",
    bg: "bg-emerald-100",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  draft: {
    label: "Draft",
    bg: "bg-amber-100",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  archived: {
    label: "Archived",
    bg: "bg-gray-100",
    text: "text-gray-600",
    dot: "bg-gray-400",
  },
};

const StateInitial = ({ state }) => {
  const words = state.trim().split(" ");
  const initials =
    words.length >= 2
      ? (words[0][0] + words[1][0]).toUpperCase()
      : state.slice(0, 2).toUpperCase();
  const colors = [
    "bg-orange-500",
    "bg-blue-500",
    "bg-purple-500",
    "bg-teal-500",
    "bg-rose-500",
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
  ];
  const color = colors[state.charCodeAt(0) % colors.length];
  return (
    <div
      className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center text-white text-xs font-bold shrink-0`}
    >
      {initials}
    </div>
  );
};

const getPageProjectId = (page) =>
  page?.projectId?._id || page?.projectId || "";
const getPageState = (page) =>
  page?.projectId?.state || String(page?.state || "").split("::project:")[0];
const getPageTitle = (page) => page?.projectId?.name || getPageState(page);
const getEditPath = (page) => {
  const state = encodeURIComponent(getPageState(page));
  const projectId = getPageProjectId(page);
  return `/admin/cms/edit/${state}${projectId ? `?project=${projectId}` : ""}`;
};
const getPublicPath = (page) => {
  const slug = page?.projectId?.publicSlug || page?.publicSlug || "";
  return slug ? `/apply/${slug}` : "";
};

// Time-ago helper
const timeAgo = (date) => {
  if (!date) return "â€”";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
};

// Icon + colour per activity type
const ACTIVITY_CFG = {
  edit: { Icon: Pencil, bg: "bg-orange-100", color: "text-orange-600" },
  publish: { Icon: Globe, bg: "bg-emerald-100", color: "text-emerald-600" },
  archive: { Icon: Archive, bg: "bg-gray-100", color: "text-gray-600" },
  create: { Icon: Plus, bg: "bg-blue-100", color: "text-blue-600" },
  announcement: {
    Icon: Megaphone,
    bg: "bg-amber-100",
    color: "text-amber-600",
  },
  draft: { Icon: FileText, bg: "bg-orange-100", color: "text-orange-600" },
  system: { Icon: Layers, bg: "bg-orange-100", color: "text-orange-600" },
};

const CmsHome = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isPrivilegedDelete = isSuperAdminUser(user);
  const canCreate = hasPermission(user, "cms", "create");
  const canEdit = hasPermission(user, "cms", "edit");
  const canDelete = hasPermission(user, "cms", "delete");
  const canDownload = hasPermission(user, "cms", "download");
  const [statusFilter, setStatusFilter] = useState("");
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, page: null });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-cms-pages"],
    queryFn: () => adminService.getCmsPages(),
  });

  const { data: activityData, isLoading: activityLoading } = useQuery({
    queryKey: ["admin-cms-activity"],
    queryFn: () => adminService.getCmsActivity(8),
    refetchInterval: 30000, // auto-refresh every 30s
  });

  const { mutate: deletePage, isPending: deleting } = useMutation({
    mutationFn: ({ state, projectId }) =>
      adminService.deleteCmsPage(state, projectId ? { projectId } : {}),
    onSuccess: (result) => {
      toast.success(result?.message || "State page deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
    },
    onError: (err) => toast.error(err.message || "Failed to delete"),
  });

  const confirmDelete = () => {
    if (deleteModal.page) {
      const pageState = getPageState(deleteModal.page);
      const projectId = getPageProjectId(deleteModal.page);
      deletePage({ state: pageState, projectId });
      setDeleteModal({ isOpen: false, page: null });
    }
  };

  const handleViewPage = (page) => {
    const publicPath = getPublicPath(page);
    if (!publicPath) {
      toast.error("Public page is not available for this CMS record.");
      return;
    }
    navigate(publicPath);
  };

  const pages = data?.pages || [];
  const stats = data?.stats || {};

  const filtered = statusFilter
    ? pages.filter((p) => p.status === statusFilter)
    : pages;

  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "â€”";

  const lastUpdated = stats.lastUpdated
    ? (() => {
        // eslint-disable-next-line react-hooks/purity
        const diff = Date.now() - new Date(stats.lastUpdated).getTime();
        const h = Math.floor(diff / 3600000);
        if (h < 1) return "Just now";
        if (h < 24) return `${h}h ago`;
        return `${Math.floor(h / 24)}d ago`;
      })()
    : "â€”";

  return (
    <AdminLayout title="CMS">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-normal text-orange-500 uppercase mb-1">
              Admin Panel
            </p>
            <h1 className="text-2xl font-bold text-gray-900">
              Content Management
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Manage project landing pages, official announcements, notices,
              and candidate-facing recruitment content.
            </p>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate("/admin/cms/create")}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <Plus className="w-4 h-4" />
              Create Landing Page
            </button>
          )}
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <AdminKpiCard
            icon={Layers}
            title="Total Landing Pages"
            value={stats.total ?? 0}
            tone="orange"
            helper={stats.total > 0 ? "+2 New" : "—"}
            valueClassName="text-2xl"
          />
          <AdminKpiCard icon={Globe} title="Published" value={stats.published ?? 0} tone="green" valueClassName="text-2xl" />
          <AdminKpiCard icon={FileText} title="Draft" value={stats.draft ?? 0} tone="amber" valueClassName="text-2xl" />
          <AdminKpiCard icon={Clock} title="Last Updated" value={lastUpdated} tone="blue" valueClassName="text-2xl" />
        </div>

        {/* Pages table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="font-semibold text-gray-900">
              Landing Pages Overview
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter */}
              <div className="flex items-center gap-1">
                <Filter className="w-4 h-4 text-gray-400" />
                {["", "published", "draft", "archived"].map((s) => (
                  <button
                    key={s || "all"}
                    onClick={() => setStatusFilter(s)}
                    className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-xs font-bold transition-all ${
                      statusFilter === s
                        ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                        : "border-orange-100 bg-orange-50/40 text-gray-600 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600"
                    }`}
                  >
                    {s ? s.charAt(0).toUpperCase() + s.slice(1) : "All"}
                  </button>
                ))}
              </div>
              {canDownload && (
                <button className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-orange-100 bg-white px-3 text-xs font-bold text-gray-600 transition-colors hover:border-orange-200 hover:bg-orange-50 hover:text-orange-600">
                  <Download className="w-3.5 h-3.5" /> Export
                </button>
              )}
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm font-medium">No state pages found</p>
              {canCreate && (
                <button
                  onClick={() => navigate("/admin/cms/create")}
                  className="mt-1 inline-flex h-9 items-center justify-center rounded-lg border border-orange-100 bg-orange-50 px-4 text-sm font-bold text-orange-600 transition-colors hover:border-orange-200 hover:bg-orange-100"
                >
                  Create your first state page
                </button>
              )}
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <AdminTableShell className="rounded-none border-0 shadow-none">
              <table className="w-full min-w-[920px] table-fixed">
                <colgroup>
                  <col className="w-[24%]" />
                  <col className="w-[13%]" />
                  <col className="w-[18%]" />
                  <col className="w-[17%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    {[
                      "Landing Page",
                      "Status",
                      "Featured Projects",
                      "Last Updated",
                      "Updated By",
                      "Actions",
                    ].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-5 text-xs font-semibold text-gray-500 uppercase tracking-normal ${["Status", "Featured Projects", "Last Updated", "Updated By", "Actions"].includes(h) ? "text-center" : "text-left"}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((page) => {
                    const cfg = page.isSoftDeleted
                      ? {
                          label: "Removed by employee",
                          bg: "bg-amber-100",
                          text: "text-amber-700",
                          dot: "bg-amber-500",
                        }
                      : STATUS_CFG[page.status] || STATUS_CFG.draft;
                    const pageState = getPageState(page);
                    const pageTitle = getPageTitle(page);
                    const projectId = getPageProjectId(page);
                    return (
                      <tr
                        key={page._id}
                        className="hover:bg-gray-50/60 transition-colors group"
                      >
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <StateInitial state={pageState} />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-gray-900 text-sm">
                                {pageTitle}
                              </span>
                              {projectId && (
                                <span className="block truncate text-xs text-gray-400">
                                  {pageState} project landing
                                </span>
                              )}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                            />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-600">
                          {page.featuredJobs?.length ?? 0} Projects
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-600">
                          {formatDate(page.updatedAt)}
                        </td>
                        <td className="py-4 px-5 text-center text-sm text-gray-500">
                          Admin
                        </td>
                        <td className="py-4 px-5 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {canEdit && (
                              <button
                                onClick={() => navigate(getEditPath(page))}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                                title="Edit"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleViewPage(page)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-colors"
                              title="View Public Page"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button
                                onClick={() => setDeleteModal({ isOpen: true, page })}
                                disabled={deleting}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </AdminTableShell>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Recent Activity
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Latest CMS updates across project landing pages.
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 uppercase tracking-normal">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>

          {activityLoading && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="flex min-h-[82px] items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3 animate-pulse"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-gray-100 rounded w-5/6" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                    <div className="h-2.5 bg-gray-100 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!activityLoading && !activityData?.activities?.length && (
            <div className="text-center py-10 text-gray-400">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">
                No activity yet. Create your first state page.
              </p>
            </div>
          )}

          {!activityLoading && activityData?.activities?.length > 0 && (
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {activityData.activities.map((a) => {
                const cfg = ACTIVITY_CFG[a.type] || ACTIVITY_CFG.edit;
                const { Icon } = cfg;
                return (
                  <div
                    key={a.id}
                    className="flex min-h-[82px] items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/40 p-3 transition-colors hover:border-orange-100 hover:bg-orange-50/30"
                  >
                    <div
                      className={`w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center shrink-0`}
                    >
                      <Icon className={`w-4 h-4 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="line-clamp-2 text-sm font-medium leading-5 text-gray-900">
                        {a.text}
                      </p>
                      <p className="mt-2 flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" />
                        {timeAgo(a.time)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-5 border-t border-gray-100 pt-4 text-center text-xs uppercase tracking-normal text-gray-400">
            Real-time update stream active - refreshes every 30s
          </p>
        </div>
      </div>
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, page: null })}
        onConfirm={confirmDelete}
        title="Delete CMS Page"
        message={
          isPrivilegedDelete
            ? `Are you sure you want to permanently delete the page for "${deleteModal.page ? getPageTitle(deleteModal.page) : ''}"? All related data will be removed.`
            : `Remove "${deleteModal.page ? getPageTitle(deleteModal.page) : 'this page'}" from the employee portal? Admin/superadmin will still see it and receive a notification.`
        }
        requireType={isPrivilegedDelete}
      />
    </AdminLayout>
  );
};

export default CmsHome;
