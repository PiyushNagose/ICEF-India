const mongoose = require("mongoose");
const { getProjectLifecycleStatus } = require("../utils/timeline");

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      trim: true,
    },
    description: { type: String, trim: true },
    department: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["Upcoming", "Active", "Completed", "Cancelled"],
      default: "Upcoming",
    },
    startDate: { type: Date },
    // endDate is the recruitment/project closure date. It should cover the
    // entire lifecycle through result publication and final closure.
    endDate: { type: Date },
    closureDate: { type: Date },

    // Aggregated stats (updated via background jobs)
    totalJobs: { type: Number, default: 0 },
    totalApplicants: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    isPublished: { type: Boolean, default: false },

    // Public landing page slug (NEW)
    publicSlug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    
    // RBAC Soft Delete
    isSoftDeleted: { type: Boolean, default: false, index: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

projectSchema.index({ status: 1 });
projectSchema.index({ department: 1 });
projectSchema.index({ state: 1 });

// Auto-generate slug from name if not provided
projectSchema.pre("validate", function syncProjectClosure(next) {
  if (this.isModified("endDate")) this.closureDate = this.endDate;
  else if (this.isModified("closureDate")) this.endDate = this.closureDate;
  else {
    if (this.closureDate && !this.endDate) this.endDate = this.closureDate;
    if (this.endDate && !this.closureDate) this.closureDate = this.endDate;
  }
  this.status = getProjectLifecycleStatus(this);

  // Auto-generate publicSlug from name if not set
  if (this.name && !this.publicSlug) {
    this.publicSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "") // remove special chars
      .replace(/\s+/g, "-") // spaces to hyphens
      .replace(/-+/g, "-") // collapse multiple hyphens
      .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
  }
  next();
});

module.exports = mongoose.model("Project", projectSchema);
