const { StatusCodes } = require("http-status-codes");
const AdmitCardTemplate = require("../../shared/models/AdmitCardTemplate");
const { ApiResponse } = require("../../shared/utils/ApiResponse");
const ApiError = require("../../shared/utils/ApiError");
const asyncHandler = require("../../shared/utils/asyncHandler");
const {
  invalidatePublicRecruitmentCache,
} = require("../../shared/utils/publicCache");

const DEFAULT_TEMPLATES = [
  {
    name: "Standard",
    templateType: "admit_card",
    baseLayout: "standard",
    primaryColor: "#f97316",
    isSystemDefault: true,
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "Admit Card",
    sealText: "JSSC",
    provisionalNote:
      "NOTE: THIS ADMIT CARD PROVISIONALLY ALLOWS YOU TO APPEAR THE OMR BASED TEST ON THE BASIS OF THE PARTICULARS PROVIDED BY YOU IN THE ONLINE APPLICATION. MERE ISSUANCE OF THIS ADMIT CARD DOES NOT NECESSARILY MEAN ACCEPTANCE OF YOUR ELIGIBILITY. YOUR DOCUMENTS REGARDING ELIGIBILITY WILL BE SCRUTINIZED SUBSEQUENTLY.",
    instructionHeading: "Please read the instructions carefully given below in the admit card before appearing for the examination.",
    photoBoxText:
      "Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature",
    controllerTitle: "Examination Controller",
    instructions: "",
  },
  {
    name: "Modern",
    templateType: "admit_card",
    baseLayout: "modern",
    primaryColor: "#f97316",
    isSystemDefault: true,
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "Admit Card",
    sealText: "JSSC",
    provisionalNote:
      "NOTE: THIS ADMIT CARD PROVISIONALLY ALLOWS YOU TO APPEAR THE OMR BASED TEST ON THE BASIS OF THE PARTICULARS PROVIDED BY YOU IN THE ONLINE APPLICATION.",
    instructionHeading: "Please read the instructions carefully before appearing for the examination.",
    photoBoxText:
      "Paste Photo Here\nSignature of Candidate\nbelow pasted Photo same as\nUploaded Signature",
    controllerTitle: "Examination Controller",
    instructions: "",
  },
  {
    name: "Compact",
    templateType: "admit_card",
    baseLayout: "compact",
    primaryColor: "#f97316",
    isSystemDefault: true,
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "Admit Card",
    sealText: "JSSC",
    provisionalNote:
      "NOTE: This admit card is provisional and subject to verification of eligibility.",
    instructionHeading: "Instructions for candidates",
    photoBoxText: "Paste Photo Here\nSignature of Candidate",
    controllerTitle: "Examination Controller",
    instructions: "",
  },
  {
    name: "Standard Attendance Sheet",
    templateType: "attendance_sheet",
    baseLayout: "standard",
    primaryColor: "#f97316",
    isSystemDefault: true,
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "ATTENDANCE SHEET",
    sealText: "JSSC",
    instructions: "Candidate signature and thumb impression must be verified by the invigilator.",
  },
  {
    name: "Compact Attendance Sheet",
    templateType: "attendance_sheet",
    baseLayout: "compact",
    primaryColor: "#f97316",
    isSystemDefault: true,
    organizationName: "Jharkhand Staff Selection Commission",
    organizationNameLocal: "झारखंड कर्मचारी चयन आयोग",
    documentTitle: "ATTENDANCE SHEET",
    sealText: "JSSC",
    instructions: "Use this layout for center-wise bulk printing.",
  },
];

const ensureDefaultTemplates = async () => {
  await AdmitCardTemplate.updateMany(
    { templateType: { $exists: false } },
    { $set: { templateType: "admit_card" } },
  );

  await Promise.all(
    DEFAULT_TEMPLATES.map((template) =>
      AdmitCardTemplate.updateOne(
        { name: template.name, templateType: template.templateType, isSystemDefault: true },
        {
          $set: {
            baseLayout: template.baseLayout,
            primaryColor: template.primaryColor,
            templateType: template.templateType,
            isSystemDefault: true,
            organizationName: template.organizationName,
            organizationNameLocal: template.organizationNameLocal,
            documentTitle: template.documentTitle,
            sealText: template.sealText,
            provisionalNote: template.provisionalNote,
            instructionHeading: template.instructionHeading,
            photoBoxText: template.photoBoxText,
            controllerTitle: template.controllerTitle,
          },
          $setOnInsert: {
            name: template.name,
            instructions: template.instructions,
          },
        },
        { upsert: true },
      ),
    ),
  );
};

