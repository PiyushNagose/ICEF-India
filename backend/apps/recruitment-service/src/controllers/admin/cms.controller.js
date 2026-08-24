const { StatusCodes } = require("http-status-codes");
const StateBanner = require("../../shared/models/StateBanner");
const Project = require("../../shared/models/Project");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const asyncHandler = require("../../shared/utils/asyncHandler");
const ApiError = require("../../shared/utils/ApiError");
const { saveAuditLog } = require("../../shared/middlewares/auditLog");
const { uploadToCloudinary } = require("../../shared/services/upload.service");
const {
  emitToAdmins,
  emitBroadcast,
  SOCKET_EVENTS,
} = require("../../shared/socket/index");
const {
  invalidatePublicRecruitmentCache,
} = require("../../shared/utils/publicCache");

const emitCmsRealtime = (event, page, action) => {
  try {
    const payload = {
      action,
      state: page?.state,
      pageId: page?._id,
      page: typeof page?.toObject === "function" ? page.toObject() : page,
      timestamp: new Date(),
    };
    emitToAdmins(event, payload);
    emitBroadcast(event, payload);
  } catch {
    // Socket.IO may not be initialized in test/CLI contexts.
  }
};

const defaultQuickLinks = {
  applyNow: true,
  latestNotifications: true,
  admitCards: true,
  results: true,
  support: true,
};

const defaultSectionVisibility = {
  notices: true,
  quickActions: true,
  howToApply: true,
  downloads: true,
  faqs: true,
  helpdesk: true,
};

const defaultHelpdesk = {
  phone: "1800-123-4567",
  email: "support@recruitment.gov.in",
  hours: "Monday to Friday, 9:00 AM to 6:00 PM",
  address: "Recruitment Portal Helpdesk",
};

const getCmsScope = async ({ state, projectId }) => {
  if (!projectId) {
    return {
      filter: {
        state,
        $or: [{ projectId: null }, { projectId: { $exists: false } }],
      },
      state,
      project: null,
      isProjectPage: false,
    };
  }

  const project = await Project.findById(projectId).lean();
  if (!project) throw new ApiError(404, "Project not found");

  return {
    filter: { projectId },
    state: project.state || state,
    project,
    isProjectPage: true,
  };
};

const buildDefaultProjectPage = (project) => ({
  _id: null,
  state: project.state,
  projectId: project._id,
  heroTitle: project.name || "",
  heroSubtitle: project.description || "",
  bannerImage: "",
  featuredJobs: [],
  announcements: [],
  quickLinks: defaultQuickLinks,
  downloads: [],
  faqs: [],
  instructions: [],
  helpdesk: defaultHelpdesk,
  sectionVisibility: defaultSectionVisibility,
  status: "draft",
});

// GET /api/admin/cms  — list all state pages with summary
const getAll = asyncHandler(async (req, res) => {
  const pages = await StateBanner.find()
    .populate("projectId", "name state publicSlug")
    .populate("featuredJobs", "title postCode department")
    .sort({ updatedAt: -1 })
    .lean();

  const total      = pages.length;
  const published  = pages.filter((p) => p.status === "published").length;
  const draft      = pages.filter((p) => p.status === "draft").length;
  const archived   = pages.filter((p) => p.status === "archived").length;
  const lastUpdated = pages[0]?.updatedAt || null;

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "CMS pages fetched", {
      pages,
      stats: { total, published, draft, archived, lastUpdated },
    }),
  );
});

// GET /api/admin/cms/:state  — get one state page by state name
const getOne = asyncHandler(async (req, res) => {
  const scope = await getCmsScope({
    state: req.params.state,
    projectId: req.query.projectId,
  });
  const page = await StateBanner.findOne(scope.filter)
    .populate("featuredJobs", "title postCode department status")
    .lean();

  if (!page && !scope.isProjectPage) throw new ApiError(404, "State page not found");

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "CMS page fetched", {
      page: page || buildDefaultProjectPage(scope.project),
    }),
  );
});

