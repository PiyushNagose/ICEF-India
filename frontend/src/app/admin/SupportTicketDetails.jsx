import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Clock,
  User,
  Paperclip,
  Send,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit3,
  CreditCard,
  ExternalLink,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import Button from "../../components/ui/Button";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";
import { adminService } from "../../services/admin.service";

const PRIORITY_COLORS = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
  Low: "bg-green-100 text-green-800",
  Medium: "bg-yellow-100 text-yellow-800",
  High: "bg-orange-100 text-orange-800",
  Critical: "bg-red-100 text-red-800",
};

const STATUS_COLORS = {
  open: "bg-red-100 text-red-800",
  Open: "bg-red-100 text-red-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-yellow-100 text-yellow-800",
  resolved: "bg-green-100 text-green-800",
  Resolved: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  Closed: "bg-gray-100 text-gray-800",
};

const STATUS_FLOW = ["Open", "In Progress", "Resolved", "Closed"];

// Returns only statuses that are ahead of the current one
const getAllowedNextStatuses = (currentStatus) => {
  const idx = STATUS_FLOW.indexOf(currentStatus);
  if (idx === -1) return STATUS_FLOW; // unknown status — show all
  return STATUS_FLOW.slice(idx + 1);
};

const SupportTicketDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support-ticket", id],
    queryFn: () => adminService.getSupportTicket(id),
  });

  const ticket = data?.ticket || data;

  const { mutate: updateTicket, isPending: isUpdating } = useMutation({
    mutationFn: (updates) => adminService.updateSupportTicket(id, updates),
    onSuccess: () => {
      toast.success("Ticket updated");
      queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to update ticket"),
  });

  const { mutate: sendReply, isPending: isSending } = useMutation({
    mutationFn: (message) => adminService.replyToTicket(id, { message }),
    onSuccess: () => {
      toast.success("Reply sent");
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", id] });
    },
    onError: (err) => toast.error(err.message || "Failed to send reply"),
  });

  const { mutate: requestCorrection, isPending: isRequestingCorrection } =
    useMutation({
      mutationFn: () =>
        adminService.requestTicketCorrection(id, {
          note: replyText.trim() || undefined,
        }),
      onSuccess: () => {
        toast.success("Correction requested");
        setReplyText("");
        queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", id] });
        queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
      },
      onError: (err) =>
        toast.error(err.message || "Failed to request correction"),
    });

  const { mutate: verifyPayment, isPending: isVerifyingPayment } = useMutation({
    mutationFn: () =>
      adminService.verifyTicketPayment(id, {
        note: replyText.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success("Payment verified");
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["admin-support-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-support-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to verify payment"),
  });

  const handleStatusChange = (newStatus) => {
    updateTicket({ status: newStatus });
  };

  const handlePriorityChange = (newPriority) => {
    updateTicket({ priority: newPriority });
  };

  const handleSendReply = () => {
    if (!replyText.trim()) return;
    sendReply(replyText.trim());
  };

  const formatTime = (ts) => {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading)
    return (
      <AdminLayout title="Ticket Details">
        <div className="flex items-center justify-center min-h-full">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      </AdminLayout>
    );

  if (!ticket)
    return (
      <AdminLayout title="Ticket Details">
        <div className="p-6">
          <p className="text-gray-600">Ticket not found.</p>
          <Button
            variant="outline"
            onClick={() => navigate("/admin/support")}
            className="mt-4"
          >
            Back to Support
          </Button>
        </div>
      </AdminLayout>
    );

  const replies = ticket.replies || ticket.messages || [];
  const candidate =
    ticket.raisedBy ||
    ticket.candidateId || {
      fullName: ticket.guestContact?.name,
      email: ticket.guestContact?.email,
      registeredMobile: ticket.guestContact?.mobile,
    };
  const linkedApplication = ticket.linkedApplication;
  const linkedPayment = ticket.linkedPayment;
  const action = ticket.resolutionAction || {};

  return (
    <AdminLayout title="Ticket Details">
      <div className="min-h-full p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/support")}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Ticket Details
              </h1>
              <p className="text-gray-500 text-sm font-mono text-orange-600">
                {ticket.ticketId || id}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              className={
                PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-800"
              }
            >
              {ticket.priority?.toUpperCase()}
            </Badge>
            <Badge
              className={
                STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-800"
              }
            >
              {ticket.status?.replace("_", " ").toUpperCase()}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Ticket Info */}
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-2">
                  {ticket.title}
                </h2>
                <p className="text-gray-600 text-sm leading-relaxed">
                  {ticket.description}
                </p>
                {ticket.attachments?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {ticket.attachments.map((attachment, index) => (
                      <a
                        key={attachment}
                        href={attachment}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:border-orange-300 hover:text-orange-700"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                        Attachment {index + 1}
                      </a>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500">Category</p>
                    <p className="text-sm font-medium text-gray-800 capitalize">
                      {ticket.category || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Created</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatTime(ticket.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Last Updated</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatTime(ticket.updatedAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Conversation */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Conversation</h3>
                  <span className="text-sm text-gray-500">
                    ({replies.length} messages)
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages */}
                <div className="hover-scroll max-h-96 overflow-y-auto p-6 space-y-4">
                  {replies.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No messages yet.
                    </p>
                  ) : (
                    replies.map((msg, i) => {
                      const isAgent =
                        msg.sentByModel === "Employee" ||
                        msg.senderType === "Employee" ||
                        msg.senderType === "agent" ||
                        msg.isAdmin;
                      return (
                        <div
                          key={msg._id || i}
                          className={`flex ${isAgent ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-sm lg:max-w-md rounded-xl px-4 py-3 ${
                              isAgent
                                ? "bg-orange-600 text-white"
                                : "bg-gray-100 text-gray-900"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-4 mb-1">
                              <span
                                className={`text-xs font-semibold ${isAgent ? "text-orange-100" : "text-gray-600"}`}
                              >
                                {msg.sentByName ||
                                  msg.senderName ||
                                  msg.sender ||
                                  (isAgent ? "Support Team" : "Candidate")}
                              </span>
                              <span
                                className={`text-xs ${isAgent ? "text-orange-200" : "text-gray-400"}`}
                              >
                                {formatTime(msg.createdAt || msg.timestamp)}
                              </span>
                            </div>
                            <p className="text-sm">
                              {msg.message || msg.content}
                            </p>
                            {msg.attachments?.length > 0 && (
                              <div className="mt-2 space-y-1">
                                {msg.attachments.map((att, j) => (
                                  <div
                                    key={j}
                                    className="flex items-center gap-1 text-xs opacity-80"
                                  >
                                    <Paperclip className="w-3 h-3" />
                                    <span>{att.name || att}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Reply Box */}
                {ticket.status !== "Closed" && ticket.status !== "closed" && (
                  <div className="p-6 border-t border-gray-100">
                    <textarea
                      rows={3}
                      placeholder="Type your reply to the candidate..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && e.ctrlKey) handleSendReply();
                      }}
                    />
                    <div className="flex justify-between items-center mt-3">
                      <p className="text-xs text-gray-400">
                        Ctrl+Enter to send
                      </p>
                      <Button
                        onClick={handleSendReply}
                        disabled={!replyText.trim() || isSending}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Reply
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Candidate Info */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">
                    Candidate Info
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Name</p>
                  <p className="text-sm font-medium text-gray-900">
                    {candidate.fullName || candidate.name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Email</p>
                  <p className="text-sm font-medium text-gray-900">
                    {candidate.email || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Phone</p>
                  <p className="text-sm font-medium text-gray-900">
                    {candidate.phone || candidate.contactNumber || "—"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Public Tracking</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Source</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {(ticket.source || "candidate_portal").replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Contact</p>
                    <p className="text-sm font-medium text-gray-900">
                      {ticket.guestContact?.mobile ||
                        candidate.registeredMobile ||
                        "Not available"}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Registration Number</p>
                  <p className="text-sm font-medium text-gray-900">
                    {ticket.registrationNumber || "Not linked"}
                  </p>
                </div>
                <div className="rounded-lg bg-orange-50 border border-orange-100 p-3">
                  <p className="text-xs font-semibold text-orange-800">
                    First response due
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTime(ticket.sla?.firstResponseDueAt)}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-orange-800">
                    Resolution due
                  </p>
                  <p className="text-sm font-medium text-gray-900">
                    {formatTime(ticket.sla?.resolutionDueAt)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-900">Update Ticket</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status
                  </label>
                  {/* Current status badge */}
                  <div className="mb-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 flex items-center gap-2">
                    {ticket.status === "Open" && <AlertCircle className="w-4 h-4 text-red-500" />}
                    {(ticket.status === "In Progress" || ticket.status === "in_progress") && <Clock className="w-4 h-4 text-yellow-500" />}
                    {(ticket.status === "Resolved" || ticket.status === "resolved") && <CheckCircle className="w-4 h-4 text-green-500" />}
                    {(ticket.status === "Closed" || ticket.status === "closed") && <XCircle className="w-4 h-4 text-gray-500" />}
                    <span className="text-sm font-semibold text-orange-700">
                      Current: {ticket.status?.replace("_", " ")}
                    </span>
                  </div>
                  {/* Only forward transitions */}
                  {(() => {
                    const normalised = STATUS_FLOW.find(
                      (s) => s.toLowerCase().replace(" ", "_") === (ticket.status || "").toLowerCase().replace(" ", "_") || s === ticket.status
                    ) || ticket.status;
                    const allowed = getAllowedNextStatuses(normalised);
                    if (allowed.length === 0) {
                      return (
                        <p className="text-xs text-gray-400 italic">This ticket is closed and cannot be advanced further.</p>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {allowed.map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(s)}
                            disabled={isUpdating}
                            className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200 text-gray-700 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700"
                          >
                            {s === "In Progress" && <Clock className="w-4 h-4 inline mr-2 text-yellow-500" />}
                            {s === "Resolved" && <CheckCircle className="w-4 h-4 inline mr-2 text-green-500" />}
                            {s === "Closed" && <XCircle className="w-4 h-4 inline mr-2 text-gray-500" />}
                            Move to {s}
                          </button>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={ticket.priority || ""}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    disabled={isUpdating}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Linked Application */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">
                    Linked Application
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {linkedApplication ? (
                  <>
                    <div>
                      <p className="text-xs text-gray-500">Application ID</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {linkedApplication.applicationId}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">
                        Registration Number
                      </p>
                      <p className="text-sm font-semibold text-gray-900">
                        {linkedApplication.registrationNumber ||
                          ticket.registrationNumber ||
                          "Pending"}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <p className="text-sm font-medium text-gray-900">
                          {linkedApplication.status}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment</p>
                        <p className="text-sm font-medium text-gray-900">
                          {linkedApplication.paymentStatus}
                        </p>
                      </div>
                    </div>
                    {linkedApplication.appliedPosts?.length > 0 && (
                      <div>
                        <p className="text-xs text-gray-500">Applied Posts</p>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {linkedApplication.appliedPosts.map((post, index) => (
                            <span
                              key={`${post.postCode || post.title}-${index}`}
                              className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-semibold text-orange-700"
                            >
                              {post.title || post.designation}
                              {post.postCode ? ` - ${post.postCode}` : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {action.type === "application_correction" && (
                      <div className="rounded-lg bg-orange-50 border border-orange-200 px-3 py-2">
                        <p className="text-xs font-medium text-orange-800">
                          Correction: {action.status?.replaceAll("_", " ")}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() =>
                          navigate(`/admin/applications/${linkedApplication._id}`)
                        }
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </Button>
                      <Button
                        onClick={() => requestCorrection()}
                        disabled={
                          isRequestingCorrection ||
                          action.status === "candidate_action_required"
                        }
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        {isRequestingCorrection ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Request Correction"
                        )}
                      </Button>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No application linked. Ask the candidate to include an
                    Application ID when creating the ticket.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Payment */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">
                    Payment Information
                  </h3>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {linkedPayment ? (
                  <>
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-gray-500">Amount</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₹{Number(linkedPayment.amount || 0).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-gray-500">Transaction</span>
                      <span className="text-xs font-mono text-gray-900">
                        {linkedPayment.transactionId}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-xs text-gray-500">Status</span>
                      <span className="text-sm font-semibold text-green-700">
                        {linkedPayment.status}
                      </span>
                    </div>
                    <Button
                      onClick={() => verifyPayment()}
                      disabled={isVerifyingPayment || linkedPayment.status === "success"}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                    >
                      {isVerifyingPayment ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4 mr-2" />
                      )}
                      Verify Payment
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    No payment linked. Payment tickets should include the
                    transaction ID.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-orange-600" />
                  <h3 className="font-semibold text-gray-900">Timeline</h3>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-900">
                        Ticket Created
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(ticket.createdAt)}
                      </p>
                    </div>
                  </div>
                  {ticket.assignedAt && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">
                          Assigned
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(ticket.assignedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {ticket.resolvedAt && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">
                          Resolved
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(ticket.resolvedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-900">
                          Closed
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(ticket.closedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default SupportTicketDetails;





