import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarCheck2, CheckCircle2, Search, ShieldCheck, Ticket } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { jobService } from "../../services/job.service";
import {
  EmptyState,
  ErrorState,
  JobListCard,
  LoadingState,
  PageFrame,
  PageHero,
  StatTile,
  formatDate,
  publicContainer,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: "easeOut", delay: i * 0.07 },
  }),
};

const AdmitCards = () => {
  const { token } = useParams();
  const [lookupForm, setLookupForm] = useState({
    applicationId: "",
    dateOfBirth: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-admit-cards"],
    queryFn: () =>
      jobService.getPublicJobs({
        limit: 20,
        sortBy: "examDate",
        sortOrder: "asc",
      }),
  });

  const jobs = (data?.jobs || []).filter((job) => job.examDate);

  const lookupMutation = useMutation({
    mutationFn: jobService.lookupPublicAdmitCard,
  });

  const verifyMutation = useMutation({
    mutationFn: jobService.verifyPublicAdmitCard,
  });

  useEffect(() => {
    if (token) verifyMutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const submitLookup = (event) => {
    event.preventDefault();
    lookupMutation.mutate(lookupForm);
  };

  const result = token ? verifyMutation.data : lookupMutation.data;
  const resultError = token ? verifyMutation.error : lookupMutation.error;
  const resultLoading = token ? verifyMutation.isPending : lookupMutation.isPending;

  return (
    <PageFrame>
      <PageHero
        eyebrow="Admit Cards"
        title="Exam Schedule and Admit Card Access"
        description="Public admit card information is connected to job exam dates. Candidates can download released admit cards after logging into their dashboard."
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Scheduled Exams" value={jobs.length || "-"} />
          <StatTile label="Active Jobs" value={data?.pagination?.totalItems ?? "-"} />
        </div>
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10 space-y-5`}>
        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-5 items-start">
          <div className="bg-white border border-[#e0d7cd] rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
                {token ? <ShieldCheck className="w-5 h-5 text-orange-600" /> : <Search className="w-5 h-5 text-orange-600" />}
              </div>
              <div>
                <h2 className="font-black text-[#1f1d1b]">
                  {token ? "Verify Admit Card" : "Find Admit Card"}
                </h2>
                <p className="text-sm text-[#6d6761]">
                  {token ? "Public verification result from the printed card token." : "Use your application number and date of birth."}
                </p>
              </div>
            </div>

            {!token && (
              <form onSubmit={submitLookup} className="mt-5 space-y-3">
                <input
                  value={lookupForm.applicationId}
                  onChange={(e) => setLookupForm({ ...lookupForm, applicationId: e.target.value })}
                  placeholder="Application number"
                  className="w-full h-11 rounded border border-[#ded4ca] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
                <input
                  type="date"
                  value={lookupForm.dateOfBirth}
                  onChange={(e) => setLookupForm({ ...lookupForm, dateOfBirth: e.target.value })}
                  className="w-full h-11 rounded border border-[#ded4ca] px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
                <button
                  type="submit"
                  disabled={lookupMutation.isPending}
                  className="w-full h-11 rounded bg-[#e46a1d] text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16] disabled:opacity-60"
                >
                  {lookupMutation.isPending ? "Checking..." : "Search Admit Card"}
                </button>
              </form>
            )}
          </div>

          <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 min-h-[218px]">
            {resultLoading && <LoadingState label="Checking admit card..." />}
            {resultError && <ErrorState message={resultError.message || "Unable to find admit card"} />}
            {!resultLoading && !resultError && !result && (
              <div className="h-full flex items-center text-sm text-[#6d6761]">
                Released admit card details will appear here.
              </div>
            )}
            {result && (
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] font-black text-green-700">
                      {token ? "Verified Admit Card" : "Released Admit Card"}
                    </p>
                    <h3 className="text-xl font-black text-[#1f1d1b] mt-1">
                      {result.candidateName || "Candidate"}
                    </h3>
                    <p className="text-sm text-[#6d6761]">
                      Roll No. {result.rollNumber} - {result.applicationId}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="border border-[#ece3da] rounded p-3">
                    <p className="text-xs text-[#7c746d]">Exam</p>
                    <p className="font-bold text-[#1f1d1b]">{result.examName}</p>
                  </div>
                  <div className="border border-[#ece3da] rounded p-3">
                    <p className="text-xs text-[#7c746d]">Center</p>
                    <p className="font-bold text-[#1f1d1b]">{result.centerName || "-"}</p>
                  </div>
                  <div className="border border-[#ece3da] rounded p-3">
                    <p className="text-xs text-[#7c746d]">Reporting</p>
                    <p className="font-bold text-[#1f1d1b]">{result.reportingTime || "-"}</p>
                  </div>
                  <div className="border border-[#ece3da] rounded p-3">
                    <p className="text-xs text-[#7c746d]">Gate Closing</p>
                    <p className="font-bold text-[#1f1d1b]">{result.gateClosingTime || "-"}</p>
                  </div>
                </div>
                {!token && result.admitCardId && (
                  <Link
                    to="/candidate/admit-card"
                    className="inline-flex h-10 items-center justify-center rounded bg-[#e46a1d] px-4 text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16]"
                  >
                    Login to Download
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {isLoading && <LoadingState label="Loading exam schedules..." />}
        {error && <ErrorState message={error.message} />}

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState
            icon={Ticket}
            title="No admit card releases scheduled"
            description="No active jobs currently have public exam dates attached. When departments publish exam schedules, they will appear here."
          />
        )}

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
                meta={`Exam date: ${formatDate(job.examDate)}. Admit card download is available from the candidate dashboard after release.`}
                actionLabel="View Job"
              />
            </motion.div>
          ))}
        </div>

        <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CalendarCheck2 className="w-6 h-6 text-orange-600 shrink-0" />
            <div>
              <h2 className="font-black text-[#1f1d1b]">
                Already applied?
              </h2>
              <p className="mt-1 text-sm text-[#6d6761]">
                Login to check application status and released admit cards.
              </p>
            </div>
          </div>
          <Link
            to="/candidate/admit-card"
            className="inline-flex h-11 items-center justify-center rounded bg-[#e46a1d] px-5 text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16]"
          >
            Candidate Admit Card
          </Link>
        </div>
      </section>
    </PageFrame>
  );
};

export default AdmitCards;


