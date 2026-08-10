import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  AlertCircle,
  CalendarCheck2,
  CheckCircle2,
  Download,
  Eye,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import PublicLayout from "../../components/layouts/PublicLayout";
import { jobService } from "../../services/job.service";
import { publicService } from "../../services/public.service";
import { showOtpToast } from "../../utils/otpToast";
import {
  EmptyState,
  ErrorState,
  JobListCard,
  LoadingState,
  formatDate,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: "easeOut", delay: i * 0.05 },
  }),
};

const heroContainer = "mx-auto max-w-[1380px] px-4 sm:px-6 lg:px-8";

const FieldLabel = ({ icon: Icon, children }) => (
  <label className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.16em] text-[#2f2b27]">
    {Icon && <Icon className="h-4 w-4 text-[#f15a0b]" />}
    {children}
  </label>
);

const DetailTile = ({ label, value }) => (
  <div className="rounded border border-[#eadfd2] bg-[#fbf7f1] px-4 py-3">
    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7a7168]">
      {label}
    </p>
    <p className="mt-1 text-sm font-black text-[#1f1d1b]">{value || "-"}</p>
  </div>
);

const AdmitCards = () => {
  const { token } = useParams();
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [previewId, setPreviewId] = useState(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-admit-cards"],
    queryFn: () =>
      jobService.getPublicJobs({
        limit: 20,
        sortBy: "examDate",
        sortOrder: "asc",
      }),
  });

  const jobs = (data?.jobs || []).filter((job) => job.examDate).slice(0, 3);

  const lookupMutation = useMutation({
    mutationFn: jobService.lookupPublicAdmitCard,
    onSuccess: (result) => {
      toast.success(result?.message || "Admit card ready");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: jobService.verifyPublicAdmitCard,
  });

  useEffect(() => {
    if (token) verifyMutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleSendOTP = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error("Enter a valid 10-digit mobile number");
      return;
    }
    setSendLoading(true);
    try {
      const response = await publicService.sendOTP(mobile, "mobile");
      setOtpSent(true);
      setOtpVerified(false);
      setOtp("");
      showOtpToast(response, "OTP sent to your mobile");
    } catch (err) {
      if (!err.toastShown) toast.error(err.message || "Failed to send OTP");
    } finally {
      setSendLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast.error("Enter 6-digit OTP");
      return;
    }
    setVerifyLoading(true);
    try {
      await publicService.verifyOTP(mobile, "mobile", otp);
      setOtpVerified(true);
      toast.success("Mobile verified");
    } catch (err) {
      if (!err.toastShown) toast.error("Invalid or expired OTP");
    } finally {
      setVerifyLoading(false);
    }
  };

  const submitLookup = (event) => {
    event.preventDefault();
    if (!registrationNumber.trim()) {
      toast.error("Enter your registration number");
      return;
    }
    if (!otpVerified) {
      toast.error("Verify your registered mobile first");
      return;
    }
    lookupMutation.mutate({
      registrationNumber: registrationNumber.trim().toUpperCase(),
      mobile,
    });
  };

  const result = token ? verifyMutation.data : lookupMutation.data;
  const resultError = token ? verifyMutation.error : lookupMutation.error;
  const resultLoading = token
    ? verifyMutation.isPending
    : lookupMutation.isPending;
  const previewUrl = previewId
    ? `${jobService.getPublicAdmitCardHtmlUrl(previewId)}?embed=1`
    : "";

  return (
    <PublicLayout>
      <div className="min-h-[calc(100vh-90px)] bg-[#f5efe9]">
        <div className="bg-[#201d1a] text-white">
          <div className={`${heroContainer} py-9`}>
            <p className="mb-2 text-[10px] font-black uppercase tracking-[0.18em] text-orange-400">
              Public Service
            </p>
            <h1 className="text-[30px] font-black leading-tight sm:text-[36px]">
              Download Admit Card
            </h1>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-white/70">
              No candidate account is required. Verify your registered mobile
              and the system will allocate your seat only when your admit card
              is requested.
            </p>
          </div>
        </div>

        <section className={`${heroContainer} py-8 lg:py-10`}>
          <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="space-y-5">
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-5 shadow-sm sm:p-6">
                <div className="flex items-start justify-between gap-4 border-b border-[#eadfd2] pb-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-orange-50">
                      {token ? (
                        <ShieldCheck className="h-5 w-5 text-[#f15a0b]" />
                      ) : (
                        <Ticket className="h-5 w-5 text-[#f15a0b]" />
                      )}
                    </div>
                    <div>
                      <h2 className="text-[22px] font-black leading-tight text-[#111827]">
                        {token ? "Verify Printed Admit Card" : "Enter Admit Card Details"}
                      </h2>
                      <p className="mt-1 text-sm font-medium leading-6 text-[#5f6877]">
                        {token
                          ? "Public verification result from the QR/barcode token."
                          : "Use the registration number issued after payment and your registered mobile."}
                      </p>
                    </div>
                  </div>
                  {!token && (
                    <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-green-700">
                      OTP secured
                    </span>
                  )}
                </div>

                {!token && (
                  <form onSubmit={submitLookup} className="mt-5 space-y-5">
                    <div>
                      <FieldLabel icon={Search}>Registration Number *</FieldLabel>
                      <input
                        value={registrationNumber}
                        onChange={(e) =>
                          setRegistrationNumber(e.target.value.toUpperCase())
                        }
                        placeholder="e.g. JPSC26000001"
                        className="h-12 w-full rounded border border-[#ded4ca] px-4 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#f15a0b] focus:ring-2 focus:ring-orange-100"
                        required
                      />
                      <p className="mt-2 text-xs font-medium leading-5 text-[#6d6761]">
                        Each application has its own registration number. If you
                        applied for multiple jobs, enter the registration number
                        for the exact exam.
                      </p>
                    </div>

                    <div className="rounded-[8px] border border-[#eadfd2] bg-[#fffaf5] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <FieldLabel icon={Phone}>Registered Mobile *</FieldLabel>
                        {otpVerified && (
                          <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-green-700">
                            Verified
                          </span>
                        )}
                      </div>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          value={mobile}
                          onChange={(e) => {
                            setMobile(e.target.value.replace(/\D/g, "").slice(0, 10));
                            setOtpVerified(false);
                          }}
                          placeholder="10-digit mobile"
                          className="h-12 min-w-0 flex-1 rounded border border-[#ded4ca] bg-white px-4 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#f15a0b] focus:ring-2 focus:ring-orange-100"
                          required
                        />
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          disabled={sendLoading || otpVerified}
                          className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded bg-[#f15a0b] px-5 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_14px_28px_rgba(241,90,11,0.2)] transition hover:bg-[#d94f08] disabled:cursor-not-allowed disabled:opacity-45 sm:w-[150px]"
                        >
                          {sendLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : otpSent && !otpVerified ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : null}
                          {otpVerified ? "Verified" : otpSent ? "Resend OTP" : "Send OTP"}
                        </button>
                      </div>
                    </div>

                    {otpSent && !otpVerified && (
                      <div className="rounded-[8px] border border-[#f3d0b9] bg-[#fff8f2] p-4">
                        <FieldLabel>Mobile OTP *</FieldLabel>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            value={otp}
                            onChange={(e) =>
                              setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                            }
                            placeholder="6-digit OTP"
                            className="h-12 min-w-0 flex-1 rounded border border-[#ded4ca] bg-white px-4 text-sm font-semibold tracking-[0.2em] text-[#111827] outline-none transition focus:border-[#f15a0b] focus:ring-2 focus:ring-orange-100"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyOTP}
                            disabled={verifyLoading || otp.length !== 6}
                            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded border border-green-300 bg-green-50 px-5 text-xs font-black uppercase tracking-[0.12em] text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-45 sm:w-[150px]"
                          >
                            {verifyLoading && (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            )}
                            Verify OTP
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={lookupMutation.isPending || !otpVerified}
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded bg-[#f15a0b] px-5 text-sm font-black uppercase tracking-[0.14em] text-white shadow-[0_18px_32px_rgba(241,90,11,0.2)] transition hover:bg-[#d94f08] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {lookupMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Download className="h-5 w-5" />
                      )}
                      Get Admit Card
                    </button>
                  </form>
                )}
              </div>

              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-5 shadow-sm sm:p-6">
                {resultLoading && <LoadingState label="Checking admit card..." />}
                {resultError && (
                  <div className="rounded-[8px] border border-red-200 bg-red-50 p-5">
                    <div className="flex gap-3">
                      <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                      <div>
                        <h3 className="font-black text-red-700">
                          Unable to issue admit card
                        </h3>
                        <p className="mt-1 text-sm font-medium leading-6 text-red-700/80">
                          {resultError.message || "Admit card is not available yet"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {!resultLoading && !resultError && !result && (
                  <div className="flex min-h-[150px] items-center justify-center rounded-[8px] border border-dashed border-[#e0d7cd] bg-[#fbf7f1] p-6 text-center">
                    <div>
                      <Ticket className="mx-auto h-8 w-8 text-[#f15a0b]" />
                      <h3 className="mt-3 font-black text-[#111827]">
                        Admit card result will appear here
                      </h3>
                      <p className="mt-1 max-w-md text-sm font-medium leading-6 text-[#6d6761]">
                        If this is your first successful request, the system will
                        reserve one seat and create your admit card immediately.
                      </p>
                    </div>
                  </div>
                )}
                {result && (
                  <div className="space-y-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-1 h-6 w-6 text-green-600" />
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-green-700">
                            {token ? "Verified Admit Card" : "Admit Card Ready"}
                          </p>
                          <h3 className="mt-1 text-2xl font-black text-[#111827]">
                            {result.candidateName || "Candidate"}
                          </h3>
                          <p className="mt-1 text-sm font-medium text-[#6d6761]">
                            Roll No. {result.rollNumber || "-"} ·{" "}
                            {result.registrationNumber || result.applicationId}
                          </p>
                        </div>
                      </div>
                      {result.alreadyGenerated && (
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-blue-700">
                          Existing card
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <DetailTile label="Exam" value={result.examName} />
                      <DetailTile label="Center" value={result.centerName} />
                      <DetailTile label="Reporting" value={result.reportingTime} />
                      <DetailTile label="Seat" value={result.seatNumber} />
                    </div>

                    {!token && result.admitCardId && (
                      <div className="flex flex-col gap-3 border-t border-[#eadfd2] pt-5 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => setPreviewId(result.admitCardId)}
                          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded border border-[#d8cbbf] bg-white px-5 text-sm font-black text-[#111827] transition hover:border-[#f15a0b] hover:text-[#f15a0b]"
                        >
                          <Eye className="h-5 w-5" />
                          Preview Admit Card
                        </button>
                        <a
                          href={jobService.getPublicAdmitCardPdfUrl(result.admitCardId)}
                          className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded bg-[#f15a0b] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(241,90,11,0.2)] transition hover:bg-[#d94f08]"
                        >
                          <Download className="h-5 w-5" />
                          Download PDF
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <aside className="space-y-5">
              <div className="rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-[#111827]">
                  Admit Card Rules
                </h2>
                <div className="mt-5 space-y-4">
                  {[
                    "Admit card is available only after the official release date.",
                    "Applications with pending correction cannot receive admit cards.",
                    "The first successful request reserves your exam seat permanently.",
                    "Re-download always returns the same roll number, center, and seat.",
                  ].map((item) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <p className="text-sm font-medium leading-6 text-[#4f5865]">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[8px] border border-[#f2c9a9] bg-[#fff8f2] p-6">
                <h3 className="font-black text-[#9a3d08]">
                  Keep Registration Number Safe
                </h3>
                <p className="mt-2 text-sm font-medium leading-6 text-[#9a3d08]">
                  It is required for admit card download, application status,
                  correction requests, and result checking.
                </p>
              </div>
            </aside>
          </div>

          <div className="mt-7 space-y-5">
            {isLoading && <LoadingState label="Loading exam schedules..." />}
            {error && <ErrorState message={error.message} />}

            {!isLoading && !error && jobs.length === 0 && (
              <EmptyState
                icon={Ticket}
                title="No admit card releases scheduled"
                description="When departments publish exam schedules, released admit card information will appear here."
              />
            )}

            {jobs.length > 0 && (
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <CalendarCheck2 className="h-5 w-5 text-[#f15a0b]" />
                  <h2 className="text-xl font-black text-[#111827]">
                    Recent Admit Card Releases
                  </h2>
                </div>
                <div className="space-y-4">
                  {jobs.map((job, i) => (
                    <motion.div
                      key={job._id}
                      custom={i}
                      variants={fadeUp}
                      initial="hidden"
                      whileInView="visible"
                      viewport={{ once: true, amount: 0.1 }}
                    >
                      <JobListCard
                        job={job}
                        meta={`Exam date: ${formatDate(job.examDate)}. Download opens after the official admit-card release.`}
                        actionLabel="View Job"
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {previewId && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
            <div className="flex h-[88vh] w-full max-w-[980px] flex-col overflow-hidden rounded-[8px] bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#e5e7eb] px-5 py-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#f15a0b]">
                    Admit Card Preview
                  </p>
                  <h3 className="font-black text-[#111827]">
                    Official generated admit card
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={jobService.getPublicAdmitCardPdfUrl(previewId)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded border border-green-300 bg-white px-4 text-sm font-black text-green-700 hover:bg-green-50"
                  >
                    <Download className="h-4 w-4" />
                    Download PDF
                  </a>
                  <button
                    type="button"
                    onClick={() => setPreviewId(null)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded text-[#64748b] hover:bg-[#f3f4f6] hover:text-[#111827]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <iframe
                title="Admit Card Preview"
                src={previewUrl}
                className="h-full w-full bg-white"
              />
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
};

export default AdmitCards;
