const { z } = require("zod");

const createApplicationSchema = z.object({
  jobId: z.string().min(1, "Job ID is required"),
});

const personalDetailsSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  fatherName: z.string().min(2).max(100).optional(),
  motherName: z.string().min(2).max(100).optional(),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  gender: z.enum(["male", "female", "other"]),
  category: z.enum(["general", "obc", "sc", "st", "ews"]),
  maritalStatus: z
    .enum(["single", "married", "divorced", "widowed"])
    .optional(),
  religion: z.string().max(50).optional(),
  identificationMark: z.string().max(200).optional(),
  registeredMobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
  isDomicileOfBihar: z.boolean(),
});

const educationSchema = z.object({
  tenth: z
    .object({
      board: z.string().min(1),
      school: z.string().min(1),
      rollNumber: z.string().min(1),
      year: z.number().int().min(1990).max(new Date().getFullYear()),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
  twelfth: z
    .object({
      board: z.string().min(1),
      stream: z.string().min(1),
      school: z.string().min(1),
      rollNumber: z.string().min(1),
      year: z.number().int().min(1990).max(new Date().getFullYear()),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
  graduation: z
    .object({
      degree: z.string().min(1),
      university: z.string().min(1),
      year: z.number().int().min(1990).max(new Date().getFullYear()),
      percentage: z.number().min(0).max(100),
    })
    .optional(),
  hasPostGraduation: z.boolean().optional(),
});

const additionalInfoSchema = z.object({
  isGovtEmployee: z.boolean().optional(),
  departmentName: z.string().optional(),
  yearsOfService: z.number().int().min(0).optional(),
  isExServiceman: z.boolean().optional(),
  isPwD: z.boolean().optional(),
  disabilityType: z.string().optional(),
  disabilityPercentage: z.number().min(0).max(100).optional(),
  drivingLicense: z.string().optional(),
  computerCertificate: z.string().optional(),
  subjectCombination: z.string().optional(),
});

const addressSchema = z.object({
  permanent: z.object({
    addressLine1: z.string().min(5),
    addressLine2: z.string().optional(),
    state: z.string().min(2),
    district: z.string().min(2),
    policeStation: z.string().optional(),
    pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
  }),
  correspondence: z
    .object({
      addressLine1: z.string().min(5),
      addressLine2: z.string().optional(),
      state: z.string().min(2),
      district: z.string().min(2),
      policeStation: z.string().optional(),
      pincode: z.string().regex(/^\d{6}$/, "Invalid pincode"),
    })
    .optional(),
  sameAsPermanent: z.boolean().optional(),
});

const postSelectionSchema = z.object({
  appliedPosts: z
    .array(
      z.object({
        jobId: z.string().min(1),
        postId: z.string().optional(),
        postCode: z.string().optional().default(""),
        title: z.string().min(1),
        designation: z.string().optional().default(""),
        department: z.string().optional().default(""),
        vacancies: z.number().int().min(1).optional(),
        preference: z.number().int().min(1),
      }),
    )
    .min(1, "Select at least one post"),
});

const submitApplicationSchema = z.object({
  declaration: z.string().min(10, "Declaration is required"),
});

const updateStatusSchema = z.object({
  status: z.enum([
    "under_review",
    "verified",
    "approved",
    "clarification_required",
    "rejected",
    "shortlisted",
  ]),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

const bulkActionSchema = z.object({
  applicationIds: z.array(z.string()).min(1, "Select at least one application"),
  action: z.enum(["update_status"]),
  status: z
    .enum([
      "under_review",
      "verified",
      "approved",
      "clarification_required",
      "rejected",
      "shortlisted",
    ])
    .optional(),
  rejectionReason: z.string().optional(),
  notes: z.string().optional(),
});

module.exports = {
  createApplicationSchema,
  personalDetailsSchema,
  educationSchema,
  additionalInfoSchema,
  addressSchema,
  postSelectionSchema,
  submitApplicationSchema,
  updateStatusSchema,
  bulkActionSchema,
};
