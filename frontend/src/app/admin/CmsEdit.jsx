import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Briefcase,
  Bell,
  Link2,
  Image,
  Plus,
  X,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Download,
  CircleHelp,
  Phone,
  ListChecks,
  Eye,
} from "lucide-react";
import AdminLayout from "../../components/layouts/AdminLayout";
import { adminService } from "../../services/admin.service";
import BannerImageUpload from "../../components/ui/BannerImageUpload";
import ProjectFlowNav from "../../components/admin/ProjectFlowNav";
import {
  stashCmsPreviewDraft,
  clearCmsPreviewDraft,
  openProjectPreview,
} from "../../utils/cmsPreview";
import { getJobWizardPath } from "../../utils/jobDraft";

const Section = ({ icon: Icon, title, children, action, className = "" }) => (
  <div
    className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}
  >
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
          <Icon className="w-4 h-4 text-orange-600" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
      </div>
      {action}
    </div>
    <div className="flex-1 px-6 py-5">{children}</div>
  </div>
);

const inputCls =
  "w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-800 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent";
const Label = ({ children }) => (
  <label className="block text-xs font-semibold text-gray-600 mb-1.5">
    {children}
  </label>
);

const normalizeCmsPayload = (payload = {}) => ({
  projectId: payload.projectId || "",
  heroTitle: (payload.heroTitle || "").trim(),
  heroSubtitle: (payload.heroSubtitle || "").trim(),
  bannerImage: payload.bannerImage || "",
  featuredJobs: (payload.featuredJobs || []).map((job) =>
    String(job?._id || job || ""),
  ),
  announcements: (payload.announcements || []).map((item) => ({
    text: (item.text || "").trim(),
    link: (item.link || "").trim(),
    priority: item.priority || "medium",
  })),
  quickLinks: payload.quickLinks || {},
  instructions: (payload.instructions || []).map((item) =>
    String(item || "").trim(),
  ),
  downloads: (payload.downloads || []).map((item) => ({
    title: (item.title || "").trim(),
    url: (item.url || "").trim(),
    type: (item.type || "").trim() || "PDF",
  })),
  faqs: (payload.faqs || []).map((item) => ({
    question: (item.question || "").trim(),
    answer: (item.answer || "").trim(),
  })),
  helpdesk: {
    phone: (payload.helpdesk?.phone || "").trim(),
    email: (payload.helpdesk?.email || "").trim(),
    hours: (payload.helpdesk?.hours || "").trim(),
    address: (payload.helpdesk?.address || "").trim(),
  },
  sectionVisibility: payload.sectionVisibility || {},
});

const getCmsSnapshot = (payload) => JSON.stringify(normalizeCmsPayload(payload));

const formatProjectDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getProjectDefaults = (project, stateName) => {
  const projectName = project?.name || "";
  const state = project?.state || stateName;
  const department = project?.department || "";
  const start = formatProjectDate(project?.startDate);
  const end = formatProjectDate(project?.endDate || project?.closureDate);
  const duration =
    start && end ? `${start} to ${end}` : end ? `Open until ${end}` : "";
  const departmentLine = [department, state].filter(Boolean).join(", ");

  if (!projectName) {
    return {
      heroTitle: "",
      heroSubtitle: "",
      announcements: [],
      instructions: [],
      faqs: [],
      helpdeskAddress: "Recruitment Portal Helpdesk",
    };
  }

  return {
    heroTitle: projectName,
    heroSubtitle: [
      departmentLine
        ? `${departmentLine} recruitment application portal.`
        : "Official recruitment application portal.",
      duration ? `Application window: ${duration}.` : "",
      "Review the notification, choose an available post, and complete the application from this page.",
    ]
      .filter(Boolean)
      .join(" "),
    announcements: [
      {
        text: `Applications are invited for ${projectName}.`,
        priority: "high",
      },
      {
        text: "Use the official Apply option on this page for all available posts.",
        link: "#available-posts",
        priority: "medium",
      },
    ],
    instructions: [
      "Read the official notification before applying.",
      "Keep scanned photo, signature, and required certificates ready.",
      "Use the same mobile number and email throughout the application.",
      "Download the submitted application after final payment and submission.",
    ],
    faqs: [
      {
        question: `Where can I apply for ${projectName}?`,
        answer:
          "Use the Apply Now option on this project page and select the eligible post before starting the form.",
      },
      {
        question: "Can I edit my application after payment?",
        answer:
          "Editable fields depend on the correction window and recruitment rules configured by the admin.",
      },
    ],
    helpdeskAddress: departmentLine || "Recruitment Portal Helpdesk",
  };
};

