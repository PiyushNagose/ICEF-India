import { apiClient, unwrapData } from "../api/client";

// ── Project / Landing page ────────────────────────────────────
export const publicService = {
  getProjectBySlug: (slug) =>
    apiClient.get(`/public/projects/${slug}`).then(unwrapData),

  getActiveProjects: (params = {}) =>
    apiClient.get("/public/projects", { params }).then(unwrapData),

  // ── OTP (used by PublicApplyEntry before login) ───────────
  sendOTP: (identifier, type) =>
    apiClient.post("/public/otp/send", { identifier, type }),

  verifyOTP: (identifier, type, otp) =>
    apiClient.post("/public/otp/verify", { identifier, type, otp }),

  checkVerification: (identifier, type) =>
    apiClient.post("/public/otp/check-verification", { identifier, type }),

  getRemainingTime: (identifier, type) =>
    apiClient.post("/public/otp/remaining-time", { identifier, type }),

  // ── Public services (NO login required) ──────────────────

  // Check application status by registration number
  checkStatus: (payload) =>
    apiClient.post("/public/application/status", payload).then(unwrapData),

  // Request correction during correction window
  requestCorrection: (payload) =>
    apiClient
      .post("/public/application/request-correction", payload)
      .then(unwrapData),

  // Check correction request status
  getCorrectionStatus: (requestId, registrationNumber) =>
    apiClient
      .get(`/public/application/correction-status/${requestId}`, {
        params: { registrationNumber },
      })
      .then(unwrapData),

  // Download admit card by registration number + OTP
  downloadAdmitCard: (payload) =>
    apiClient.post("/admit-cards/lookup", payload).then(unwrapData),

  submitSupportEnquiry: (payload) =>
    apiClient.post("/public/support/enquiry", payload).then(unwrapData),

  lookupSupportTicket: (payload) =>
    apiClient.post("/public/support/lookup", payload).then(unwrapData),

  replySupportTicket: (payload) =>
    apiClient.post("/public/support/reply", payload).then(unwrapData),
};
