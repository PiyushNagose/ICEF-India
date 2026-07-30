import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Loader2,
  MessageSquare,
  Send,
  HelpCircle,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  User,
  Shield,
  Edit3,
  CreditCard,
  Paperclip,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";
import { REALTIME_ENABLED } from "../../api/config";
import {
  getFirstApplicationRoute,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

const STATUS_COLORS = {
  Open: "bg-red-100 text-red-700",
  "In Progress": "bg-yellow-100 text-yellow-700",
  Resolved: "bg-green-100 text-green-700",
  Closed: "bg-gray-100 text-gray-700",
};

const PRIORITY_COLORS = {
  Low: "bg-green-100 text-green-700",
  Medium: "bg-yellow-100 text-yellow-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

const StatusIcon = ({ status }) => {
  if (status === "Open")
    return <AlertCircle className="w-4 h-4 text-red-500" />;
  if (status === "In Progress")
    return <Clock className="w-4 h-4 text-yellow-500" />;
  if (status === "Resolved")
    return <CheckCircle className="w-4 h-4 text-green-500" />;
  return <XCircle className="w-4 h-4 text-gray-500" />;
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

const SupportTicketDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef(null);

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-ticket", id],
    queryFn: () => candidateService.getTicket(id),
    refetchInterval: REALTIME_ENABLED ? false : 60000,
    staleTime: 30000,
  });

  const ticket = data?.ticket || data;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [ticket?.replies?.length]);

  const { mutate: sendReply, isPending: isSending } = useMutation({
    mutationFn: (message) => candidateService.replyToTicket(id, { message }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["candidate-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["candidate-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to send reply"),
  });

  const { mutate: closeTicket, isPending: isClosing } = useMutation({
    mutationFn: () => candidateService.closeTicket(id),
    onSuccess: () => {
      toast.success("Ticket closed successfully");
      queryClient.invalidateQueries({ queryKey: ["candidate-ticket", id] });
      queryClient.invalidateQueries({ queryKey: ["candidate-tickets"] });
    },
    onError: (err) => toast.error(err.message || "Failed to close ticket"),
  });

  const { mutate: completeAction, isPending: isCompletingAction } = useMutation(
    {
      mutationFn: () => candidateService.completeTicketAction(id),
      onSuccess: () => {
        toast.success("Support team notified");
        queryClient.invalidateQueries({ queryKey: ["candidate-ticket", id] });
        queryClient.invalidateQueries({ queryKey: ["candidate-tickets"] });
      },
      onError: (err) =>
        toast.error(err.message || "Failed to complete support action"),
    },
  );

  const handleSend = () => {
    const msg = replyText.trim();
    if (!msg) return;
    sendReply(msg);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading)
    return (
      <CandidateLayout title="Support Ticket">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <span className="ml-3 text-gray-600">Loading ticket...</span>
        </div>
      </CandidateLayout>
    );

  if (!ticket)
    return (
      <CandidateLayout title="Support Ticket">
        <div className="text-center py-20">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600">Ticket not found.</p>
          <Button
            variant="outline"
            onClick={() => navigate("/candidate/support")}
            className="mt-4"
          >
            Back to Support
          </Button>
        </div>
      </CandidateLayout>
    );

  const replies = ticket.replies || [];
  const isClosed = ticket.status === "Closed";
  const isResolved = ticket.status === "Resolved";
  const linkedApplication = ticket.linkedApplication;
  const linkedPayment = ticket.linkedPayment;
  const action = ticket.resolutionAction || {};
  const canCorrectApplication =
    action.type === "application_correction" &&
    action.status === "candidate_action_required" &&
    linkedApplication;
  // Once the candidate has submitted corrections, the edit button is locked
  const correctionAlreadySubmitted =
    linkedApplication?.correction?.status === "submitted" ||
    action.status === "candidate_completed";

  const openApplicationCorrection = () => {
    // Pass both correctionMode and the support ticket id so the
    // Success page "Back to Support Ticket" button works correctly
    persistApplicationDraft({
      applicationId: linkedApplication._id,
      jobId: linkedApplication.jobId?._id || linkedApplication.jobId,
      correctionMode: true,
      supportTicketId: id, // current ticket id from useParams
    });
    // Navigate to step 1 — sidebar is fully unlocked in correction mode
    const route = getFirstApplicationRoute(linkedApplication);
    navigate(route, {
      state: {
        applicationId: linkedApplication._id,
        jobId: linkedApplication.jobId?._id || linkedApplication.jobId,
      },
    });
  };

  return (
    <CandidateLayout title="Support Ticket">
      <div className="space-y-6 w-full">
        {/* Header */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
          <button
            onClick={() => navigate("/candidate/support")}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors mt-1 flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-800 truncate">
              {ticket.title}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <span className="text-sm font-mono text-orange-600">
                {ticket.ticketId}
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-500">{ticket.category}</span>
              <span className="text-gray-400">•</span>
              <span className="text-sm text-gray-500">
                {formatTime(ticket.createdAt)}
              </span>
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap items-center gap-2 lg:col-span-1 lg:justify-end">
            <Badge
              className={
                PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-700"
              }
            >
              {ticket.priority}
            </Badge>
            <Badge
              className={`flex items-center gap-1 ${STATUS_COLORS[ticket.status] || "bg-gray-100 text-gray-700"}`}
            >
              <StatusIcon status={ticket.status} />
              {ticket.status}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)] items-start gap-6">
          {/* Main — Conversation */}
          <div className="space-y-4 min-w-0">
            {/* Original Issue */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-orange-600" />
                  Issue Description
                </h3>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
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
              </CardContent>
            </Card>

            {/* Conversation Thread */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-orange-600" />
                  Conversation
                  <span className="text-sm font-normal text-gray-500">
                    ({replies.length} messages)
                  </span>
                </h3>
              </CardHeader>
              <CardContent className="p-0">
                {/* Messages */}
                <div className="hover-scroll min-h-[260px] max-h-[clamp(360px,52vh,560px)] overflow-y-auto p-4 space-y-4">
                  {replies.length === 0 ? (
                    <div className="text-center py-8">
                      <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No messages yet.</p>
                      <p className="text-gray-400 text-xs mt-1">
                        Our support team will respond shortly.
                      </p>
                    </div>
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
                          className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`flex items-start gap-2 max-w-[88%] sm:max-w-[78%] min-w-0 ${isAgent ? "flex-row" : "flex-row-reverse"}`}
                          >
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isAgent ? "bg-orange-100" : "bg-blue-100"
                              }`}
                            >
                              {isAgent ? (
                                <Shield className="w-4 h-4 text-orange-600" />
                              ) : (
                                <User className="w-4 h-4 text-blue-600" />
                              )}
                            </div>
                            <div>
                              <div
                                className={`flex items-center gap-2 mb-1 ${isAgent ? "" : "justify-end"}`}
                              >
                                <span className="text-xs font-medium text-gray-600">
                                  {isAgent
                                    ? msg.sentByName || "Support Team"
                                    : "You"}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatTime(msg.createdAt)}
                                </span>
                              </div>
                              <div
                                className={`rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                                  isAgent
                                    ? "bg-orange-50 border border-orange-200 text-gray-800 rounded-tl-none"
                                    : "bg-blue-600 text-white rounded-tr-none"
                                }`}
                              >
                                {msg.message}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Reply / Closed state */}
                {isClosed ? (
                  <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-lg text-center">
                    <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
                      <XCircle className="w-4 h-4" />
                      This ticket is closed. You cannot reply to a closed
                      ticket.
                    </p>
                  </div>
                ) : (
                  <div className="p-4 border-t border-gray-100">
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <textarea
                        rows={2}
                        placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                        className="min-h-[76px] flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                      <Button
                        onClick={handleSend}
                        disabled={!replyText.trim() || isSending}
                        className="bg-orange-600 hover:bg-orange-700 text-white sm:self-end px-4 py-3"
                      >
                        {isSending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 min-w-0 lg:sticky lg:top-0">
            {/* Ticket Info */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800">Ticket Info</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    Status
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusIcon status={ticket.status} />
                    <span className="text-sm font-medium text-gray-800">
                      {ticket.status}
                    </span>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    Priority
                  </p>
                  <Badge
                    className={`mt-1 ${PRIORITY_COLORS[ticket.priority] || "bg-gray-100 text-gray-700"}`}
                  >
                    {ticket.priority}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    Category
                  </p>
                  <p className="text-sm font-medium text-gray-800 mt-1">
                    {ticket.category}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    Ticket ID
                  </p>
                  <p className="text-sm font-mono text-orange-600 mt-1">
                    {ticket.ticketId}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-medium">
                    Created
                  </p>
                  <p className="text-sm text-gray-800 mt-1">
                    {formatTime(ticket.createdAt)}
                  </p>
                </div>
                {ticket.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Resolved
                    </p>
                    <p className="text-sm text-gray-800 mt-1">
                      {formatTime(ticket.resolvedAt)}
                    </p>
                  </div>
                )}
                {ticket.assignedTo && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-medium">
                      Assigned To
                    </p>
                    <p className="text-sm text-gray-800 mt-1">
                      {ticket.assignedTo.fullName || "Support Agent"}
                    </p>
                  </div>
                )}

                {/* Close Ticket — only show when Resolved */}
                {isResolved && (
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-2">
                      Issue resolved? Close this ticket.
                    </p>
                    <Button
                      onClick={() => closeTicket()}
                      disabled={isClosing}
                      variant="outline"
                      className="w-full text-gray-600 border-gray-300 hover:bg-gray-50"
                    >
                      {isClosing ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Closing...
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 mr-2" />
                          Close Ticket
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {(linkedApplication || linkedPayment) && (
              <Card>
                <CardHeader>
                  <h3 className="font-semibold text-gray-800">
                    Resolution Action
                  </h3>
                </CardHeader>
                <CardContent className="space-y-3">
                  {linkedApplication && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start gap-2">
                        <Edit3 className="w-4 h-4 text-orange-600 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase font-medium">
                            Application
                          </p>
                          <p className="text-sm font-semibold text-gray-900">
                            {linkedApplication.applicationId}
                          </p>
                          {action.type === "application_correction" && (
                            <p className="text-xs text-orange-700 mt-1 capitalize">
                              {action.status?.replaceAll("_", " ")}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {linkedPayment && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <div className="flex items-start gap-2">
                        <CreditCard className="w-4 h-4 text-green-600 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase font-medium">
                            Payment
                          </p>
                          <p className="text-xs font-mono text-gray-900 truncate">
                            {linkedPayment.transactionId}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {linkedPayment.status}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  {canCorrectApplication && (
                    <div className="space-y-2">
                      {correctionAlreadySubmitted ? (
                        <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-3">
                          <p className="text-xs font-semibold text-green-800 flex items-center gap-2">
                            <CheckCircle className="w-4 h-4" />
                            Corrections already submitted
                          </p>
                          <p className="text-xs text-green-700 mt-1">
                            Your edits have been sent to the admin for
                            re-review. You cannot edit again until admin
                            reviews.
                          </p>
                        </div>
                      ) : (
                        <>
                          <Button
                            onClick={openApplicationCorrection}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit Application
                          </Button>
                          <p className="text-xs text-gray-500 text-center">
                            Make your corrections, then submit from the Review
                            step.
                          </p>
                        </>
                      )}
                    </div>
                  )}
                  {action.status === "candidate_completed" && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                      <p className="text-xs font-medium text-green-800">
                        Your corrections were submitted. Admin has been notified
                        for re-review.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-600" />
                  Timeline
                </h3>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-gray-800">
                        Ticket Created
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatTime(ticket.createdAt)}
                      </p>
                    </div>
                  </div>
                  {replies.length > 0 && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">
                          First Response
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(replies[0]?.createdAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {ticket.resolvedAt && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">
                          Resolved
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatTime(ticket.resolvedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                  {ticket.closedAt && (
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="w-2 h-2 rounded-full bg-gray-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-gray-800">
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

            {/* Help tip */}
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-orange-800 mb-1">
                  Need faster help?
                </p>
                <p className="text-xs text-orange-700">
                  For urgent payment issues, mark your ticket as Critical. Our
                  team responds to Critical tickets within 2 hours.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </CandidateLayout>
  );
};

export default SupportTicketDetail;
