const mongoose = require('mongoose');

const admitCardTemplateSchema = new mongoose.Schema(
  {
    name: { 
      type: String, 
      required: true, 
      trim: true 
    },
    templateType: {
      type: String,
      enum: ['admit_card', 'attendance_sheet'],
      default: 'admit_card',
      index: true
    },
    baseLayout: { 
      type: String, 
      enum: ['standard', 'modern', 'compact'], 
      required: true,
      default: 'standard'
    },
    logoUrl: { 
      type: String, 
      trim: true,
      default: '' 
    },
    watermarkUrl: { 
      type: String, 
      trim: true,
      default: '' 
    },
    primaryColor: { 
      type: String, 
      trim: true,
      default: '#f97316' // Tailwind orange-500
    },
    organizationName: {
      type: String,
      trim: true,
      default: ''
    },
    organizationNameLocal: {
      type: String,
      trim: true,
      default: ''
    },
    documentTitle: {
      type: String,
      trim: true,
      default: ''
    },
    sealText: {
      type: String,
      trim: true,
      default: ''
    },
    provisionalNote: {
      type: String,
      trim: true,
      default: ''
    },
    instructionHeading: {
      type: String,
      trim: true,
      default: ''
    },
    photoBoxText: {
      type: String,
      trim: true,
      default: ''
    },
    controllerTitle: {
      type: String,
      trim: true,
      default: ''
    },
    isSystemDefault: { 
      type: Boolean, 
      default: false 
    },
    projectId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Project' 
    },
    instructions: {
      type: String,
      default: ''
    }
  },
  { 
    timestamps: true 
  }
);

admitCardTemplateSchema.index({ templateType: 1, name: 1, isSystemDefault: 1 });

module.exports = mongoose.model('AdmitCardTemplate', admitCardTemplateSchema);