exports.getTemplates = asyncHandler(async (req, res) => {
  await ensureDefaultTemplates();
  const filter = {};
  if (["admit_card", "attendance_sheet"].includes(req.query.templateType)) {
    filter.templateType = req.query.templateType;
  }
  const templates = await AdmitCardTemplate.find(filter).sort({ isSystemDefault: -1, createdAt: -1 });
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "Templates fetched successfully", templates));
});

exports.createTemplate = asyncHandler(async (req, res) => {
  const {
    name,
    baseLayout,
    logoUrl,
    watermarkUrl,
    primaryColor,
    instructions,
    organizationName,
    organizationNameLocal,
    documentTitle,
    sealText,
    provisionalNote,
    instructionHeading,
    photoBoxText,
    controllerTitle,
  } = req.body;
  const templateType = ["admit_card", "attendance_sheet"].includes(req.body.templateType)
    ? req.body.templateType
    : "admit_card";
  
  if (!name || !baseLayout) {
    throw new ApiError(StatusCodes.BAD_REQUEST, "Name and base layout are required");
  }

  const template = await AdmitCardTemplate.create({
    name,
    templateType,
    baseLayout,
    logoUrl,
    watermarkUrl,
    primaryColor,
    instructions,
    organizationName,
    organizationNameLocal,
    documentTitle,
    sealText,
    provisionalNote,
    instructionHeading,
    photoBoxText,
    controllerTitle,
    isSystemDefault: false
  });

  await invalidatePublicRecruitmentCache();
  res.status(StatusCodes.CREATED).json(new ApiResponse(StatusCodes.CREATED, "Template created successfully", template));
});

exports.updateTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    baseLayout,
    logoUrl,
    watermarkUrl,
    primaryColor,
    instructions,
    organizationName,
    organizationNameLocal,
    documentTitle,
    sealText,
    provisionalNote,
    instructionHeading,
    photoBoxText,
    controllerTitle,
  } = req.body;
  const templateType = ["admit_card", "attendance_sheet"].includes(req.body.templateType)
    ? req.body.templateType
    : undefined;

  const template = await AdmitCardTemplate.findById(id);
  if (!template) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Template not found");
  }

  if (template.isSystemDefault) {
    throw new ApiError(StatusCodes.FORBIDDEN, "System default templates cannot be modified");
  }

  template.name = name || template.name;
  if (templateType) template.templateType = templateType;
  template.baseLayout = baseLayout || template.baseLayout;
  template.logoUrl = logoUrl !== undefined ? logoUrl : template.logoUrl;
  template.watermarkUrl = watermarkUrl !== undefined ? watermarkUrl : template.watermarkUrl;
  template.primaryColor = primaryColor || template.primaryColor;
  template.instructions = instructions !== undefined ? instructions : template.instructions;
  template.organizationName = organizationName !== undefined ? organizationName : template.organizationName;
  template.organizationNameLocal = organizationNameLocal !== undefined ? organizationNameLocal : template.organizationNameLocal;
  template.documentTitle = documentTitle !== undefined ? documentTitle : template.documentTitle;
  template.sealText = sealText !== undefined ? sealText : template.sealText;
  template.provisionalNote = provisionalNote !== undefined ? provisionalNote : template.provisionalNote;
  template.instructionHeading = instructionHeading !== undefined ? instructionHeading : template.instructionHeading;
  template.photoBoxText = photoBoxText !== undefined ? photoBoxText : template.photoBoxText;
  template.controllerTitle = controllerTitle !== undefined ? controllerTitle : template.controllerTitle;

  await template.save();

  await invalidatePublicRecruitmentCache();
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "Template updated successfully", template));
});

exports.deleteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const template = await AdmitCardTemplate.findById(id);
  if (!template) {
    throw new ApiError(StatusCodes.NOT_FOUND, "Template not found");
  }

  if (template.isSystemDefault) {
    throw new ApiError(StatusCodes.FORBIDDEN, "System default templates cannot be deleted");
  }

  await template.deleteOne();

  await invalidatePublicRecruitmentCache();
  res.status(StatusCodes.OK).json(new ApiResponse(StatusCodes.OK, "Template deleted successfully"));
});
