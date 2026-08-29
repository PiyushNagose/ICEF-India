import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  MapPin,
  Search,
} from "lucide-react";
import { publicService } from "../../services/public.service";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageFrame,
  PageHero,
  PublicHero3D,
  SearchInput,
  fadeUp,
  formatDate,
  publicContainer,
} from "./PublicPageShell";

const PublicRecruitments = () => {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-home-projects", search],
    queryFn: () =>
      publicService.getActiveProjects({
        limit: 20,
        search: search.trim() || undefined,
      }),
    staleTime: 30000,
  });

  const projects = data?.projects || [];
  const totalProjects = data?.pagination?.totalItems ?? projects.length;
  const totalJobs = projects.reduce(
    (sum, project) => sum + Number(project.openJobs || project.totalJobs || 0),
    0,
  );
  const totalPosts = projects.reduce(
    (sum, project) => sum + Number(project.totalPosts || 0),
    0,
  );

  return (
    <PageFrame>
      <PageHero
        eyebrow="Recruitment"
        title="Current Recruitments"
        description="Choose an active recruitment to view official notices, available posts, deadlines, admit-card updates, and application instructions."
      >
        <PublicHero3D
          title="Recruitment Desk"
          subtitle="Official project pages with notices, eligibility, payment, admit-card, and status services."
          stats={[
            { label: "Projects", value: totalProjects || "-" },
            { label: "Jobs", value: totalJobs || "-" },
            { label: "Posts", value: totalPosts || "-" },
          ]}
        />
      </PageHero>

      <section className={`${publicContainer} py-8 lg:py-10`}>
        <div className="mb-5 max-w-xl">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search recruitment, department, or state..."
          />
        </div>

        {isLoading && <LoadingState label="Loading active recruitments..." />}
        {error && <ErrorState message={error.message} />}

        {!isLoading && !error && projects.length === 0 && (
          <EmptyState
            icon={Search}
            title="No active recruitment found"
            description="There are no published recruitment projects matching this search. Please check again after the official notification is published."
          />
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project, index) => (
            <motion.article
              key={project._id}
              custom={index}
              variants={fadeUp}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.15 }}
              className="flex h-full flex-col rounded-[8px] border border-[#e0d7cd] bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-md"
            >
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-orange-700">
                {project.department || "Recruitment"}
              </p>
              <h2 className="mt-2 text-[24px] font-black leading-tight text-[#1f1d1b]">
                {project.name}
              </h2>
              <p className="mt-3 line-clamp-3 text-[14px] font-medium leading-[26px] text-[#5f5752]">
                {project.description || "Official recruitment details are available on the project page."}
              </p>

              <div className="mt-5 grid gap-3 text-[14px] font-semibold text-[#5f5752]">
                <span className="inline-flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-orange-500" />
                  {project.openJobs || project.totalJobs || 0} active jobs
                </span>
                <span className="inline-flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  Deadline {formatDate(project.nearestDeadline || project.endDate)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-orange-500" />
                  {project.state || "All India"}
                </span>
              </div>

              <Link
                to={project.publicSlug ? `/apply/${project.publicSlug}` : "/check-status"}
                className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[6px] bg-[#e46a1d] px-4 text-xs font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#cb5d16]"
              >
                Open Recruitment
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.article>
          ))}
        </div>
      </section>
    </PageFrame>
  );
};

export default PublicRecruitments;
