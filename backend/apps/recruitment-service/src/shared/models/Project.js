const mongoose = require("mongoose");

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

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
  },
  { timestamps: true },
);

projectSchema.index({ status: 1 });
projectSchema.index({ department: 1 });
projectSchema.index({ state: 1 });

projectSchema.pre("validate", function syncProjectClosure(next) {
  if (this.closureDate && !this.endDate) this.endDate = this.closureDate;
  if (this.endDate && !this.closureDate) this.closureDate = this.endDate;
  next();
});

module.exports = mongoose.model("Project", projectSchema);
