const { z } = require("zod");

const createEmployeeSchema = z.object({
  fullName: z.string().min(2, "Full name is required").max(100),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  contactNumber: z.string().regex(/^[6-9]\d{9}$/, "Invalid mobile number"),
  department: z.string().min(2, "Department is required"),
  roleDesignation: z.string().min(2, "Role designation is required"),
  employeeId: z.string().min(2, "Employee ID is required"),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  officialEmail: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  systemRole: z.string().min(1, "System role is required"),
  projectScopes: z.array(z.string()).optional(),
  fieldPermissions: z.record(z.any()).optional(),
});

const updateEmployeeSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  contactNumber: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(),
  department: z.string().min(2).optional(),
  roleDesignation: z.string().min(2).optional(),
  dateOfJoining: z.string().optional(),
  systemRole: z.string().optional(),
  status: z.enum(["Active", "Inactive", "On Leave"]).optional(),
  password: z.string().min(8, "Password must be at least 8 characters").optional(),
  projectScopes: z.array(z.string()).optional(),
  fieldPermissions: z.record(z.any()).optional(),
});

module.exports = { createEmployeeSchema, updateEmployeeSchema };
