import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Ticket,
  Clock,
  CheckCircle,
  Zap,
  Search,
  LayoutGrid,
  Eye,
  Loader2,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import { Card } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { adminService } from "../../services/admin.service";

// Model uses title-case: Open, In Progress, Resolved, Closed
const PRIORITY_COLORS = {
  Low: "bg-emerald-100 text-emerald-800",
  Medium: "bg-amber-100 text-amber-800",
  High: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-800",
};
const STATUS_COLORS = {
  Open: "bg-red-100 text-red-800",
  "In Progress": "bg-amber-100 text-amber-800",
  Resolved: "bg-emerald-100 text-emerald-800",
  Closed: "bg-gray-100 text-gray-800",
};



const Support = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");

  // Map tab id → model status value
  const STATUS_MAP = {
    open: "Open",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  const statusFilter = activeTab === "all" ? undefined : STATUS_MAP[activeTab];

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support-tickets", statusFilter],
    queryFn: () =>
      adminService.getSupportTickets({ status: statusFilter, limit: 50 }),
  });
  const { data: statsData } = useQuery({
    queryKey: ["admin-support-stats"],
    queryFn: adminService.getSupportStats,
  });

  // Service normalizes to { tickets: [...], meta: {...} }
  const tickets = data?.tickets || [];
  const statusStats = statsData?.statusStats || [];
  const count = (name) => statusStats.find((s) => s._id === name)?.count || 0;
  const totalCount = statusStats.reduce((sum, s) => sum + (s.count || 0), 0);

  const statCards = [
    {
      title: "OPEN",
      value: count("Open"),
      color: "border-l-red-500",
      icon: Ticket,
    },
    {
      title: "IN PROGRESS",
      value: count("In Progress"),
      color: "border-l-amber-500",
      icon: Clock,
    },
    {
      title: "RESOLVED",
      value: count("Resolved"),
      color: "border-l-emerald-500",
      icon: CheckCircle,
    },
    {
      title: "TOTAL",
      value: totalCount,
      color: "border-l-orange-500",
      icon: Zap,
    },
  ];

  const tabs = [
    { id: "all", label: "All", count: totalCount },
    { id: "open", label: "Open", count: count("Open") },
    { id: "in_progress", label: "In Progress", count: count("In Progress") },
    { id: "resolved", label: "Resolved", count: count("Resolved") },
    { id: "closed", label: "Closed", count: count("Closed") },
  ];

  const filtered = search
    ? tickets.filter(
        (t) =>
          t.title?.toLowerCase().includes(search.toLowerCase()) ||
          t.ticketId?.toLowerCase().includes(search.toLowerCase()) ||
          t.raisedBy?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
          t.raisedBy?.email?.toLowerCase().includes(search.toLowerCase()) ||
          t.guestContact?.name?.toLowerCase().includes(search.toLowerCase()) ||
          t.guestContact?.email?.toLowerCase().includes(search.toLowerCase()) ||
          t.registrationNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : tickets;
  const displayTickets = filtered.map((ticket) => ({
    ...ticket,
    raisedBy: ticket.raisedBy || {
      fullName: ticket.guestContact?.name || "Public candidate",
      email:
        ticket.guestContact?.email ||
        ticket.guestContact?.mobile ||
        "No contact provided",
    },
  }));

  return (
    <AdminLayout title="Support">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Support Management
            </h1>
            <p className="text-gray-600 text-sm">
              Manage support tickets from candidates.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/support/kanban")}
            className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300"
          >
            <LayoutGrid className="w-4 h-4 mr-2" />
            Kanban View
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((s) => (
            <Card key={s.title} className={`border-l-4 ${s.color} bg-white`}>
              <div className="p-5 flex justify-between items-start">
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {s.title}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Number(s.value).toLocaleString("en-IN")}
                  </p>
                </div>
                <s.icon className="w-5 h-5 text-gray-400" />
              </div>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-orange-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <Badge className="bg-gray-100 text-gray-600 text-xs">
                  {tab.count}
                </Badge>
              </button>
            ))}
          </nav>
        </div>

        {/* Search */}
        <div className="relative max-w-sm rounded-2xl border border-orange-100 bg-orange-50/60 p-3 shadow-sm">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
          <input
            type="text"
            placeholder="Search by subject, ticket ID, or candidate..."
            className="w-full pl-9 pr-4 py-2 border border-orange-100 rounded-xl bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <Card className="bg-white">
          <div className="admin-data-scroll hover-scroll overflow-auto">
            <table className="w-full min-w-[1080px] table-fixed">
              <colgroup>
                <col className="w-[14%]" />
                <col className="w-[22%]" />
                <col className="w-[20%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[4%]" />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {[
                    "Ticket ID",
                    "Subject",
                    "Candidate",
                    "Category",
                    "Priority",
                    "Status",
                    "Created",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-normal ${["Priority", "Status", "Created", "Actions"].includes(h) ? "text-center" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading && (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                      Loading tickets...
                    </td>
                  </tr>
                )}
                {!isLoading && filtered.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-gray-500">
                      No tickets found.
                    </td>
                  </tr>
                )}
                {displayTickets.map((ticket) => (
                  <tr
                    key={ticket._id}
                    className="hover:bg-orange-50 transition-colors"
                  >
                    <td className="py-4 px-4">
                      <span className="font-mono text-sm font-semibold text-orange-600">
                        {ticket.ticketId}
                      </span>
                    </td>
                    <td className="py-4 px-4 max-w-[220px]">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {ticket.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <p className="text-xs text-gray-500">
                          {ticket.category}
                        </p>
                        {ticket.resolutionAction?.type ===
                          "application_correction" && (
                          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                            Correction
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-sm text-gray-900">
                        {ticket.raisedBy?.fullName || "—"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {ticket.raisedBy?.email || "—"}
                      </p>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-700">
                      {ticket.category || "—"}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        className={
                          PRIORITY_COLORS[ticket.priority] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {ticket.priority || "Medium"}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge
                        className={
                          STATUS_COLORS[ticket.status] ||
                          "bg-gray-100 text-gray-800"
                        }
                      >
                        {ticket.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center text-sm text-gray-600">
                      {ticket.createdAt
                        ? new Date(ticket.createdAt).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          navigate(`/admin/support/ticket/${ticket._id}`)
                        }
                        className="text-orange-600 hover:bg-orange-100"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default Support;





