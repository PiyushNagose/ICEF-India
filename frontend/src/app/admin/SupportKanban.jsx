/* eslint-disable react-hooks/preserve-manual-memoization */
import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  rectIntersection,
  useDroppable,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LayoutList,
  Loader2,
  GripVertical,
  ExternalLink,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Circle,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import Button from "../../components/ui/Button";
import { adminService } from "../../services/admin.service";

// ── Column definitions ────────────────────────────────────────────────────────
const COLUMNS = [
  {
    id: "Open",
    label: "Open",
    headerBg: "bg-red-500",
    colBg: "bg-red-50",
    border: "border-red-200",
    activeBorder: "border-red-400",
    activeBg: "bg-red-100",
    Icon: Circle,
    iconColor: "text-red-400",
  },
  {
    id: "In Progress",
    label: "In Progress",
    headerBg: "bg-amber-500",
    colBg: "bg-amber-50",
    border: "border-amber-200",
    activeBorder: "border-amber-400",
    activeBg: "bg-amber-100",
    Icon: RefreshCw,
    iconColor: "text-amber-400",
  },
  {
    id: "Resolved",
    label: "Resolved",
    headerBg: "bg-emerald-500",
    colBg: "bg-emerald-50",
    border: "border-emerald-200",
    activeBorder: "border-emerald-400",
    activeBg: "bg-emerald-100",
    Icon: CheckCircle2,
    iconColor: "text-emerald-400",
  },
  {
    id: "Closed",
    label: "Closed",
    headerBg: "bg-gray-500",
    colBg: "bg-gray-50",
    border: "border-gray-200",
    activeBorder: "border-gray-400",
    activeBg: "bg-gray-100",
    Icon: XCircle,
    iconColor: "text-gray-400",
  },
];

const COLUMN_IDS = COLUMNS.map((c) => c.id);

