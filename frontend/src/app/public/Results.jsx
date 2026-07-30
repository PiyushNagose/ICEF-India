import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
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

const Results = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-results"],
    queryFn: () =>
      jobService.getPublicJobs({
        limit: 20,
        sortBy: "examDate",
        sortOrder: "desc",
      }),
  });

  const jobs = (data?.jobs || []).filter((job) => job.examDate);

  return (
    <PageFrame>
      <PageHero
        eyebrow="Results"
        title="Recruitment Result Updates"
        description="Result tracking is connected to active recruitment data. Candidate-specific results and selection updates are available after login."
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Tracked Jobs" value={jobs.length || "-"} />
          <StatTile label="Active Jobs" value={data?.pagination?.totalItems ?? "-"} />
        </div>
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10 space-y-5`}>
        {isLoading && <LoadingState label="Loading result updates..." />}
        {error && <ErrorState message={error.message} />}

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState
            icon={Award}
            title="No public result updates available"
            description="No active recruitment records currently have exam schedules/results available for public display."
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
                meta={`Exam conducted/scheduled on ${formatDate(job.examDate)}. Login as a candidate for application-specific result updates.`}
                actionLabel="Open Recruitment"
              />
            </motion.div>
          ))}
        </div>

        <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-6 h-6 text-orange-600 shrink-0" />
            <div>
              <h2 className="font-black text-[#1f1d1b]">
                Candidate result dashboard
              </h2>
              <p className="mt-1 text-sm text-[#6d6761]">
                View result status against your submitted applications.
              </p>
            </div>
          </div>
          <Link
            to="/candidate/results"
            className="inline-flex h-11 items-center justify-center rounded bg-[#e46a1d] px-5 text-white text-xs uppercase tracking-[0.12em] font-black hover:bg-[#cb5d16]"
          >
            View My Results
          </Link>
        </div>
      </section>
    </PageFrame>
  );
};

export default Results;


