const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    link: { type: String, trim: true, default: "" },
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

const downloadSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    type: { type: String, trim: true, default: "PDF" },
  },
  { _id: true },
);

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
  },
  { _id: true },
);

const helpdeskSchema = new mongoose.Schema(
  {
    phone: { type: String, trim: true, default: "1800-123-4567" },
    email: { type: String, trim: true, default: "support@recruitment.gov.in" },
    hours: { type: String, trim: true, default: "Monday to Friday, 9:00 AM to 6:00 PM" },
    address: { type: String, trim: true, default: "Recruitment Portal Helpdesk" },
  },
  { _id: false },
);

const sectionVisibilitySchema = new mongoose.Schema(
  {
    notices: { type: Boolean, default: true },
    quickActions: { type: Boolean, default: true },
    howToApply: { type: Boolean, default: true },
    downloads: { type: Boolean, default: true },
    faqs: { type: Boolean, default: true },
    helpdesk: { type: Boolean, default: true },
  },
  { _id: false },
);

const statsBannerSchema = new mongoose.Schema(
  {
    state: {
      type: String,
      required: true,
      trim: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
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

    // Project microsite content
    downloads: [downloadSchema],
    faqs: [faqSchema],
    instructions: [{ type: String, trim: true }],
    helpdesk: { type: helpdeskSchema, default: () => ({}) },
    sectionVisibility: { type: sectionVisibilitySchema, default: () => ({}) },

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
statsBannerSchema.index(
  { state: 1 },
  { unique: true, partialFilterExpression: { projectId: null } },
);
statsBannerSchema.index(
  { projectId: 1 },
  { unique: true, partialFilterExpression: { projectId: { $type: "objectId" } } },
);

module.exports = mongoose.model("StateBanner", statsBannerSchema);