// ── Priority helpers ──────────────────────────────────────────────────────────
const PRIORITY_CFG = {
  low:      { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" },
  medium:   { bg: "bg-amber-100",   text: "text-amber-700",   dot: "bg-amber-500"   },
  high:     { bg: "bg-orange-100",  text: "text-orange-700",  dot: "bg-orange-500"  },
  critical: { bg: "bg-red-100",     text: "text-red-700",     dot: "bg-red-500"     },
};
const getPriority = (p) => PRIORITY_CFG[(p || "").toLowerCase()] || PRIORITY_CFG.medium;

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—";

const candidateName = (t) =>
  t.raisedBy?.fullName ||
  t.candidateId?.fullName ||
  t.guestContact?.name ||
  t.raisedByEmail ||
  t.guestContact?.email ||
  t.guestContact?.mobile ||
  "Public candidate";

// ── Static overlay card (no dnd hooks) ───────────────────────────────────────
const OverlayCard = ({ ticket }) => {
  const p = getPriority(ticket.priority);
  return (
    <div className="w-[260px] bg-white rounded-xl border-2 border-orange-400 shadow-2xl rotate-2 opacity-95 pointer-events-none">
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="font-semibold text-gray-900 text-xs line-clamp-2 flex-1">
            {ticket.subject || ticket.title || "Untitled"}
          </p>
          <span className={`shrink-0 inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full text-xs font-bold ${p.bg} ${p.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            {(ticket.priority || "").charAt(0).toUpperCase() + (ticket.priority || "").slice(1).toLowerCase()}
          </span>
        </div>
        <p className="text-xs font-mono text-orange-500 font-semibold">
          {ticket.ticketId || "—"}
        </p>
      </div>
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <User className="w-3 h-3" />{candidateName(ticket)}
        </span>
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <Clock className="w-3 h-3" />{fmtDate(ticket.createdAt)}
        </span>
      </div>
    </div>
  );
};

// ── Draggable ticket card ─────────────────────────────────────────────────────
// KEY FIX: attributes + listeners go on the OUTER element (same as setNodeRef)
// The whole card is the drag handle. The navigate button stops propagation.
const TicketCard = ({ ticket, onNavigate }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ticket._id });

  const p = getPriority(ticket.priority);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.25 : 1,
        cursor: isDragging ? "grabbing" : "grab",
        touchAction: "none",           // required for touch/pointer sensors
        userSelect: "none",
      }}
      className={`bg-white rounded-xl border shadow-sm transition-shadow duration-200 ease-out
        ${isDragging ? "border-orange-300 shadow-lg" : "border-gray-100 hover:shadow-md hover:border-orange-200"}`}
    >
      {/* Card body */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex items-start gap-1.5 flex-1 min-w-0">
            <GripVertical className="w-3.5 h-3.5 mt-0.5 text-gray-300 shrink-0" />
            <p className="font-semibold text-gray-900 text-xs leading-snug line-clamp-2">
              {ticket.subject || ticket.title || "Untitled"}
            </p>
          </div>
          <span className={`shrink-0 inline-flex items-center gap-1 whitespace-nowrap px-1.5 py-0.5 rounded-full text-xs font-bold ${p.bg} ${p.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
            {(ticket.priority || "").charAt(0).toUpperCase() + (ticket.priority || "").slice(1).toLowerCase()}
          </span>
        </div>

        <p className="text-xs font-mono text-orange-500 font-semibold ml-5 mb-1">
          {ticket.ticketId || "—"}
        </p>

        {ticket.description && (
          <p className="text-xs text-gray-500 line-clamp-2 ml-5 leading-relaxed">
            {ticket.description}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-gray-50 bg-gray-50/60 rounded-b-xl">
        <span className="text-xs text-gray-500 flex items-center gap-1 min-w-0">
          <User className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[80px]">{candidateName(ticket)}</span>
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Clock className="w-3 h-3" />{fmtDate(ticket.createdAt)}
          </span>
          {/* Stop pointer events so this button doesn't trigger drag */}
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onNavigate(ticket._id); }}
            className="p-1 rounded text-gray-300 hover:text-orange-500 hover:bg-orange-50 transition-colors"
            title="Open ticket"
          >
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Droppable column ──────────────────────────────────────────────────────────
const KanbanColumn = ({ col, tickets, onNavigate, isOver }) => {
  // useDroppable on the scrollable inner div so empty columns are still droppable
  const { setNodeRef } = useDroppable({ id: col.id });
  const { Icon } = col;

  return (
    <div
      className={`flex flex-col rounded-2xl border-2 overflow-hidden min-h-[520px] transition-colors duration-200 ease-out
        ${isOver ? `${col.activeBg} ${col.activeBorder}` : `${col.colBg} ${col.border}`}`}
    >
      {/* Column header */}
      <div className={`${col.headerBg} px-4 py-3 flex items-center justify-between shrink-0`}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-white/90" />
          <h3 className="font-bold text-white text-sm">{col.label}</h3>
        </div>
        <span className="whitespace-nowrap text-xs font-bold px-2.5 py-0.5 rounded-full bg-white/25 text-white">
          {tickets.length}
        </span>
      </div>

      {/* Drop zone — this div is registered with useDroppable */}
      <div
        ref={setNodeRef}
        className="hover-scroll flex-1 p-3 overflow-y-auto"
        style={{ minHeight: 200 }}
      >
        <SortableContext
          items={tickets.map((t) => t._id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2.5">
            {tickets.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-14 rounded-xl border-2 border-dashed
                ${isOver ? col.activeBorder : col.border} text-gray-400 transition-colors`}>
                <Icon className={`w-8 h-8 mb-2 opacity-20 ${col.iconColor}`} />
                <p className="text-xs font-medium">
                  {isOver ? "Release to drop" : "No tickets"}
                </p>
              </div>
            ) : (
              tickets.map((ticket) => (
                <TicketCard
                  key={ticket._id}
                  ticket={ticket}
                  onNavigate={onNavigate}
                />
              ))
            )}
          </div>
        </SortableContext>
      </div>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const SupportKanban = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTicket, setActiveTicket] = useState(null);
  const [overColId, setOverColId] = useState(null);
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [optimisticBoard, setOptimisticBoard] = useState(null);

  // ── Sensor: low distance threshold so drag activates quickly ───────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  // ── Data ────────────────────────────────────────────────────────────────────
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ["admin-support-tickets-kanban"],
    queryFn: () => adminService.getSupportTickets({ limit: 200 }),
    refetchOnWindowFocus: false,
  });

  const { data: statsData } = useQuery({
    queryKey: ["admin-support-stats"],
    queryFn: adminService.getSupportStats,
  });

  // Clear optimistic state when fresh server data arrives
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptimisticBoard(null);
  }, [dataUpdatedAt]);

  const { mutate: saveStatus } = useMutation({
    mutationFn: ({ id, status }) =>
      adminService.updateSupportTicket(id, { status }),
    onSuccess: (_, vars) => {
      toast.success(`Moved to "${vars.status}"`);
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets-kanban"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-stats"] });
    },
    onError: (err) => {
      toast.error(err?.message || "Failed to update");
      setOptimisticBoard(null);
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets-kanban"] });
    },
  });

  // ── Board state ─────────────────────────────────────────────────────────────
  const allTickets = useMemo(() => data?.tickets || [], [data?.tickets]);

  const serverBoard = COLUMNS.reduce((acc, col) => {
    acc[col.id] = allTickets.filter(
      (t) => (t.status || "").toLowerCase() === col.id.toLowerCase(),
    );
    return acc;
  }, {});

  const board = optimisticBoard || serverBoard;

  // Filtered for display only
  const filteredBoard = COLUMNS.reduce((acc, col) => {
    acc[col.id] = (board[col.id] || []).filter((t) => {
      const q = search.toLowerCase();
      const okSearch =
        !search ||
        (t.subject || t.title || "").toLowerCase().includes(q) ||
        (t.ticketId || "").toLowerCase().includes(q) ||
        candidateName(t).toLowerCase().includes(q);
      const okPriority =
        !priorityFilter ||
        (t.priority || "").toLowerCase() === priorityFilter;
      return okSearch && okPriority;
    });
    return acc;
  }, {});

  const statusStats = statsData?.statusStats || [];
  const countByStatus = (name) =>
    statusStats.find((s) => s._id === name)?.count ?? serverBoard[name]?.length ?? 0;

  // Find which column a ticket is in (searches full unfiltered board)
  const findCol = useCallback(
    (ticketId) => {
      for (const col of COLUMNS) {
        if ((board[col.id] || []).some((t) => t._id === ticketId)) return col.id;
      }
      return null;
    },
    [board],
  );

  // ── Drag handlers ───────────────────────────────────────────────────────────
  const onDragStart = useCallback(({ active }) => {
    const ticket = allTickets.find((t) => t._id === active.id);
    setActiveTicket(ticket || null);
  }, [allTickets]);

  const onDragOver = useCallback(({ over }) => {
    if (!over) { setOverColId(null); return; }
    const id = over.id;
    setOverColId(COLUMN_IDS.includes(id) ? id : findCol(id));
  }, [findCol]);

  const onDragEnd = useCallback(({ active, over }) => {
    setActiveTicket(null);
    setOverColId(null);
    if (!over) return;

    const srcCol = findCol(active.id);
    const overId = over.id;
    const dstCol = COLUMN_IDS.includes(overId) ? overId : findCol(overId);

    if (!srcCol || !dstCol || srcCol === dstCol) return;

    const ticket = (board[srcCol] || []).find((t) => t._id === active.id);
    if (!ticket) return;

    // Optimistic move
    setOptimisticBoard((prev) => {
      const base = prev || serverBoard;
      const next = {};
      for (const col of COLUMNS) next[col.id] = [...(base[col.id] || [])];
      next[srcCol] = next[srcCol].filter((t) => t._id !== active.id);
      next[dstCol] = [...next[dstCol], { ...ticket, status: dstCol }];
      return next;
    });

    saveStatus({ id: active.id, status: dstCol });

  }, [findCol, board, serverBoard, saveStatus]);

  const onDragCancel = useCallback(() => {
    setActiveTicket(null);
    setOverColId(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  const total = allTickets.length;

  return (
    <AdminLayout title="Support Kanban">
      <div className="p-6 space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-normal text-orange-500 uppercase mb-1">
              Support Management
            </p>
            <h1 className="text-2xl font-bold text-gray-900">Kanban Board</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              Drag tickets between columns to update their status
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/support")}
            className="border-gray-300 hover:border-orange-400 hover:text-orange-600"
          >
            <LayoutList className="w-4 h-4 mr-2" />
            List View
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {COLUMNS.map((col) => {
            const { Icon } = col;
            return (
              <div key={col.id} className={`bg-white rounded-xl border-2 ${col.border} p-4 flex items-center gap-3`}>
                <div className={`w-10 h-10 rounded-xl ${col.headerBg} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 leading-none">{countByStatus(col.id)}</p>
                  <p className="text-xs text-gray-500 mt-0.5 font-medium">{col.label}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-3 shadow-sm">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-400" />
            <input
              type="text"
              placeholder="Search tickets, IDs, candidates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 border border-orange-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-4 h-4 text-orange-500" />
            {["", "low", "medium", "high", "critical"].map((p) => {
              const cfg = p ? getPriority(p) : null;
              const active = priorityFilter === p;
              return (
                <button
                  key={p || "all"}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    active
                      ? p ? `${cfg.bg} ${cfg.text} border-transparent shadow-sm` : "bg-orange-600 text-white border-orange-600 shadow-sm"
                      : "bg-white text-gray-600 border-orange-100 hover:border-orange-300 hover:text-orange-700"
                  }`}
                >
                  {p ? p.charAt(0).toUpperCase() + p.slice(1) : "All"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Board */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            <p className="text-sm text-gray-500">Loading tickets...</p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-gray-200">
            <AlertCircle className="w-12 h-12 text-gray-300" />
            <p className="text-gray-500 font-medium">No support tickets found</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={rectIntersection}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={onDragCancel}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tickets={filteredBoard[col.id] || []}
                  onNavigate={(id) => navigate(`/admin/support/ticket/${id}`)}
                  isOver={overColId === col.id}
                />
              ))}
            </div>

            <DragOverlay dropAnimation={{ duration: 150, easing: "ease" }}>
              {activeTicket ? <OverlayCard ticket={activeTicket} /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {!isLoading && total > 0 && (
          <p className="text-center text-xs text-gray-400 pb-2">
            {total} ticket{total !== 1 ? "s" : ""}{search || priorityFilter ? " · filtered" : ""}
            {" · "}
            <span className="text-orange-400 font-medium">Drag cards to change status</span>
          </p>
        )}
      </div>
    </AdminLayout>
  );
};

export default SupportKanban;
