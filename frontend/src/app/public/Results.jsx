import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Award, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { publicService } from "../../services/public.service";
import {
  getProjectAwarePublicPath,
  getPublicProjectSlug,
  readProjectSlugFromSearch,
} from "../../utils/publicNavigation";
import {
  EmptyState,
  ErrorState,
  JobListCard,
  LoadingState,
  PageFrame,
  PageHero,
  StatTile,
  fadeUp,
  formatDate,
  publicContainer,
} from "./PublicPageShell";

const Results = () => {
  const location = useLocation();
  const projectSlug =
    readProjectSlugFromSearch(location.search) || getPublicProjectSlug();
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-results", projectSlug],
    queryFn: () => publicService.getProjectBySlug(projectSlug),
    enabled: Boolean(projectSlug),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isReleased = (value) => {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date <= today;
  };
  const jobs = (data?.jobs || [])
    .filter((job) => job.resultDate)
    .sort((a, b) => new Date(b.resultDate) - new Date(a.resultDate));
  const releasedCount = jobs.filter((job) => isReleased(job.resultDate)).length;

  return (
    <PageFrame>
      <PageHero
        eyebrow="Results"
        title="Recruitment Result Updates"
        description={
          projectSlug
            ? "Result tracking is connected to this recruitment. Candidate-specific results and selection updates are available after verification."
            : "Open the official recruitment link first, or check your application status using registration number and mobile OTP."
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Tracked Jobs" value={jobs.length || "-"} />
          <StatTile label="Released" value={releasedCount || "-"} />
        </div>
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10 space-y-5`}>
        {projectSlug && isLoading && <LoadingState label="Loading result updates..." />}
        {error && <ErrorState message={error.message} />}

        {!isLoading && !error && jobs.length === 0 && (
          <EmptyState
            icon={Award}
            title={
              projectSlug
                ? "No result updates available"
                : "Open a recruitment page first"
            }
            description={
              projectSlug
                ? "No result publish date is available for this recruitment yet."
                : "Result updates are shown only for the selected recruitment. You can still use status lookup with your registration number."
            }
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
                meta={
                  isReleased(job.resultDate)
                    ? `Released: ${formatDate(job.resultDate)}. Use your registration number for candidate-specific status.`
                    : `Scheduled: ${formatDate(job.resultDate)}. Candidate-specific status opens after the official publish date.`
                }
                actionLabel="Open Recruitment"
                actionTo={
                  projectSlug
                    ? `/apply/${projectSlug}/jobs/${job._id}`
                    : undefined
                }
              />
            </motion.div>
          ))}
        </div>

        <div className="bg-white border border-[#e0d7cd] rounded-lg p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BarChart3 className="w-6 h-6 text-orange-600 shrink-0" />
            <div>
              <h2 className="text-[24px] font-black leading-tight text-[#1f1d1b]">
                Public result status
              </h2>
              <p className="mt-1 text-[14px] leading-[26px] text-[#5f5752] font-medium">
                View result status against your submitted applications.
              </p>
            </div>
          </div>
          <Link
            to={getProjectAwarePublicPath("/check-status", projectSlug)}
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
