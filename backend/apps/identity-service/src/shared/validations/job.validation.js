const { z } = require("zod");

const createJobSchema = z.object({
  projectId: z.string().min(1, "Project ID is required"),
  title: z.string().min(3, "Job title must be at least 3 characters").max(200),
  postCode: z.string().min(2, "Post code is required").max(50),
  department: z.string().min(2, "Department is required"),
  category: z
    .enum(["General", "Technical", "Administrative", "Teaching"])
    .optional(),
  jobType: z.enum(["Permanent", "Contract", "Temporary"]).optional(),
  workLocation: z.string().optional(),
  description: z.string().max(5000).optional(),
  totalPosts: z.number().int().min(1).optional(),
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
      scSt: z.number().min(0).optional(),
      pwd: z.number().min(0).optional(),
    })
    .optional(),
  paymentConfig: z
    .object({
      applicationFee: z.number().min(0).optional(),
      examFee: z.number().min(0).optional(),
      processingFee: z.number().min(0).optional(),
      paymentTiming: z.enum(["after_personal", "final"]).optional(),
      paymentMethods: z.array(z.string()).optional(),
      refundPolicy: z.string().optional(),
      paymentDeadline: z.string().optional(),
    })
    .optional(),
  applicationStartDate: z.string().optional(),
  applicationDeadline: z.string().optional(),
  correctionStartDate: z.string().optional(),
  correctionDeadline: z.string().optional(),
  admitCardReleaseDate: z.string().optional(),
  examDate: z.string().optional(),
  resultDate: z.string().optional(),
});

const updateJobSchema = createJobSchema.partial();

module.exports = { createJobSchema, updateJobSchema };
