import { useQuery } from "@tanstack/react-query";
import { Building2, ShieldCheck, Users } from "lucide-react";
import { motion } from "framer-motion";
import { jobService } from "../../services/job.service";
import {
  ErrorState,
  LoadingState,
  PageFrame,
  PageHero,
  ResourceCard,
  StatTile,
  publicContainer,
} from "./PublicPageShell";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut", delay: i * 0.1 },
  }),
};

const About = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-about-stats"],
    queryFn: jobService.getPublicStats,
  });

  return (
    <PageFrame>
      <PageHero
        eyebrow="About Portal"
        title="Transparent public recruitment in one place"
        description="The Recruitment Portal brings active public sector opportunities, application tracking, notifications, and candidate support into a single digital workflow."
      >
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Active Jobs" value={data?.totalActiveJobs ?? "-"} />
          <StatTile label="Open Posts" value={data?.totalVacancies ?? "-"} />
        </div>
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10 space-y-6`}>
        {isLoading && <LoadingState label="Loading portal statistics..." />}
        {error && <ErrorState message={error.message} />}

        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Verified Recruitment", description: "Only active jobs published by authorized departments are shown to candidates.", to: "/jobs" },
            { icon: Users, title: "Candidate First", description: "Candidates can apply, resume drafts, and track updates through public status services using registration number and mobile OTP.", to: "/how-to-apply" },
            { icon: Building2, title: "Department Coverage", description: "Browse opportunities across active departments and recruitment projects.", to: "/jobs" },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.2 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="h-full"
            >
              <ResourceCard icon={card.icon} title={card.title} description={card.description} to={card.to} />
            </motion.div>
          ))}
        </div>

        {data?.departmentStats?.length > 0 && (
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.1 }}
            className="bg-white border border-[#e0d7cd] rounded-lg p-6"
          >
            <h2 className="text-xl font-black text-[#1f1d1b]">
              Active Departments
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {data.departmentStats.map((department, i) => (
                <motion.div
                  key={department._id}
                  custom={i}
                  variants={fadeUp}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, amount: 0.1 }}
                  className="flex items-center justify-between rounded border border-[#ece3da] px-4 py-3 hover:border-orange-300 transition-colors"
                >
                  <span className="font-semibold text-[#3f3a36]">
                    {department._id || "Department"}
                  </span>
                  <span className="text-sm text-[#6d6761]">
                    {department.jobCount} jobs / {department.totalPosts} posts
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </section>
    </PageFrame>
  );
};

export default About;


