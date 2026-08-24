const mongoose = require("mongoose");

const standardCriterionSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    male: { type: String, trim: true },
    female: { type: String, trim: true },
    value: { type: String, trim: true },
    unit: { type: String, trim: true },
    notes: { type: String, trim: true },
  },
  { _id: true },
);

const physicalStandardsSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    criteria: [standardCriterionSchema],
  },
  { _id: false },
);

const medicalStandardsSchema = new mongoose.Schema(
  {
    required: { type: Boolean, default: false },
    criteria: [standardCriterionSchema],
  },
  { _id: false },
);

const standardPresetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true },
    description: { type: String, trim: true },
    physicalStandards: {
      type: physicalStandardsSchema,
      default: () => ({ required: false }),
    },
    medicalStandards: {
      type: medicalStandardsSchema,
      default: () => ({ required: false }),
    },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
  },
  { timestamps: true },
);

standardPresetSchema.index({ active: 1, name: 1 });

module.exports = mongoose.model("StandardPreset", standardPresetSchema);
