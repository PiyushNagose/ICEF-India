const { z } = require("zod");

const registerSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  registeredMobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
  // Optional fields passed from registration form
  fullName:    z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender:      z.string().optional(),
  state:       z.string().optional(),
});

const verifyOTPSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, "OTP must be 6 digits"),
});

const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
  accountType: z.enum(["candidate", "admin", "employee"]).default("candidate"),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  accountType: z.enum(["candidate", "admin", "employee"]).default("candidate"),
  otp: z.string().length(6),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

module.exports = {
  registerSchema,
  verifyOTPSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
