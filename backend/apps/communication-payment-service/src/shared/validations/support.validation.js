const { z } = require("zod");

const createTicketSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  category: z.enum([
    "Technical",
    "Payment",
    "General",
    "Document",
    "Application",
  ]),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  linkedApplicationId: z.string().optional(),
  transactionId: z.string().optional(),
  attachments: z.array(z.string().url()).max(5).optional(),
});

const updateTicketSchema = z.object({
  status: z.enum(["Open", "In Progress", "Resolved", "Closed"]).optional(),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  assignedTo: z.string().optional(),
});

const addReplySchema = z.object({
  message: z.string().min(1, "Reply message is required").max(2000),
});

const ticketActionSchema = z.object({
  note: z.string().max(1000).optional(),
});

const publicEnquirySchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email is required"),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"),
  category: z.enum([
    "Technical",
    "Payment",
    "General",
    "Document",
    "Application",
  ]),
  priority: z.enum(["Low", "Medium", "High", "Critical"]).optional(),
  title: z.string().min(5, "Subject must be at least 5 characters").max(200),
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000),
  registrationNumber: z.string().max(60).optional(),
  applicationId: z.string().max(60).optional(),
  attachments: z.array(z.string().url()).max(5).optional(),
});

const publicTicketLookupSchema = z.object({
  ticketId: z.string().min(8, "Ticket ID is required").max(80),
  contact: z
    .string()
    .min(5, "Registered email or mobile is required")
    .max(120),
});

const publicTicketReplySchema = publicTicketLookupSchema.extend({
  message: z.string().min(1, "Reply message is required").max(2000),
});

module.exports = {
  createTicketSchema,
  updateTicketSchema,
  addReplySchema,
  ticketActionSchema,
  publicEnquirySchema,
  publicTicketLookupSchema,
  publicTicketReplySchema,
};
