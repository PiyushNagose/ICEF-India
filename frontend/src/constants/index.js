export const ROUTES = {
  // Public Routes
  HOME: "/",
  JOBS: "/jobs",
  JOB_DETAILS: "/jobs/:id",
  RESULTS: "/results",
  NOTICES: "/notices",
  ADMIT_CARDS: "/admit-cards",
  DOWNLOADS: "/downloads",
  FAQ: "/faq",
  CONTACT: "/contact",
  ABOUT: "/about",

  // Auth Routes
  CANDIDATE_LOGIN: "/auth/candidate-login",
  ADMIN_LOGIN: "/auth/admin-login",
  EMPLOYEE_LOGIN: "/auth/employee-login",
  REGISTER: "/auth/register",
  FORGOT_PASSWORD: "/auth/forgot-password", // Candidate forgot password
  ADMIN_FORGOT_PASSWORD: "/auth/admin/forgot-password", // Super Admin forgot password
  EMPLOYEE_FORGOT_PASSWORD: "/auth/employee/forgot-password", // Employee forgot password
  RESET_PASSWORD: "/auth/reset-password",
  VERIFY_OTP: "/auth/verify-otp",

  // Candidate Routes
  CANDIDATE_DASHBOARD: "/candidate/dashboard",
  CANDIDATE_PROFILE: "/candidate/profile",
  CANDIDATE_JOBS: "/candidate/jobs",
  CANDIDATE_APPLICATIONS: "/candidate/applications",
  CANDIDATE_DOCUMENTS: "/candidate/documents",
  CANDIDATE_PAYMENTS: "/candidate/payments",
  CANDIDATE_ADMIT_CARD: "/candidate/admit-card",
  CANDIDATE_RESULTS: "/candidate/results",
  CANDIDATE_SUPPORT: "/candidate/support",
  CANDIDATE_NOTIFICATIONS: "/candidate/notifications",

  // Admin Routes
  ADMIN_DASHBOARD: "/admin/dashboard",
  ADMIN_PROJECTS: "/admin/projects",
  ADMIN_JOBS: "/admin/jobs",
  ADMIN_VACANCIES: "/admin/vacancies",
  ADMIN_CANDIDATES: "/admin/candidates",
  ADMIN_APPLICATIONS: "/admin/applications",
  ADMIN_DOCUMENTS: "/admin/documents",
  ADMIN_PAYMENTS: "/admin/payments",
  ADMIN_RESULTS: "/admin/results",
  ADMIN_ANALYTICS: "/admin/analytics",
  ADMIN_REPORTS: "/admin/reports",
  ADMIN_SUPPORT: "/admin/support",
  ADMIN_EMPLOYEES: "/admin/employees",
  ADMIN_ROLES: "/admin/roles",
  ADMIN_NOTIFICATIONS: "/admin/notifications",
  ADMIN_SETTINGS: "/admin/settings",
  ADMIN_PAYMENT_SETTINGS: "/admin/payment-settings",
};

export const COLORS = {
  // Admin Portal Colors
  admin: {
    primary: "#D97706", // Orange
    secondary: "#F3F4F6", // Light Gray
    accent: "#1F2937", // Dark Gray
    background: "#FFFFFF",
    text: "#111827",
  },

  // Candidate Portal Colors (Orange/Cream theme from screenshots)
  candidate: {
    primary: "#EA580C", // Orange
    secondary: "#FEF3C7", // Light Cream
    accent: "#DC2626", // Red accent
    background: "#FFFBEB", // Cream background
    text: "#1F2937",
    sidebar: "#1F2937", // Dark sidebar
    step: "#F59E0B", // Step indicator orange
  },

  // Public Website Colors
  public: {
    primary: "#059669", // Green (Government)
    secondary: "#F0FDF4", // Light Green
    accent: "#047857", // Dark Green
    background: "#FFFFFF",
    text: "#111827",
  },
};

export const STATUS_COLORS = {
  ACTIVE: "bg-green-100 text-green-800",
  INACTIVE: "bg-gray-100 text-gray-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  COMPLETED: "bg-blue-100 text-blue-800",
  DRAFT: "bg-gray-100 text-gray-800",
  CLOSED: "bg-red-100 text-red-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  UNDER_REVIEW: "bg-yellow-100 text-yellow-800",
  SUBMITTED: "bg-blue-100 text-blue-800",
  PAID: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  VERIFICATION: "bg-orange-100 text-orange-800",
  RECEIVING: "bg-green-100 text-green-800",
};

export const PRIORITY_COLORS = {
  HIGH: "text-red-600",
  MEDIUM: "text-yellow-600",
  LOW: "text-green-600",
};

export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"];

export const STATES = [
  "Bihar",
  "Delhi",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Gujarat",
  "Rajasthan",
  "Uttar Pradesh",
  "West Bengal",
  "Madhya Pradesh",
];

export const DEPARTMENTS = [
  "Civil Services Board",
  "Health Department",
  "Education Department",
  "Public Works Department",
  "Finance Department",
  "Home Affairs",
  "Rural Development",
  "Urban Development",
];
