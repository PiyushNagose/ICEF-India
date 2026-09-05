const multer = require("multer");
const { execFile } = require("child_process");
const { cloudinary } = require("../config/cloudinary");
const ApiError = require("../utils/ApiError");

// ── Allowed MIME types per document type ─────────────────────
const ALLOWED_TYPES = {
  passport_photo: ["image/jpeg", "image/jpg"],
  signature: ["image/jpeg", "image/jpg", "image/png"],
  default: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
};

// ── Max sizes in bytes ────────────────────────────────────────
const MAX_SIZES = {
  passport_photo: 100 * 1024, // 100 KB
  signature: 100 * 1024, // 100 KB
  default: 500 * 1024, // 500 KB
};

// ── Multer: store in memory, validate on the fly ──────────────
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const docType = req.params.type || "default";
  const allowed = ALLOWED_TYPES[docType] || ALLOWED_TYPES.default;

  if (!allowed.includes(file.mimetype)) {
    return cb(
      new ApiError(400, `Invalid file type. Allowed: ${allowed.join(", ")}`),
      false,
    );
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const SIGNATURES = {
  "application/pdf": [
    (buffer) => buffer.subarray(0, 4).toString("hex") === "25504446",
  ],
  "image/jpeg": [
    (buffer) =>
      buffer.length > 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  ],
  "image/jpg": [
    (buffer) =>
      buffer.length > 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  ],
  "image/png": [
    (buffer) => buffer.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  ],
  "application/msword": [
    (buffer) => buffer.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1",
  ],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    (buffer) => buffer.subarray(0, 4).toString("hex") === "504b0304",
  ],
};

const validateFileSignature = (buffer, mimeType) => {
  const checks = SIGNATURES[mimeType] || [];
  if (!checks.length) return;
  if (!checks.some((check) => check(buffer))) {
    throw new ApiError(
      400,
      "Uploaded file content does not match the selected file type",
    );
  }
};

const isVirusScanRequired = () =>
  String(process.env.DOCUMENT_VIRUS_SCAN_REQUIRED || "").toLowerCase() ===
  "true";

const scanBufferForViruses = async (buffer, fileName = "upload") => {
  const provider = process.env.DOCUMENT_VIRUS_SCAN_PROVIDER || "none";
  const command = process.env.DOCUMENT_VIRUS_SCAN_COMMAND;

  if (!isVirusScanRequired()) {
    return { status: "skipped", provider, scannedAt: null, fileName };
  }

  if (!command) {
    throw new ApiError(
      503,
      "Document virus scanner is required but not configured",
    );
  }

  await new Promise((resolve, reject) => {
    const child = execFile(command, [], { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(
          new ApiError(
            400,
            `Document failed virus scan${stderr ? `: ${stderr}` : ""}`,
          ),
        );
      }
      const output = `${stdout || ""} ${stderr || ""}`.toLowerCase();
      if (output.includes("infected") || output.includes("virus")) {
        return reject(new ApiError(400, "Document failed virus scan"));
      }
      resolve();
    });
    child.stdin.end(buffer);
  });

  return { status: "clean", provider, scannedAt: new Date(), fileName };
};

// ── Upload buffer to Cloudinary ───────────────────────────────
const uploadToCloudinary = (buffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "recruitment_portal/documents",
        resource_type: "auto",
        ...options,
      },
      (error, result) => {
        if (error) {
          const statusCode = error.http_code || error.statusCode || 500;
          const isAuthError = statusCode === 401 || statusCode === 403;
          return reject(
            new ApiError(
              isAuthError ? 502 : 500,
              isAuthError
                ? "Cloudinary upload failed: invalid or unauthorized Cloudinary credentials"
                : `Cloudinary upload failed: ${error.message}`,
            ),
          );
        }
        resolve(result);
      },
    );
    stream.end(buffer);
  });
};

const getSignedCloudinaryUrl = (publicId, options = {}) => {
  if (!publicId) return "";
  const expiresAt =
    Math.floor(Date.now() / 1000) + Number(options.expiresInSeconds || 300);
  return cloudinary.url(publicId, {
    resource_type: options.resourceType || "auto",
    type: options.type || "authenticated",
    sign_url: true,
    secure: true,
    expires_at: expiresAt,
  });
};

// ── Validate file size per document type ─────────────────────
const validateFileSize = (sizeBytes, docType) => {
  const maxSize = MAX_SIZES[docType] || MAX_SIZES.default;
  if (sizeBytes > maxSize) {
    throw new ApiError(
      400,
      `File too large. Max size for ${docType}: ${maxSize / 1024}KB`,
    );
  }
};

// ── Delete from Cloudinary ────────────────────────────────────
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  await cloudinary.uploader.destroy(publicId);
};

module.exports = {
  upload,
  uploadToCloudinary,
  validateFileSize,
  validateFileSignature,
  scanBufferForViruses,
  getSignedCloudinaryUrl,
  deleteFromCloudinary,
};

