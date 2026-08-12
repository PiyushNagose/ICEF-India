const slugify = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "general";

const extractNumericTail = (value = "") => {
  const match = String(value || "").match(/(\d{1,12})$/);
  return match ? Number(match[1]) : 1;
};

const buildBatchNumber = (identifier, batchSize = 10000) => {
  const numeric = extractNumericTail(identifier);
  const batch = Math.max(1, Math.ceil(numeric / batchSize));
  return `batch-${String(batch).padStart(4, "0")}`;
};

const resolveProjectSlug = ({ project, job } = {}) =>
  slugify(
    project?.publicSlug ||
      project?.name ||
      job?.projectName ||
      job?.projectId?.publicSlug ||
      job?.projectId?.name ||
      job?.projectId ||
      "project",
  );

const resolveJobSlug = (job) =>
  slugify(job?.publicSlug || job?.postCode || job?.title || job?._id || "job");

const buildApplicationStoragePath = ({ application, project, job } = {}) => {
  const identifier =
    application?.registrationNumber ||
    application?.applicationId ||
    application?._id ||
    Date.now();
  const batchNumber =
    application?.fileStorage?.batchNumber || buildBatchNumber(identifier);

  return {
    provider: "cloudinary",
    batchNumber,
    basePath: [
      "recruitment_portal",
      "projects",
      resolveProjectSlug({ project, job }),
      "jobs",
      resolveJobSlug(job),
      "applications",
      batchNumber,
      String(identifier),
    ].join("/"),
  };
};

const normalizeDocumentFile = (doc) => ({
  key: slugify(doc?.type || doc?.name || doc?.originalName || "document"),
  type: doc?.type || "",
  label: doc?.name || doc?.type || "Document",
  provider: doc?.cloudinaryPublicId ? "cloudinary" : doc?.localPath ? "local" : "unknown",
  url: doc?.cloudinaryUrl || "",
  publicId: doc?.cloudinaryPublicId || "",
  localPath: doc?.localPath || "",
  mimeType: doc?.mimeType || "",
  originalName: doc?.originalName || "",
  sizeKB: Number(doc?.sizeKB || 0),
  status: doc?.status || "pending",
  uploadedAt: doc?.uploadedAt || null,
});

const buildFileManifest = (application) =>
  (Array.isArray(application?.documents) ? application.documents : []).map(
    normalizeDocumentFile,
  );

const applyFileStorageMetadata = (application, { project, job } = {}) => {
  const storagePath = buildApplicationStoragePath({ application, project, job });
  const files = buildFileManifest(application);
  const totalStorageUsed = files.reduce(
    (total, file) => total + Number(file.sizeKB || 0),
    0,
  );

  application.fileStorage = {
    ...(application.fileStorage || {}),
    ...storagePath,
    fileCount: files.length,
    totalStorageUsed,
    files,
    manifestUpdatedAt: new Date(),
  };

  return application.fileStorage;
};

module.exports = {
  applyFileStorageMetadata,
  buildApplicationStoragePath,
  buildBatchNumber,
  buildFileManifest,
  slugify,
};