// POST /api/admin/cms  — create state page
const create = asyncHandler(async (req, res) => {
  const {
    state, heroTitle, heroSubtitle, bannerImage,
    featuredJobs, announcements, quickLinks, status, projectId,
    downloads, faqs, instructions, helpdesk, sectionVisibility,
  } = req.body;

  if (!state && !projectId) throw new ApiError(400, "State is required");

  const scope = await getCmsScope({ state: state?.trim(), projectId });
  const existing = await StateBanner.findOne(scope.filter);
  if (existing) {
    throw new ApiError(
      409,
      scope.isProjectPage
        ? "A landing page for this project already exists"
        : `A page for "${state}" already exists`,
    );
  }

  const page = await StateBanner.create({
    state: scope.isProjectPage
      ? `${scope.state}::project:${projectId}`
      : scope.state.trim(),
    projectId: scope.isProjectPage ? projectId : null,
    heroTitle:    heroTitle    || "",
    heroSubtitle: heroSubtitle || "",
    bannerImage:  bannerImage  || "",
    featuredJobs: featuredJobs || [],
    announcements: announcements || [],
    quickLinks:   quickLinks   || {},
    downloads: downloads || [],
    faqs: faqs || [],
    instructions: instructions || [],
    helpdesk: helpdesk || defaultHelpdesk,
    sectionVisibility: sectionVisibility || defaultSectionVisibility,
    status:       status       || "draft",
    createdBy:    req.user?.id,
    updatedBy:    req.user?.id,
  });
  await invalidatePublicRecruitmentCache();
  emitCmsRealtime(SOCKET_EVENTS.CMS_CREATED, page, "created");

  res.status(StatusCodes.CREATED).json(
    new ApiResponse(StatusCodes.CREATED, "State page created", { page }),
  );
});

// PUT /api/admin/cms/:state  — update state page
const update = asyncHandler(async (req, res) => {
  const scope = await getCmsScope({
    state: req.params.state,
    projectId: req.query.projectId || req.body.projectId,
  });
  let page = await StateBanner.findOne(scope.filter);
  if (!page && !scope.isProjectPage) throw new ApiError(404, "State page not found");
  if (!page && scope.isProjectPage) {
    page = new StateBanner({
      state: `${scope.state}::project:${scope.project._id}`,
      projectId: scope.project._id,
      heroTitle: scope.project.name || "",
      heroSubtitle: scope.project.description || "",
      quickLinks: defaultQuickLinks,
      downloads: [],
      faqs: [],
      instructions: [],
      helpdesk: defaultHelpdesk,
      sectionVisibility: defaultSectionVisibility,
      status: "draft",
      createdBy: req.user?.id,
    });
  }

  const allowed = [
    "heroTitle","heroSubtitle","bannerImage",
    "featuredJobs","announcements","quickLinks","status",
    "downloads","faqs","instructions","helpdesk","sectionVisibility",
  ];
  allowed.forEach((field) => {
    if (req.body[field] !== undefined) page[field] = req.body[field];
  });
  page.updatedBy = req.user?.id;

  await page.save();
  await invalidatePublicRecruitmentCache();
  await saveAuditLog(
    req,
    `Updated ${scope.isProjectPage ? "project landing page" : "CMS page"}: ${page.heroTitle || page.state}`,
  );
  emitCmsRealtime(SOCKET_EVENTS.CMS_UPDATED, page, "updated");

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "State page updated", { page }),
  );
});

// DELETE /api/admin/cms/:state  — delete state page
const remove = asyncHandler(async (req, res) => {
  const scope = await getCmsScope({
    state: req.params.state,
    projectId: req.query.projectId || req.body.projectId,
  });
  const page = await StateBanner.findOneAndDelete(scope.filter);
  if (!page) throw new ApiError(404, "CMS page not found");
  await invalidatePublicRecruitmentCache();
  await saveAuditLog(
    req,
    `Deleted ${scope.isProjectPage ? "project landing page" : "CMS page"}: ${page.heroTitle || page.state}`,
  );
  emitCmsRealtime(SOCKET_EVENTS.CMS_DELETED, page, "deleted");

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "State page deleted"),
  );
});

