const { z } = require("zod");

const createProjectSchema = z.object({
  name: z
    .string()
    .min(3, "Project name must be at least 3 characters")
    .max(200),
  description: z.string().max(1000).optional(),
  department: z.string().min(2, "Department is required"),
  state: z.string().min(2, "State is required"),
  startDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
  endDate: z
    .string()
    .datetime({ offset: true })
    .optional()
    .or(z.string().optional()),
  closureDate: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(3).max(200).optional(),
  description: z.string().max(1000).optional(),
  department: z.string().min(2).optional(),
  state: z.string().min(2).optional(),
  status: z.enum(["Upcoming", "Active", "Completed", "Cancelled"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  closureDate: z.string().optional(),
});

module.exports = { createProjectSchema, updateProjectSchema };
