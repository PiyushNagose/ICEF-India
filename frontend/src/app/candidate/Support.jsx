import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HelpCircle,
  Plus,
  Eye,
  Loader2,
  X,
  MessageSquare,
  Paperclip,
} from "lucide-react";
import toast from "react-hot-toast";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";

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

// Must match backend enum exactly
const CATEGORIES = [
  "Technical",
  "Payment",
  "General",
  "Document",
  "Application",
];

const Support = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    title: "",
    category: "General",
    description: "",
    priority: "Medium",
    linkedApplicationId: "",
    transactionId: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [attachmentFile, setAttachmentFile] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-tickets"],
    queryFn: () => candidateService.getMyTickets({ limit: 50 }),
  });

  // Backend returns tickets directly or nested
  const tickets = Array.isArray(data)
    ? data
    : data?.tickets || data?.data || [];

  const { data: applicationsData, isLoading: isLoadingApplications } = useQuery(
    {
      queryKey: ["candidate-applications-for-support"],
      queryFn: () => candidateService.getMyApplications({ limit: 100 }),
    },
  );
  const { data: paymentsData, isLoading: isLoadingPayments } = useQuery({
    queryKey: ["candidate-payments-for-support"],
    queryFn: () => candidateService.getMyPayments({ limit: 100 }),
  });

  // Filter applications - only show submitted/under_review/approved (not draft)
  // AND only applications whose job deadline hasn't passed yet
  // This prevents candidates from raising tickets for expired jobs
  const allApplications = Array.isArray(applicationsData)
    ? applicationsData
    : applicationsData?.applications || applicationsData?.data || [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const applications = allApplications.filter((app) => {
    const statusOk = [
      "submitted",
      "under_review",
      "approved",
      "shortlisted",
    ].includes(app.status);
    const deadline = app.jobId?.applicationDeadline
      ? new Date(app.jobId.applicationDeadline)
      : null;
    const deadlineOk = deadline ? deadline >= today : true;
    return statusOk && deadlineOk;
  });

  const payments = Array.isArray(paymentsData)
    ? paymentsData
    : paymentsData?.payments || paymentsData?.data || [];

  const { mutate: createTicket, isPending } = useMutation({
    mutationFn: (payload) => candidateService.createTicket(payload),
    onSuccess: () => {
      toast.success("Support ticket created successfully");
      queryClient.invalidateQueries({ queryKey: ["candidate-tickets"] });
      setShowCreate(false);
      setForm({
        title: "",
        category: "General",
        description: "",
        priority: "Medium",
        linkedApplicationId: "",
        transactionId: "",
      });
      setFormErrors({});
      setAttachmentFile(null);
    },
    onError: (err) => toast.error(err.message || "Failed to create ticket"),
  });

  const { mutateAsync: uploadAttachment, isPending: isUploadingAttachment } =
    useMutation({
      mutationFn: (file) => candidateService.uploadSupportAttachment(file),
      onError: (err) =>
        toast.error(err.message || "Failed to upload attachment"),
    });

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "Subject is required";
    else if (form.title.trim().length < 5)
      e.title = "Subject must be at least 5 characters";
    if (!form.description.trim()) e.description = "Description is required";
    else if (form.description.trim().length < 10)
      e.description = "Description must be at least 10 characters";
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    let attachments = [];
    if (attachmentFile) {
      const uploaded = await uploadAttachment(attachmentFile);
      const attachmentUrl = uploaded?.url || uploaded?.attachment?.url;
      if (attachmentUrl) attachments = [attachmentUrl];
    }
    createTicket({
      title: form.title.trim(),
      category: form.category,
      description: form.description.trim(),
      priority: form.priority,
      linkedApplicationId: form.linkedApplicationId || undefined,
      transactionId: form.transactionId || undefined,
      attachments,
    });
  };

  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter(
    (t) => t.status === "In Progress",
  ).length;
  const resolvedCount = tickets.filter((t) =>
    ["Resolved", "Closed"].includes(t.status),
  ).length;

  return (
    <CandidateLayout title="Support Center">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Help & Support</h1>
            <p className="text-gray-600 text-sm">
              Raise and track your support tickets
            </p>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Ticket
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Open", value: openCount, color: "border-l-red-500" },
            {
              label: "In Progress",
              value: inProgressCount,
              color: "border-l-yellow-500",
            },
            {
              label: "Resolved",
              value: resolvedCount,
              color: "border-l-green-500",
            },
          ].map((s) => (
            <Card key={s.label} className={`border-l-4 ${s.color}`}>
              <div className="p-4">
                <p className="text-xs text-gray-500 font-medium uppercase">
                  {s.label}
                </p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {s.value}
                </p>
              </div>
            </Card>
          ))}
        </div>

        {/* Create Ticket Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800">
                  Create Support Ticket
                </h3>
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setFormErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Brief description of your issue"
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${formErrors.title ? "border-red-400" : "border-gray-300"}`}
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                  />
                  {formErrors.title && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.title}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={form.category}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, category: e.target.value }))
                      }
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Priority
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={form.priority}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, priority: e.target.value }))
                      }
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                </div>

                {(form.category === "Application" ||
                  form.category === "Document" ||
                  form.category === "Payment") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Linked Application{" "}
                      {form.category === "Payment" && "(Optional)"}
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={form.linkedApplicationId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          linkedApplicationId: e.target.value,
                        }))
                      }
                      disabled={isLoadingApplications}
                    >
                      <option value="">
                        {isLoadingApplications
                          ? "Loading applications..."
                          : applications.length === 0
                            ? "No active applications found"
                            : "Select application (optional)"}
                      </option>
                      {applications.map((app) => (
                        <option key={app._id} value={app._id}>
                          {app.applicationId} - {app.status}
                        </option>
                      ))}
                    </select>
                    {!isLoadingApplications && applications.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Only submitted applications with an active deadline can
                        be linked. Expired or draft applications are not shown.
                      </p>
                    )}
                    {!isLoadingApplications && applications.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        Select the application related to your issue for faster
                        resolution.
                      </p>
                    )}
                  </div>
                )}

                {form.category === "Payment" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Transaction ID (Optional)
                    </label>
                    <select
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      value={form.transactionId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          transactionId: e.target.value,
                        }))
                      }
                      disabled={isLoadingPayments}
                    >
                      <option value="">
                        {isLoadingPayments
                          ? "Loading transactions..."
                          : payments.length === 0
                            ? "No transactions found"
                            : "Select transaction (optional)"}
                      </option>
                      {payments.map((payment) => (
                        <option
                          key={payment._id || payment.transactionId}
                          value={payment.transactionId}
                        >
                          {payment.transactionId} - ₹{payment.amount} -{" "}
                          {payment.status}
                        </option>
                      ))}
                    </select>
                    {!isLoadingPayments && payments.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        You haven't made any payments yet.
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows="4"
                    placeholder="Describe your issue in detail. Include any error messages, application IDs, or transaction IDs if relevant."
                    className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none ${formErrors.description ? "border-red-400" : "border-gray-300"}`}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                  {formErrors.description && (
                    <p className="text-red-500 text-xs mt-1">
                      {formErrors.description}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attachment
                  </label>
                  <label className="flex items-center justify-between gap-3 px-4 py-3 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50">
                    <span className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                      <Paperclip className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      <span className="truncate">
                        {attachmentFile?.name ||
                          "Upload screenshot or PDF proof"}
                      </span>
                    </span>
                    <span className="text-xs font-medium text-orange-700">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,application/pdf"
                      className="hidden"
                      onChange={(e) =>
                        setAttachmentFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG, or PDF up to 500KB.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreate(false);
                    setFormErrors({});
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isPending || isUploadingAttachment}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  {isPending || isUploadingAttachment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isUploadingAttachment ? "Uploading..." : "Submitting..."}
                    </>
                  ) : (
                    "Submit Ticket"
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-800">
              My Tickets ({tickets.length})
            </h3>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-6 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading tickets...
              </div>
            )}
            {!isLoading && tickets.length === 0 && (
              <div className="p-8 text-center">
                <HelpCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  No support tickets yet
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Create a ticket if you need help with your application
                </p>
                <Button
                  onClick={() => setShowCreate(true)}
                  className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Ticket
                </Button>
              </div>
            )}
            {tickets.map((ticket) => (
              <div
                key={ticket._id}
                onClick={() => navigate(`/candidate/support/${ticket._id}`)}
                className="grid grid-cols-1 gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-orange-50 cursor-pointer transition-colors sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_92px_96px_118px_44px] lg:items-center"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <HelpCircle className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">
                      {ticket.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 min-w-0">
                      <span className="text-xs font-mono text-orange-600">
                        {ticket.ticketId}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-500 truncate">
                        {ticket.category}
                      </span>
                      {ticket.replies?.length > 0 && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            {ticket.replies.length}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 sm:text-right lg:text-left">
                  {ticket.createdAt
                    ? new Date(ticket.createdAt).toLocaleDateString("en-IN")
                    : ""}
                </p>
                <div className="flex sm:col-span-2 lg:col-span-1">
                  <Badge
                    className={`whitespace-nowrap ${
                      PRIORITY_COLORS[ticket.priority] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {ticket.priority}
                  </Badge>
                </div>
                <div className="flex sm:col-span-2 lg:col-span-1">
                  <Badge
                    className={`whitespace-nowrap ${
                      STATUS_COLORS[ticket.status] ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {ticket.status}
                  </Badge>
                </div>
                <div className="hidden lg:flex justify-end">
                  <Eye className="w-4 h-4 text-gray-400" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Help Tips */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <h4 className="font-medium text-blue-800 mb-2">
              Tips for faster resolution
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>
                • Include your Application ID or Transaction ID in the
                description
              </li>
              <li>
                • Select the correct category for faster routing to the right
                team
              </li>
              <li>
                • Mark as High/Critical only for urgent payment or submission
                issues
              </li>
              <li>
                • Check your notifications for replies from our support team
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </CandidateLayout>
  );
};

export default Support;
