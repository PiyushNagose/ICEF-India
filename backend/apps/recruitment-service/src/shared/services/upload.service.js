const multer = require("multer");
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
  deleteFromCloudinary,
};

