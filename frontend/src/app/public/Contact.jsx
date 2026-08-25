import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock3,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Search,
  Send,
} from "lucide-react";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  HelpPanel,
  PageFrame,
  PageHero,
  fadeUp,
  publicContainer,
} from "./PublicPageShell";
import { publicService } from "../../services/public.service";
import CustomSelect from "../../components/ui/CustomSelect";

const inputClass =
  "h-12 w-full rounded border border-[#d9cec0] bg-white px-4 text-sm text-[#111827] outline-none transition focus:border-[#e65f16] focus:ring-2 focus:ring-orange-100";

const textareaClass =
  "w-full resize-none rounded border border-[#d9cec0] bg-white px-4 py-3 text-sm text-[#111827] outline-none transition focus:border-[#e65f16] focus:ring-2 focus:ring-orange-100";

const initialForm = {
  name: "",
  email: "",
  mobile: "",
  registrationNumber: "",
  applicationId: "",
  category: "Application",
  priority: "Medium",
  title: "",
  description: "",
};

const initialLookup = {
  ticketId: "",
  contact: "",
};

const contactCards = [
  {
    icon: Phone,
    title: "Helpline",
    description: "1800-123-4567, Monday to Friday, 9:00 AM to 6:00 PM.",
  },
  {
    icon: Mail,
    title: "Email Support",
    description: "support@recruitment.gov.in for application and payment queries.",
  },
  {
    icon: MapPin,
    title: "Office",
    description: "Recruitment Portal Helpdesk, New Delhi, India.",
  },
];

const statusClass = {
  Open: "bg-red-50 text-red-700 border-red-200",
  "In Progress": "bg-amber-50 text-amber-700 border-amber-200",
  Resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Closed: "bg-gray-100 text-gray-700 border-gray-200",
};

