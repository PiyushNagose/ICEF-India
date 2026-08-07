const { z } = require("zod");

const jobPostSchema = z.object({
  _id: z.string().optional(),
  postCode: z.string().max(50).optional().default(""),
  title: z.string().min(2, "Post title is required").max(200),
  designation: z.string().min(2, "Designation is required").max(200),
  department: z.string().max(200).optional().default(""),
  category: z.string().max(100).optional().default(""),
  vacancies: z.number().int().min(1, "Vacancies must be at least 1"),
  payLevel: z.string().max(100).optional().default(""),
  location: z.string().max(200).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

const educationItemSchema = z.object({
  degree: z.string().optional(),
  specialization: z.string().optional(),
  university: z.string().optional(),
});

const formFieldSchema = z.object({
  type: z
    .enum([
      "text",
      "textarea",
      "email",
      "tel",
      "number",
      "date",
      "select",
      "radio",
      "checkbox",
      "file",
    ])
    .default("text"),
  label: z.string().min(1),
  required: z.boolean().optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

const formSectionSchema = z.object({
  title: z.string().min(1),
  systemSource: z.string().optional(),
  required: z.boolean().optional(),
  fields: z.array(formFieldSchema).optional().default([]),
});

const createJobSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(3, "Job title must be at least 3 characters").max(200),
  postCode: z.string().min(2, "Post code is required").max(50),
  department: z.string().min(2, "Department is required"),
  category: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return v;
      const map = { general: 'General', technical: 'Technical', administrative: 'Administrative', teaching: 'Teaching' };
      return map[v.toLowerCase()] || v;
    }),
  jobType: z
    .string()
    .optional()
    .transform((v) => {
      if (!v) return v;
      const map = { permanent: 'Permanent', contract: 'Contract', temporary: 'Temporary' };
      return map[v.toLowerCase()] || v;
    }),
  workLocation: z.string().optional(),
  description: z.string().max(5000).optional(),
  totalPosts: z.number().int().min(0).optional(),
  posts: z.array(jobPostSchema).optional(),
  postSelectionMode: z
    .enum(["single", "preference"])
    .optional()
    .default("single"),
  reservedPosts: z
    .object({
      sc: z.number().int().min(0).optional(),
      st: z.number().int().min(0).optional(),
      obc: z.number().int().min(0).optional(),
      ews: z.number().int().min(0).optional(),
      pwd: z.number().int().min(0).optional(),
    })
    .optional(),
  salaryRange: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    })
    .optional(),
  applicationFee: z
    .object({
      general: z.number().min(0).optional(),
      obc: z.number().min(0).optional(),
      scSt: z.number().min(0).optional(),
      ews: z.number().min(0).optional(),
      pwd: z.number().min(0).optional(),
    })
    .optional(),
  applicationStartDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  correctionStartDate: z.string().optional(),
  correctionDeadline: z.string().optional(),
  admitCardReleaseDate: z.string().optional(),
  examDate: z.string().optional(),
  resultDate: z.string().optional(),
  // Eligibility fields
  ageLimit: z
    .object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
      relaxation: z
        .object({
          sc:  z.number().min(0).optional(),
          st:  z.number().min(0).optional(),
          obc: z.number().min(0).optional(),
          pwd: z.number().min(0).optional(),
        })
        .optional(),
    })
    .optional(),
  education: z
    .object({
      essential:  z.array(educationItemSchema).optional(),
      desirable:  z.array(educationItemSchema).optional(),
    })
    .optional(),
  experience: z
    .object({
      required:    z.boolean().optional(),
      years:       z.number().min(0).optional(),
      type:        z.string().optional(),
      description: z.string().optional(),
    })
    .optional(),
  physicalStandards: z
    .object({
      required: z.boolean().optional(),
      height:   z.object({ male: z.number().optional(), female: z.number().optional() }).optional(),
      chest:    z.object({ male: z.number().optional(), female: z.number().optional() }).optional(),
      weight:   z.object({ male: z.number().optional(), female: z.number().optional() }).optional(),
    })
    .optional(),
  medicalStandards: z
    .object({
      required: z.boolean().optional(),
      vision:   z.string().optional(),
      hearing:  z.string().optional(),
      other:    z.string().optional(),
    })
    .optional(),
  otherRequirements: z.array(z.string()).optional(),
  documentRequirements: z
    .array(
      z.object({
        name:        z.string().min(1),
        description: z.string().optional(),
        required:    z.boolean().optional(),
        formats:     z.array(z.string()).optional(),
        maxSizeKB:   z.number().optional(),
      }).passthrough(),
    )
    .optional(),
  formSections: z.array(formSectionSchema).optional(),
  paymentConfig: z
    .object({
      applicationFee:      z.number().min(0).optional(),
      examFee:             z.number().min(0).optional(),
      processingFee:       z.number().min(0).optional(),
      paymentMethods:      z.array(z.string()).optional(),
      refundPolicy:        z.string().optional(),
      paymentDeadline:     z.string().optional(),
      paymentDeadlineHours:z.number().optional(),
    })
    .optional(),
});

// updateJobSchema: accepts any object — validation is intentionally loose
// for updates since admins may update partial data at any step.
// The controller handles business logic validation.
const updateJobSchema = z.object({}).passthrough();

module.exports = { createJobSchema, updateJobSchema };
