const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  },
  { _id: true },
);

const quickLinksSchema = new mongoose.Schema(
  {
    applyNow:           { type: Boolean, default: true },
    latestNotifications:{ type: Boolean, default: true },
    admitCards:         { type: Boolean, default: true },
    results:            { type: Boolean, default: true },
    support:            { type: Boolean, default: true },
  },
  { _id: false },
);

const statsBannerSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    // Hero section
    heroTitle:    { type: String, trim: true, default: "" },
    heroSubtitle: { type: String, trim: true, default: "" },
    bannerImage:  { type: String, default: "" }, // Cloudinary URL or external URL

    // Featured recruitments — references to Job IDs
    featuredJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Job" }],

    // Announcements / scroll ticker
    announcements: [announcementSchema],

    // Quick links toggles
    quickLinks: { type: quickLinksSchema, default: () => ({}) },

    // Status
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },

    // Meta
    createdBy: { type: mongoose.Schema.Types.ObjectId },
    updatedBy: { type: mongoose.Schema.Types.ObjectId },
  },
  { timestamps: true },
);

statsBannerSchema.index({ status: 1 });

module.exports = mongoose.model("StateBanner", statsBannerSchema);