const Contact = () => {
  const [mode, setMode] = useState("raise");
  const [form, setForm] = useState(initialForm);
  const [lookup, setLookup] = useState(initialLookup);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [replying, setReplying] = useState(false);
  const [submitted, setSubmitted] = useState(null);
  const [ticket, setTicket] = useState(null);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setLookupField = (key, value) =>
    setLookup((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .map(([key, value]) => [key, String(value || "").trim()])
          .filter(([, value]) => value),
      );
      const result = await publicService.submitSupportEnquiry(payload);
      setSubmitted(result);
      setForm(initialForm);
      setLookup({ ticketId: result.ticketId, contact: payload.mobile || payload.email });
      toast.success(`Ticket created: ${result.ticketId}`);
    } catch (error) {
      toast.error(error?.message || "Unable to submit support request");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchTicket = async (event) => {
    event?.preventDefault();
    setTracking(true);
    try {
      const result = await publicService.lookupSupportTicket({
        ticketId: lookup.ticketId.trim(),
        contact: lookup.contact.trim(),
      });
      setTicket(result.ticket);
      setMode("track");
    } catch (error) {
      setTicket(null);
      toast.error(error?.message || "Ticket not found");
    } finally {
      setTracking(false);
    }
  };

  const submitReply = async () => {
    if (!reply.trim()) return;
    setReplying(true);
    try {
      const result = await publicService.replySupportTicket({
        ticketId: lookup.ticketId.trim(),
        contact: lookup.contact.trim(),
        message: reply.trim(),
      });
      setTicket(result.ticket);
      setReply("");
      toast.success("Reply submitted");
    } catch (error) {
      toast.error(error?.message || "Unable to submit reply");
    } finally {
      setReplying(false);
    }
  };

  return (
    <PageFrame>
      <PageHero
        eyebrow="Support"
        title="Contact the Recruitment Helpdesk"
        description="Raise application, payment, document, admit card, and portal access queries without logging in."
      />

      <section className={`${publicContainer} py-8 lg:py-10`}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] lg:items-stretch">
          <motion.div
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="rounded border border-[#ded4c8] bg-white shadow-sm flex flex-col h-full"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eadfd2] p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e65f16]">
                  Public Helpdesk
                </p>
                <h2 className="mt-2 text-[24px] font-black leading-tight text-[#1f1d1b]">
                  Support Ticket Centre
                </h2>
              </div>
              <div className="flex rounded border border-[#eadfd2] bg-[#fbf7f1] p-1">
                <TabButton active={mode === "raise"} onClick={() => setMode("raise")}>
                  Raise Ticket
                </TabButton>
                <TabButton active={mode === "track"} onClick={() => setMode("track")}>
                  Track Ticket
                </TabButton>
              </div>
            </div>

            {mode === "raise" ? (
              <form onSubmit={submit} className="p-5 lg:p-6 flex flex-col flex-1">
                {submitted && (
                  <div className="mb-5 rounded border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
                    <div className="flex items-center gap-2 font-black">
                      <CheckCircle2 className="h-5 w-5" />
                      Ticket Submitted
                    </div>
                    <p className="mt-1 text-sm">
                      Ticket ID:{" "}
                      <span className="font-mono font-black">{submitted.ticketId}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("track");
                        fetchTicket();
                      }}
                      className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-emerald-800 underline"
                    >
                      Track this ticket
                    </button>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full Name *">
                    <input
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      required
                      className={inputClass}
                      placeholder="Candidate name"
                    />
                  </Field>
                  <Field label="Mobile *">
                    <input
                      value={form.mobile}
                      onChange={(e) =>
                        set("mobile", e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      required
                      className={inputClass}
                      placeholder="10-digit mobile"
                    />
                  </Field>
                  <Field label="Email *" wide>
                    <input
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      required
                      type="email"
                      className={inputClass}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <Field label="Registration No.">
                    <input
                      value={form.registrationNumber}
                      onChange={(e) => set("registrationNumber", e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Application ID">
                    <input
                      value={form.applicationId}
                      onChange={(e) => set("applicationId", e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Category *">
                    <CustomSelect
                      value={form.category}
                      onChange={(value) => set("category", value)}
                      options={["Application", "Payment", "Document", "Technical", "General"].map(
                        (option) => ({ value: option, label: option }),
                      )}
                      placeholder="Select category"
                    />
                  </Field>
                  <Field label="Priority">
                    <CustomSelect
                      value={form.priority}
                      onChange={(value) => set("priority", value)}
                      options={["Low", "Medium", "High", "Critical"].map((option) => ({
                        value: option,
                        label: option,
                      }))}
                      placeholder="Select priority"
                    />
                  </Field>
                  <Field label="Subject *" wide>
                    <input
                      value={form.title}
                      onChange={(e) => set("title", e.target.value)}
                      required
                      className={inputClass}
                      placeholder="Brief issue title"
                    />
                  </Field>
                  <Field label="Description *" wide>
                    <textarea
                      value={form.description}
                      onChange={(e) => set("description", e.target.value)}
                      required
                      rows={5}
                      className={textareaClass}
                      placeholder="Explain the issue clearly..."
                    />
                  </Field>
                </div>

                <div className="mt-auto pt-5">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded bg-[#e65f16] text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_28px_rgba(230,95,22,0.22)] transition hover:bg-[#cb5d16] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    {submitting ? "Submitting..." : "Submit Ticket"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-5 lg:p-6 flex flex-col flex-1">
                <form
                  onSubmit={fetchTicket}
                  className="grid gap-4 border-b border-[#eadfd2] pb-5 md:grid-cols-[1fr_1fr_auto]"
                >
                  <Field label="Ticket ID *">
                    <input
                      value={lookup.ticketId}
                      onChange={(e) => setLookupField("ticketId", e.target.value)}
                      required
                      className={inputClass}
                      placeholder="TKT-..."
                    />
                  </Field>
                  <Field label="Email or Mobile *">
                    <input
                      value={lookup.contact}
                      onChange={(e) => setLookupField("contact", e.target.value)}
                      required
                      className={inputClass}
                      placeholder="Registered contact"
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={tracking}
                    className="mt-auto flex h-12 items-center justify-center gap-2 rounded bg-[#e65f16] px-6 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#cb5d16] disabled:opacity-60"
                  >
                    <Search className="h-4 w-4" />
                    {tracking ? "Checking" : "Check"}
                  </button>
                </form>

                {ticket ? (
                  <div className="mt-5 space-y-5">
                    <div className="rounded border border-[#eadfd2] bg-[#fbf7f1] p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-xs font-black text-[#e65f16]">
                            {ticket.ticketId}
                          </p>
                          <h3 className="mt-1 text-[18px] font-black text-[#1f1d1b] break-words line-clamp-2" title={ticket.title}>
                            {ticket.title}
                          </h3>
                          <p className="mt-1 text-[14px] leading-[26px] text-[#5f5752] font-medium">
                            {ticket.category} query raised on {formatDate(ticket.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-black ${
                            statusClass[ticket.status] || statusClass.Open
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[#3f4652] whitespace-pre-wrap break-words">
                        {ticket.description}
                      </p>
                    </div>

                    <div className="rounded border border-[#eadfd2]">
                      <div className="flex items-center gap-2 border-b border-[#eadfd2] px-4 py-3">
                        <MessageSquare className="h-4 w-4 text-[#e65f16]" />
                        <h3 className="font-black text-[#111827]">Conversation</h3>
                      </div>
                      <div className="max-h-80 space-y-3 overflow-y-auto p-4">
                        {ticket.replies?.length ? (
                          ticket.replies.map((item, index) => {
                            const adminReply = item.sentByModel === "Employee";
                            return (
                              <div
                                key={`${item.createdAt || index}-${index}`}
                                className={`rounded p-3 ${
                                  adminReply
                                    ? "ml-8 bg-[#fff4e7]"
                                    : "mr-8 bg-[#f6f1ea]"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-xs font-black text-[#111827]">
                                    {adminReply ? "Support Team" : "You"}
                                  </span>
                                  <span className="text-xs font-medium text-[#7a8594]">
                                    {formatDate(item.createdAt)}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm leading-6 text-[#3f4652] whitespace-pre-wrap break-words">
                                  {item.message}
                                </p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="rounded bg-[#fbf7f1] p-4 text-sm font-medium text-[#667085]">
                            No replies yet. The support team will respond here.
                          </div>
                        )}
                      </div>
                    </div>

                    {["Resolved", "Closed"].includes(ticket.status) ? (
                      <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
                        This ticket is {ticket.status.toLowerCase()}. Raise a new ticket if
                        you need more help.
                      </div>
                    ) : (
                      <div className="rounded border border-[#eadfd2] p-4">
                        <Field label="Add Follow-up Reply">
                          <textarea
                            value={reply}
                            onChange={(e) => setReply(e.target.value)}
                            rows={4}
                            className={textareaClass}
                            placeholder="Write your follow-up message..."
                          />
                        </Field>
                        <button
                          type="button"
                          disabled={!reply.trim() || replying}
                          onClick={submitReply}
                          className="mt-3 flex h-11 items-center justify-center gap-2 rounded bg-[#e65f16] px-5 text-xs font-black uppercase tracking-[0.12em] text-white transition hover:bg-[#cb5d16] disabled:opacity-60"
                        >
                          <Send className="h-4 w-4" />
                          {replying ? "Sending..." : "Send Reply"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-5 rounded border border-[#eadfd2] bg-[#fbf7f1] p-5 text-sm font-medium text-[#667085]">
                    Enter your Ticket ID and the same email or mobile used while creating
                    the ticket.
                  </div>
                )}
              </div>
            )}
          </motion.div>

          <motion.aside
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className="flex flex-col gap-5 sm:grid sm:grid-cols-2 lg:flex lg:flex-col h-full"
          >
            <div className="rounded border border-[#ded4c8] bg-white p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded bg-[#fff4e7] text-[#e65f16]">
                  <Clock3 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-black text-[#111827]">Keep Ticket ID Safe</h3>
                  <p className="text-sm font-medium text-[#667085]">
                    It is required for public tracking.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 lg:grid-cols-1">
              {contactCards.map((card, i) => (
                <motion.div
                  key={card.title}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.2 }}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="flex flex-col"
                >
                  <div className="h-full rounded border border-[#e0d7cd] bg-white p-5 shadow-sm transition-all hover:border-orange-300 hover:shadow-md">
                    <card.icon className="h-5 w-5 text-[#e65f16]" />
                    <h3 className="mt-3 text-base font-black text-[#111827]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-[#667085]">
                      {card.description}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
            <HelpPanel />
            <Link
              to="/check-status"
              className="mt-auto flex h-12 shrink-0 items-center justify-center rounded bg-[#e46a1d] text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#cb5d16]"
            >
              View Application Status
            </Link>
          </motion.aside>
        </div>
      </section>
    </PageFrame>
  );
};

const TabButton = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`h-10 rounded px-4 text-xs font-black uppercase tracking-[0.12em] transition ${
      active
        ? "bg-[#e65f16] text-white shadow-sm"
        : "text-[#6a625a] hover:text-[#e65f16]"
    }`}
  >
    {children}
  </button>
);

const Field = ({ label, wide = false, children }) => (
  <label className={`space-y-2 ${wide ? "md:col-span-2" : ""}`}>
    <span className="text-xs font-black uppercase tracking-[0.14em] text-[#4f5661]">
      {label}
    </span>
    {children}
  </label>
);

const formatDate = (value) => {
  if (!value) return "Not available";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default Contact;