// PUT /api/admin/cms/:state/publish  — publish
const publish = asyncHandler(async (req, res) => {
  const scope = await getCmsScope({
    state: req.params.state,
    projectId: req.query.projectId || req.body.projectId,
  });
  const page = await StateBanner.findOne(scope.filter);
  if (!page) throw new ApiError(404, "CMS page not found");
  page.status = "published";
  page.updatedBy = req.user?.id;
  await page.save();
  await invalidatePublicRecruitmentCache();

  emitCmsRealtime(SOCKET_EVENTS.CMS_UPDATED, page, "published");
  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "State page published", { page }),
  );
});

// ── Public endpoint — used by Home page ──────────────────────────────────────
// GET /api/cms/state/:state  — get published page for a state (public, no auth)
const getPublicStatePage = asyncHandler(async (req, res) => {
  const page = await StateBanner.findOne({
    state: req.params.state,
    status: "published",
  })
    .populate("featuredJobs", "title postCode department totalPosts applicationDeadline salaryRange applicationFee workLocation status")
    .lean();

  if (!page) {
    return res.status(StatusCodes.OK).json(
      new ApiResponse(StatusCodes.OK, "No published page for this state", { page: null }),
    );
  }

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "State page fetched", { page }),
  );
});

// POST /api/admin/cms/upload-image  — upload banner image to Cloudinary
const uploadBannerImage = asyncHandler(async (req, res) => {
  if (!req.file) throw new ApiError(400, "No image file provided");

  const result = await uploadToCloudinary(req.file.buffer, {
    folder: "recruitment_portal/cms_banners",
    resource_type: "image",
  });

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "Image uploaded", {
      url: result.secure_url,
      publicId: result.public_id,
    }),
  );
});

// GET /api/admin/cms/activity  — recent CMS activity from real DB data
const getActivity = asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 10, 50);

  // Get the most recently modified pages
  const recentPages = await StateBanner.find()
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("state projectId status heroTitle announcements updatedAt createdAt updatedBy")
    .populate("projectId", "name state publicSlug")
    .lean();

  const activities = [];

  for (const page of recentPages) {
    const isNew = Math.abs(new Date(page.updatedAt) - new Date(page.createdAt)) < 5000;
    const pageTitle =
      page.projectId?.name ||
      String(page.state || "").split("::project:")[0] ||
      "Landing page";
    const pageKind = page.projectId ? "project landing" : "state page";

    if (page.status === "published") {
      activities.push({
        id:   `${page._id}-published`,
        type: "publish",
        text: `${pageTitle} ${pageKind} published`,
        time: page.updatedAt,
      });
    } else if (page.status === "archived") {
      activities.push({
        id:   `${page._id}-archived`,
        type: "archive",
        text: `${pageTitle} ${pageKind} archived`,
        time: page.updatedAt,
      });
    } else if (isNew) {
      activities.push({
        id:   `${page._id}-created`,
        type: "create",
        text: `${pageTitle} ${pageKind} created`,
        time: page.createdAt,
      });
    } else {
      activities.push({
        id:   `${page._id}-edit`,
        type: "edit",
        text: `${pageTitle} ${pageKind} updated`,
        time: page.updatedAt,
      });
    }

    // Surface individual announcement additions (latest 1 per page)
    if (Array.isArray(page.announcements) && page.announcements.length > 0) {
      const latest = page.announcements[page.announcements.length - 1];
      if (latest?.text) {
        activities.push({
          id:   `${page._id}-ann`,
          type: "announcement",
          text: `Announcement added for ${pageTitle}: "${latest.text.slice(0, 60)}${latest.text.length > 60 ? "..." : ""}"`,
          time: page.updatedAt,
        });
      }
    }
  }

  // Sort by time desc, take top `limit`
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  const result = activities.slice(0, limit);

  res.status(StatusCodes.OK).json(
    new ApiResponse(StatusCodes.OK, "CMS activity fetched", { activities: result }),
  );
});

module.exports = { getAll, getOne, create, update, remove, publish, getPublicStatePage, uploadBannerImage, getActivity };
