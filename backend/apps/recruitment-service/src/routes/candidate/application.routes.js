const express = require("express");
const router = express.Router();
const applicationController = require("../../controllers/candidate/application.controller");
const authenticate = require("../../shared/middlewares/authenticate");
const { authorize } = require("../../shared/middlewares/authorize");
const { upload } = require("../../shared/services/upload.service");
const validate = require("../../shared/middlewares/validate");
const {
  createApplicationSchema,
  personalDetailsSchema,
  educationSchema,
  additionalInfoSchema,
  addressSchema,
  postSelectionSchema,
  submitApplicationSchema,
} = require("../../shared/validations/application.validation");

router.use(authenticate, authorize("candidate"));

router.get("/", applicationController.getMyApplications);
router.post(
  "/",
  validate(createApplicationSchema),
  applicationController.createApplication,
);
router.get("/:id", applicationController.getApplication);
router.put(
  "/:id/personal-details",
  validate(personalDetailsSchema),
  applicationController.updatePersonalDetails,
);
router.put(
  "/:id/education",
  validate(educationSchema),
  applicationController.updateEducation,
);
router.put(
  "/:id/additional-info",
  validate(additionalInfoSchema),
  applicationController.updateAdditionalInfo,
);
router.put(
  "/:id/address",
  validate(addressSchema),
  applicationController.updateAddress,
);
router.put("/:id/form-responses", applicationController.updateFormResponses);
router.post(
  "/:id/documents/:type",
  upload.single("file"),
  applicationController.uploadDocument,
);
router.get(
  "/:id/documents/:type/preview",
  applicationController.previewDocument,
);
router.put(
  "/:id/post-selection",
  validate(postSelectionSchema),
  applicationController.updatePostSelection,
);
router.post(
  "/:id/submit",
  validate(submitApplicationSchema),
  applicationController.submitApplication,
);
router.post("/:id/finalize", applicationController.finalizeApplication);
router.post("/:id/submit-correction", applicationController.submitCorrection);

module.exports = router;