const CmsEdit = () => {
  const { state: stateParam } = useParams();
  const stateName = decodeURIComponent(stateParam);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("project");
  const amendmentType = searchParams.get("amendment");
  const amendmentJobId = searchParams.get("job");
  const isFormAmendment = amendmentType === "form-sections";
  const queryClient = useQueryClient();

  const [form, setForm] = useState(null);
  const [announcementText, setAnnouncementText] = useState("");
  const [announcementLink, setAnnouncementLink] = useState("");
  const [instructionText, setInstructionText] = useState("");
  const [downloadDraft, setDownloadDraft] = useState({
    title: "",
    url: "",
    type: "PDF",
  });
  const [faqDraft, setFaqDraft] = useState({ question: "", answer: "" });
  const [jobSearch, setJobSearch] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState("");

  const { data: pageData, isLoading: pageLoading } = useQuery({
    queryKey: ["admin-cms-page", stateName, projectId],
    queryFn: () =>
      adminService.getCmsPage(stateName, projectId ? { projectId } : {}),
  });

  const { data: projectData } = useQuery({
    queryKey: ["admin-project-flow", projectId],
    queryFn: () => adminService.getProject(projectId),
    enabled: Boolean(projectId),
    staleTime: 30000,
  });

  const { data: jobsData } = useQuery({
    queryKey: ["admin-jobs-cms", projectId],
    queryFn: () =>
      adminService.getAdminJobs({
        limit: 200,
        ...(projectId ? { projectId } : {}),
      }),
  });
  const project = projectData?.project || projectData;
  const rawJobs = jobsData?.jobs || [];
  const allJobs = projectId
    ? rawJobs.filter(
        (job) =>
          String(job.projectId?._id || job.projectId || "") ===
          String(projectId),
      )
    : rawJobs;
  const amendmentJob = amendmentJobId
    ? allJobs.find((job) => String(job._id) === String(amendmentJobId))
    : null;
  const amendmentJobLabel = amendmentJob
    ? `${amendmentJob.title || "Selected job"}${amendmentJob.postCode ? ` (${amendmentJob.postCode})` : ""}`
    : "the selected job";
  const amendmentNoticeText = `Official amendment: Application form fields for ${amendmentJobLabel} have been updated. Candidates should review the latest instructions before applying or requesting correction.`;
  const amendmentNoticeLink =
    project?.publicSlug || project?.slug
      ? `/apply/${project.publicSlug || project.slug}`
      : "";
  const amendmentReturnPath =
    isFormAmendment && projectId
      ? `/admin/jobs/create/review?project=${projectId}${amendmentJobId ? `&job=${amendmentJobId}` : ""}`
      : "";
  const nextPath = projectId
    ? amendmentReturnPath ||
      (amendmentJobId
        ? getJobWizardPath("review", projectId, amendmentJobId)
        : getJobWizardPath("basic-info", projectId))
    : "/admin/cms";
  const returnPath = projectId
    ? `/admin/projects/${projectId}${amendmentJobId ? `?job=${amendmentJobId}` : ""}`
    : "/admin/cms";
  const projectDetailsPath = projectId
    ? `/admin/projects/${projectId}${amendmentJobId ? `?job=${amendmentJobId}` : ""}`
    : "/admin/cms";

  // Populate form once data loaded
  useEffect(() => {
    if (!pageData?.page) return;
    if (form) return;
    if (projectId && !project) return;
    const p = pageData.page;
    const defaults = getProjectDefaults(project, stateName);
    const nextForm = {
      heroTitle: p.heroTitle || defaults.heroTitle,
      heroSubtitle: p.heroSubtitle || defaults.heroSubtitle,
      bannerImage: p.bannerImage || "",
      bannerImageSize: p.bannerImageSize || 0,
      featuredJobs: p.featuredJobs || [],
      announcements: p.announcements?.length
        ? p.announcements
        : defaults.announcements,
      instructions: p.instructions?.length
        ? p.instructions
        : defaults.instructions,
      downloads: p.downloads || [],
      faqs: p.faqs?.length ? p.faqs : defaults.faqs,
      helpdesk: {
        phone: p.helpdesk?.phone || "1800-123-4567",
        email: p.helpdesk?.email || "support@recruitment.gov.in",
        hours: p.helpdesk?.hours || "Monday to Friday, 9:00 AM to 6:00 PM",
        address: p.helpdesk?.address || defaults.helpdeskAddress,
      },
      sectionVisibility: {
        notices: p.sectionVisibility?.notices ?? true,
        quickActions: p.sectionVisibility?.quickActions ?? true,
        howToApply: p.sectionVisibility?.howToApply ?? true,
        downloads: p.sectionVisibility?.downloads ?? true,
        faqs: p.sectionVisibility?.faqs ?? true,
        helpdesk: p.sectionVisibility?.helpdesk ?? true,
      },
      quickLinks: p.quickLinks || {
        applyNow: true,
        latestNotifications: true,
        admitCards: true,
        results: true,
        support: true,
      },
      status: p.status || "draft",
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- query data is copied into editable draft form state.
    setForm(nextForm);
    setSavedSnapshot(getCmsSnapshot({ ...nextForm, projectId }));
  }, [form, pageData, project, projectId, stateName]);

  useEffect(() => {
    if (!form || !isFormAmendment) return;
    if (amendmentJobId && !jobsData) return;
    const alreadyAdded = form.announcements?.some(
      (item) => item.text === amendmentNoticeText,
    );
    if (alreadyAdded) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- query/context params prefill the editable CMS draft once.
    setForm((current) => ({
      ...current,
      announcements: [
        {
          text: amendmentNoticeText,
          link: amendmentNoticeLink,
          priority: "high",
        },
        ...(current.announcements || []),
      ],
      sectionVisibility: {
        ...current.sectionVisibility,
        notices: true,
      },
    }));
    toast.success("Official amendment notice drafted. Review and publish it.");
  }, [
    amendmentJobId,
    amendmentNoticeLink,
    amendmentNoticeText,
    form,
    isFormAmendment,
    jobsData,
  ]);

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const setQL = (key, val) =>
    setForm((p) => ({ ...p, quickLinks: { ...p.quickLinks, [key]: val } }));
  const setVisibility = (key, val) =>
    setForm((p) => ({
      ...p,
      sectionVisibility: { ...p.sectionVisibility, [key]: val },
    }));
  const setHelpdesk = (key, value) =>
    setForm((p) => ({ ...p, helpdesk: { ...p.helpdesk, [key]: value } }));
  const projectDefaults = getProjectDefaults(project, stateName);

  const applyProjectText = () => {
    setForm((p) => ({
      ...p,
      heroTitle: projectDefaults.heroTitle || p.heroTitle,
      heroSubtitle: projectDefaults.heroSubtitle || p.heroSubtitle,
      helpdesk: {
        ...p.helpdesk,
        address: projectDefaults.helpdeskAddress || p.helpdesk.address,
      },
    }));
    toast.success("Project details applied to CMS draft.");
  };

  const addProjectNotices = () => {
    const existing = new Set(form.announcements.map((item) => item.text));
    const nextItems = projectDefaults.announcements.filter(
      (item) => !existing.has(item.text),
    );
    if (!nextItems.length) {
      toast("Project notices are already added.");
      return;
    }
    set("announcements", [...form.announcements, ...nextItems]);
  };

  const useDefaultInstructions = () => {
    set("instructions", projectDefaults.instructions);
    toast.success("Default instructions added.");
  };

  const filteredJobs = jobSearch.trim()
    ? allJobs.filter(
        (j) =>
          (j.title || "").toLowerCase().includes(jobSearch.toLowerCase()) ||
          (j.postCode || "").toLowerCase().includes(jobSearch.toLowerCase()),
      )
    : allJobs.slice(0, 6);

  const addJob = (job) => {
    if (!form.featuredJobs.find((j) => j._id === job._id)) {
      set("featuredJobs", [...form.featuredJobs, job]);
    }
    setJobSearch("");
  };
  const removeJob = (id) =>
    set(
      "featuredJobs",
      form.featuredJobs.filter((j) => j._id !== id),
    );

  const addAnnouncement = () => {
    if (!announcementText.trim()) return;
    set("announcements", [
      ...form.announcements,
      {
        text: announcementText.trim(),
        link: announcementLink.trim(),
        priority: "medium",
      },
    ]);
    setAnnouncementText("");
    setAnnouncementLink("");
  };
  const removeAnnouncement = (i) =>
    set(
      "announcements",
      form.announcements.filter((_, idx) => idx !== i),
    );
  const addInstruction = () => {
    if (!instructionText.trim()) return;
    set("instructions", [...form.instructions, instructionText.trim()]);
    setInstructionText("");
  };
  const removeInstruction = (i) =>
    set(
      "instructions",
      form.instructions.filter((_, idx) => idx !== i),
    );
  const addDownload = () => {
    if (!downloadDraft.title.trim() || !downloadDraft.url.trim()) return;
    set("downloads", [
      ...form.downloads,
      {
        title: downloadDraft.title.trim(),
        url: downloadDraft.url.trim(),
        type: downloadDraft.type.trim() || "PDF",
      },
    ]);
    setDownloadDraft({ title: "", url: "", type: "PDF" });
  };
  const removeDownload = (i) =>
    set(
      "downloads",
      form.downloads.filter((_, idx) => idx !== i),
    );
  const addFaq = () => {
    if (!faqDraft.question.trim() || !faqDraft.answer.trim()) return;
    set("faqs", [
      ...form.faqs,
      {
        question: faqDraft.question.trim(),
        answer: faqDraft.answer.trim(),
      },
    ]);
    setFaqDraft({ question: "", answer: "" });
  };
  const removeFaq = (i) =>
    set(
      "faqs",
      form.faqs.filter((_, idx) => idx !== i),
    );

  const buildPayload = () => ({
    ...(projectId ? { projectId } : {}),
    heroTitle: form.heroTitle,
    heroSubtitle: form.heroSubtitle,
    bannerImage: form.bannerImage,
    featuredJobs: form.featuredJobs.map((j) => j._id || j),
    announcements: form.announcements,
    quickLinks: form.quickLinks,
    instructions: form.instructions,
    downloads: form.downloads,
    faqs: form.faqs,
    helpdesk: form.helpdesk,
    sectionVisibility: form.sectionVisibility,
  });

  const hasUnsavedChanges =
    Boolean(form && savedSnapshot) &&
    getCmsSnapshot(buildPayload()) !== savedSnapshot;

  // Stash the current (possibly unsaved) draft and open the public preview in a
  // new tab. Only meaningful for project landing pages, which have a public URL.
  const handlePreview = () => {
    if (!projectId) return;
    stashCmsPreviewDraft(projectId, {
      heroTitle: form.heroTitle,
      heroSubtitle: form.heroSubtitle,
      bannerImage: form.bannerImage,
      featuredJobs: form.featuredJobs,
      announcements: form.announcements,
      instructions: form.instructions,
      downloads: form.downloads,
      faqs: form.faqs,
      helpdesk: form.helpdesk,
      sectionVisibility: form.sectionVisibility,
      quickLinks: form.quickLinks,
      status: form.status,
    });
    openProjectPreview(projectId, { draft: true });
  };

  const { mutate: saveUpdate, isPending: isSaving } = useMutation({
    mutationFn: (data) =>
      adminService.updateCmsPage(
        stateName,
        data,
        projectId ? { projectId } : {},
      ),
    onSuccess: () => {
      toast.success(projectId ? "Landing page saved." : "Page saved as draft");
      setSavedSnapshot(getCmsSnapshot(buildPayload()));
      clearCmsPreviewDraft(projectId);
      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-cms-page", stateName, projectId],
      });
      if (project?.publicSlug || project?.slug) {
        queryClient.invalidateQueries({
          queryKey: ["public-project", project.publicSlug || project.slug],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["public-projects"] });
      if (projectId) navigate(nextPath);
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });

  const { mutate: saveAndPublish, isPending: isPublishing } = useMutation({
    mutationFn: async (data) => {
      await adminService.updateCmsPage(
        stateName,
        data,
        projectId ? { projectId } : {},
      );
      await adminService.publishCmsPage(
        stateName,
        projectId ? { projectId } : {},
      );
    },
    onSuccess: () => {
      toast.success(projectId ? "Landing page published." : "Page published");
      setSavedSnapshot(getCmsSnapshot(buildPayload()));
      clearCmsPreviewDraft(projectId);
      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-cms-page", stateName, projectId],
      });
      if (project?.publicSlug || project?.slug) {
        queryClient.invalidateQueries({
          queryKey: ["public-project", project.publicSlug || project.slug],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["public-projects"] });
      navigate(nextPath);
    },
    onError: (err) => toast.error(err.message || "Failed to publish"),
  });

  if (pageLoading || !form) {
    return (
      <AdminLayout title="CMS - Edit Landing Page">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );
  }

  const page = pageData?.page;
  const liveSummary = [
    { label: "State", value: stateName },
    { label: "Banner Image", value: form.bannerImage ? "Uploaded" : "-" },
    { label: "Featured Jobs", value: form.featuredJobs.length },
    {
      label: "Status",
      value:
        (page?.status || "draft").charAt(0).toUpperCase() +
        (page?.status || "draft").slice(1),
    },
    {
      label: "Last Edited",
      value: page?.updatedAt
        ? new Date(page.updatedAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
          })
        : "-",
    },
  ];

  return (
    <AdminLayout
      title={projectId ? "Project Landing Page CMS" : `CMS - Edit ${stateName}`}
    >
      <div className="p-6">
        <div className="w-full">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => navigate(projectDetailsPath)}
              className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {projectId
                  ? "Project Landing Page CMS"
                  : "Edit Landing Page"}
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Manage public portal content for {project?.name || stateName}
              </p>
            </div>
          </div>

          {projectId && (
            <ProjectFlowNav
              project={project}
              current="landing"
              className="mb-6"
            />
          )}

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6 items-start">
            {/* LEFT */}
            <div className="min-w-0 space-y-5">
              {/* Hero */}
              <Section icon={Image} title="Hero Configuration">
                <div className="space-y-4">
                  <div>
                    <Label>Hero Title</Label>
                    <input
                      type="text"
                      placeholder="e.g., Government Jobs in Telangana"
                      value={form.heroTitle}
                      onChange={(e) => set("heroTitle", e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <Label>Hero Subtitle</Label>
                    <textarea
                      rows={3}
                      placeholder="Enter a brief description..."
                      value={form.heroSubtitle}
                      onChange={(e) => set("heroSubtitle", e.target.value)}
                      className={`${inputCls} resize-none`}
                    />
                  </div>
                  <div>
                    <Label>Banner Image</Label>
                    <BannerImageUpload
                      value={form.bannerImage}
                      size={form.bannerImageSize}
                      onChange={(url, size) => {
                        set("bannerImage", url);
                        set("bannerImageSize", size || 0);
                      }}
                    />
                  </div>
                </div>
              </Section>

              <div className="grid items-stretch gap-5 xl:grid-cols-2">
                {/* Featured Recruitments */}
                <Section
                  icon={Briefcase}
                  title="Featured Recruitments"
                  className="h-full"
                >
                  <div className="flex h-full flex-col gap-3">
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search and select recruitments..."
                        value={jobSearch}
                        onChange={(e) => setJobSearch(e.target.value)}
                        className={inputCls}
                      />
                      {jobSearch && (
                        <div className="hover-scroll absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
                          {filteredJobs.length === 0 && (
                            <p className="px-4 py-3 text-sm text-gray-400">
                              No jobs found
                            </p>
                          )}
                          {filteredJobs.map((j) => (
                            <button
                              key={j._id}
                              type="button"
                              onMouseDown={() => addJob(j)}
                              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-orange-50 text-left transition-colors"
                            >
                              <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">
                                  {j.title}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {j.postCode}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      {form.featuredJobs.map((job) => (
                        <div
                          key={job._id || job}
                          className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <Briefcase className="w-4 h-4 text-orange-500 shrink-0" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900">
                                {job.title || "Job"}
                              </p>
                              <p className="text-xs text-gray-400">
                                {job.postCode || ""}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeJob(job._id || job)}
                            className="text-gray-400 hover:text-red-500 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.featuredJobs.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-400">
                          No featured recruitments selected.
                        </div>
                      )}
                    </div>
                  </div>
                </Section>

                {/* Announcements */}
                <Section
                  icon={Bell}
                  title="Announcements"
                  action={
                    <button
                      type="button"
                      onClick={addAnnouncement}
                      disabled={!announcementText.trim()}
                      className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" /> Add Notice
                    </button>
                  }
                  className="h-full"
                >
                  <div className="flex h-full flex-col gap-3">
                    <input
                      type="text"
                      placeholder="Type notice and press Enter..."
                      value={announcementText}
                      onChange={(e) => setAnnouncementText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addAnnouncement();
                        }
                      }}
                      className={inputCls}
                    />
                    <input
                      type="text"
                      placeholder="Optional link, e.g. #available-posts or /admit-cards"
                      value={announcementLink}
                      onChange={(e) => setAnnouncementLink(e.target.value)}
                      className={inputCls}
                    />
                    <div className="flex-1 space-y-2">
                      {form.announcements.map((a, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl bg-gray-50"
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${a.priority === "high" ? "bg-red-500" : a.priority === "low" ? "bg-emerald-500" : "bg-amber-500"}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-gray-900">
                                {a.text}
                              </p>
                              {a.link && (
                                <p className="truncate text-xs font-medium text-orange-600">
                                  {a.link}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeAnnouncement(i)}
                            className="text-gray-400 hover:text-red-500 ml-2"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.announcements.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-400">
                          No public notices added.
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              </div>

              <div className="grid items-stretch gap-5 xl:grid-cols-2">
                <Section icon={Download} title="Downloads" className="h-full">
                  <div className="flex h-full flex-col gap-3">
                    <input
                      value={downloadDraft.title}
                      onChange={(e) =>
                        setDownloadDraft((p) => ({
                          ...p,
                          title: e.target.value,
                        }))
                      }
                      placeholder="Document title"
                      className={inputCls}
                    />
                    <input
                      value={downloadDraft.url}
                      onChange={(e) =>
                        setDownloadDraft((p) => ({ ...p, url: e.target.value }))
                      }
                      placeholder="PDF / document URL"
                      className={inputCls}
                    />
                    <div className="grid grid-cols-[1fr_auto] gap-3">
                      <input
                        value={downloadDraft.type}
                        onChange={(e) =>
                          setDownloadDraft((p) => ({
                            ...p,
                            type: e.target.value,
                          }))
                        }
                        placeholder="PDF"
                        className={inputCls}
                      />
                      <button
                        type="button"
                        onClick={addDownload}
                        className="rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
                      >
                        Add
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      {form.downloads.map((item, i) => (
                        <div
                          key={`${item.title}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {item.title}
                            </p>
                            <p className="truncate text-xs text-gray-400">
                              {item.type || "PDF"} - {item.url}
                            </p>
                          </div>
                          <button
                            onClick={() => removeDownload(i)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.downloads.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-400">
                          No public downloads added.
                        </div>
                      )}
                    </div>
                  </div>
                </Section>

                <Section icon={CircleHelp} title="FAQs" className="h-full">
                  <div className="flex h-full flex-col gap-3">
                    <input
                      value={faqDraft.question}
                      onChange={(e) =>
                        setFaqDraft((p) => ({ ...p, question: e.target.value }))
                      }
                      placeholder="Question"
                      className={inputCls}
                    />
                    <textarea
                      rows={2}
                      value={faqDraft.answer}
                      onChange={(e) =>
                        setFaqDraft((p) => ({ ...p, answer: e.target.value }))
                      }
                      placeholder="Answer"
                      className={`${inputCls} resize-none`}
                    />
                    <button
                      type="button"
                      onClick={addFaq}
                      className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700"
                    >
                      Add FAQ
                    </button>
                    <div className="flex-1 space-y-2">
                      {form.faqs.map((item, i) => (
                        <div
                          key={`${item.question}-${i}`}
                          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5"
                        >
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {item.question}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-gray-500">
                              {item.answer}
                            </p>
                          </div>
                          <button
                            onClick={() => removeFaq(i)}
                            className="text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {form.faqs.length === 0 && (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-400">
                          Default FAQs will be shown on the public page.
                        </div>
                      )}
                    </div>
                  </div>
                </Section>
              </div>
            </div>

            {/* RIGHT */}
            <div className="space-y-4 xl:sticky xl:top-6">
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-normal">
                    Live Page Summary
                  </h3>
                </div>
                <div className="space-y-2.5">
                  {liveSummary.map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-500">{label}</span>
                      <span
                        className={`font-semibold ${value === "-" ? "text-gray-300" : "text-gray-900"}`}
                      >
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 space-y-3">
                {projectId && (
                  <button
                    onClick={handlePreview}
                    disabled={isSaving || isPublishing}
                    className="w-full py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                )}
                <button
                  onClick={() => saveAndPublish(buildPayload())}
                  disabled={isPublishing || isSaving || !hasUnsavedChanges}
                  className="w-full py-3 bg-orange-600 hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-orange-200 disabled:text-orange-700/60 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                >
                  {isPublishing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isPublishing
                    ? "Publishing..."
                    : hasUnsavedChanges
                      ? "Publish Page"
                      : "No Changes to Publish"}
                </button>
                <button
                  onClick={() =>
                    saveUpdate({ ...buildPayload(), status: "draft" })
                  }
                  disabled={isSaving || isPublishing || !hasUnsavedChanges}
                  className="w-full py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
                >
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save as Draft
                </button>
                <button
                  onClick={() => navigate(returnPath)}
                  className="w-full py-2.5 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
                >
                  Back to Project
                </button>
              </div>

              {projectId && (
                <Section icon={ListChecks} title="Project Prefills">
                  <div className="space-y-4">
                    <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
                      <p className="text-sm font-bold text-gray-900">
                        {project?.name || "Project details"}
                      </p>
                      <div className="mt-2 space-y-1 text-xs leading-5 text-gray-600">
                        <p>
                          {[project?.state, project?.department]
                            .filter(Boolean)
                            .join(" | ") || stateName}
                        </p>
                        {(project?.startDate ||
                          project?.endDate ||
                          project?.closureDate) && (
                          <p>
                            {formatProjectDate(project?.startDate) ||
                              "Start date not set"}
                            {" - "}
                            {formatProjectDate(
                              project?.endDate || project?.closureDate,
                            ) || "End date not set"}
                          </p>
                        )}
                        {project?.publicSlug && (
                          <p>/apply/{project.publicSlug}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <button
                        type="button"
                        onClick={applyProjectText}
                        className="rounded-xl border border-orange-200 px-3 py-2.5 text-left text-xs font-bold text-orange-700 hover:bg-orange-50"
                      >
                        Use title, subtitle, and helpdesk address
                      </button>
                      <button
                        type="button"
                        onClick={addProjectNotices}
                        className="rounded-xl border border-orange-200 px-3 py-2.5 text-left text-xs font-bold text-orange-700 hover:bg-orange-50"
                      >
                        Add project date notices
                      </button>
                      <button
                        type="button"
                        onClick={useDefaultInstructions}
                        className="rounded-xl border border-orange-200 px-3 py-2.5 text-left text-xs font-bold text-orange-700 hover:bg-orange-50"
                      >
                        Use standard application instructions
                      </button>
                    </div>
                  </div>
                </Section>
              )}

              <Section icon={Link2} title="Quick Links">
                <div className="grid gap-3">
                  {Object.entries(form.quickLinks).map(([key, val]) => {
                    const labels = {
                      applyNow: "Apply Now",
                      latestNotifications: "Latest Notifications",
                      admitCards: "Admit Cards",
                      results: "Results",
                      support: "Support",
                    };
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 transition-colors hover:border-orange-200 hover:bg-orange-50/30"
                      >
                        <span className="min-w-0 text-sm font-medium text-gray-900">
                          {labels[key]}
                        </span>
                        <button
                          type="button"
                          aria-pressed={val}
                          aria-label={`${val ? "Disable" : "Enable"} ${labels[key]}`}
                          onClick={() => setQL(key, !val)}
                          className={`relative h-5 w-10 flex-shrink-0 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/25 focus:ring-offset-2 ${val ? "bg-orange-500" : "bg-gray-200"}`}
                        >
                          <span
                            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${val ? "translate-x-5" : "translate-x-0"}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          </div>

          {/* Bottom row — Instructions, Helpdesk, Visible Sections */}
          <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-3">
            <Section
              icon={ListChecks}
              title="Application Instructions"
              className="h-full"
            >
              <div className="flex h-full flex-col gap-3">
                <input
                  value={instructionText}
                  onChange={(e) => setInstructionText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addInstruction();
                    }
                  }}
                  placeholder="e.g. Keep scanned documents ready before applying"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={addInstruction}
                  disabled={!instructionText.trim()}
                  className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  Add Step
                </button>
                <div className="flex-1 space-y-2">
                  {form.instructions.map((item, i) => (
                    <div
                      key={`${item}-${i}`}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5"
                    >
                      <span className="text-sm text-gray-900">
                        {i + 1}. {item}
                      </span>
                      <button
                        onClick={() => removeInstruction(i)}
                        className="text-gray-400 hover:text-red-500 shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {form.instructions.length === 0 && (
                    <p className="py-2 text-center text-xs text-gray-400">
                      Default apply steps will be shown on the public page.
                    </p>
                  )}
                </div>
              </div>
            </Section>

            <Section icon={Phone} title="Helpdesk" className="h-full">
              <div className="space-y-3">
                <input
                  value={form.helpdesk.phone}
                  onChange={(e) => setHelpdesk("phone", e.target.value)}
                  placeholder="Helpline number"
                  className={inputCls}
                />
                <input
                  value={form.helpdesk.email}
                  onChange={(e) => setHelpdesk("email", e.target.value)}
                  placeholder="Support email"
                  className={inputCls}
                />
                <input
                  value={form.helpdesk.hours}
                  onChange={(e) => setHelpdesk("hours", e.target.value)}
                  placeholder="Support hours"
                  className={inputCls}
                />
                <textarea
                  rows={2}
                  value={form.helpdesk.address}
                  onChange={(e) => setHelpdesk("address", e.target.value)}
                  placeholder="Helpdesk address"
                  className={`${inputCls} resize-none`}
                />
              </div>
            </Section>

            <Section icon={Eye} title="Visible Sections" className="h-full">
              <div className="grid gap-3">
                {Object.entries(form.sectionVisibility).map(([key, val]) => {
                  const labels = {
                    notices: "Notices",
                    quickActions: "Quick Actions",
                    howToApply: "How to Apply",
                    downloads: "Downloads",
                    faqs: "FAQs",
                    helpdesk: "Helpdesk",
                  };
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
                    >
                      <span className="text-sm font-medium text-gray-900">
                        {labels[key] || key}
                      </span>
                      <button
                        type="button"
                        onClick={() => setVisibility(key, !val)}
                        className={`relative h-5 w-10 rounded-full transition-colors ${val ? "bg-orange-500" : "bg-gray-200"}`}
                        aria-pressed={val}
                      >
                        <span
                          className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${val ? "translate-x-5" : "translate-x-0"}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>

          {/* Bottom bar */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-gray-200">
            <div
              className={`flex items-center gap-2 text-xs ${hasUnsavedChanges ? "text-orange-600" : "text-emerald-600"}`}
            >
              <span
                className={`w-2 h-2 rounded-full ${hasUnsavedChanges ? "bg-orange-500" : "bg-emerald-500"}`}
              />
              {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(returnPath)}
                className="px-5 py-2.5 border border-gray-200 hover:border-gray-300 text-gray-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              {projectId && (
                <button
                  onClick={handlePreview}
                  disabled={isSaving || isPublishing}
                  className="px-5 py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview
                </button>
              )}
              <button
                onClick={() =>
                  saveUpdate({ ...buildPayload(), status: "draft" })
                }
                disabled={isSaving || isPublishing || !hasUnsavedChanges}
                className="px-5 py-2.5 border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold rounded-xl text-sm transition-colors disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400"
              >
                Save Draft
              </button>
              <button
                onClick={() => saveAndPublish(buildPayload())}
                disabled={isSaving || isPublishing || !hasUnsavedChanges}
                className="px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-sm transition-colors disabled:cursor-not-allowed disabled:bg-orange-200 disabled:text-orange-700/60 flex items-center gap-2"
              >
                {isPublishing && <Loader2 className="w-4 h-4 animate-spin" />}
                {hasUnsavedChanges ? "Publish Changes" : "No Changes"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default CmsEdit;
