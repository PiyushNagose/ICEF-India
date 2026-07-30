import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, Calendar } from "lucide-react";
import { motion } from "framer-motion";
import { jobService } from "../../services/job.service";
import {
  EmptyState,
  ErrorState,
  JobListCard,
  LoadingState,
  PageFrame,
  PageHero,
  SearchInput,
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

const Notices = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-notices", search],
    queryFn: () =>
      jobService.getPublicJobs({
        limit: 20,
        search: search || undefined,
        sortBy: "publishedAt",
        sortOrder: "desc",
      }),
  });

  const jobs = data?.jobs || [];

  return (
    <PageFrame>
      <PageHero
        eyebrow="Public Notices"
        title="Latest Recruitment Notices"
        description="Dynamic notice board generated from active jobs published by departments. New job events are refreshed through the realtime socket bridge."
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Visible Notices" value={jobs.length || "-"} />
          <StatTile label="Total Active" value={data?.pagination?.totalItems ?? "-"} />
        </div>
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10 space-y-5`}>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search notices by job, post code, or department..."
        />

        {isLoading && <LoadingState label="Loading latest notices..." />}
        {error && <ErrorState message={error.message} />}

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState
            icon={Bell}
            title="No public notices available"
            description="There are no active recruitment notices matching your search right now."
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
                meta={`Published notice for ${job.department || "department"} recruitment. Application deadline: ${formatDate(job.applicationDeadline)}.`}
                actionLabel="Open Notice"
              />
            </motion.div>
          ))}
        </div>

        {jobs.length > 0 && (
          <div className="bg-white border border-[#e0d7cd] rounded-lg p-5 flex items-start gap-3 text-sm text-[#6d6761]">
            <Calendar className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
            Notices are sourced from active job records. Closed or expired jobs
            are automatically removed from public listing by the backend.
          </div>
        )}
      </section>
    </PageFrame>
  );
};

export default Notices;


