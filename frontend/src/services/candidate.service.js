import { apiClient, unwrapData } from "../api/client";
import { API_BASE_URL } from "../api/config";

export const candidateService = {
  // ── Applications ──────────────────────────────────────────
  async getMyApplications(params = {}) {
    const response = await apiClient.get("/candidate/applications", { params });
    return unwrapData(response);
  },
  async getApplication(id) {
    const response = await apiClient.get(`/candidate/applications/${id}`);
    return unwrapData(response);
  },
  async createApplication(jobId) {
    const response = await apiClient.post("/candidate/applications", { jobId });
    return unwrapData(response);
  },
  async getJobDetails(jobId) {
    const response = await apiClient.get(`/jobs/${jobId}`);
    return unwrapData(response);
  },

  // ── Application Steps ─────────────────────────────────────
  async savePersonalDetails(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/personal-details`,
      data,
    );
    return unwrapData(response);
  },
  async saveEducation(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/education`,
      data,
    );
    return unwrapData(response);
  },
  async saveAdditionalInfo(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/additional-info`,
      data,
    );
    return unwrapData(response);
  },
  async saveAddress(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/address`,
      data,
    );
    return unwrapData(response);
  },
  async uploadDocument(id, type, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(
      `/candidate/applications/${id}/documents/${type}`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return unwrapData(response);
  },
  async saveDynamicFormResponses(id, data, meta = {}) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/form-responses`,
      { formResponses: data, ...meta },
    );
    return unwrapData(response);
  },
  async savePostSelection(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/post-selection`,
      data,
    );
    return unwrapData(response);
  },
  async submitApplication(id, declaration) {
    const response = await apiClient.post(
      `/candidate/applications/${id}/submit`,
      { declaration },
    );
    return unwrapData(response);
  },
  async finalizeApplication(id, transactionId, declaration) {
    const response = await apiClient.post(
      `/candidate/applications/${id}/finalize`,
      { transactionId, declaration },
    );
    return unwrapData(response);
  },
  async submitCorrection(id, declaration) {
    const response = await apiClient.post(
      `/candidate/applications/${id}/submit-correction`,
      { declaration },
    );
    return unwrapData(response);
  },

  // ── Notifications ─────────────────────────────────────────
  async getNotifications(params = {}) {
    const response = await apiClient.get("/candidate/notifications", {
      params,
    });
    const data = unwrapData(response);
    return {
      notifications: data?.notifications ?? [],
      unreadCount: data?.unreadCount ?? 0,
      meta: data?.meta ?? {},
    };
  },
  async markNotificationRead(id) {
    const response = await apiClient.patch(
      `/candidate/notifications/${id}/read`,
    );
    return unwrapData(response);
  },
  async markAllNotificationsRead() {
    const response = await apiClient.patch("/candidate/notifications/read-all");
    return unwrapData(response);
  },

  // ── Support ───────────────────────────────────────────────
  async getMyTickets(params = {}) {
    const response = await apiClient.get("/candidate/support/tickets", {
      params,
    });
    return unwrapData(response);
  },
  async getTicket(id) {
    const response = await apiClient.get(`/candidate/support/tickets/${id}`);
    return unwrapData(response);
  },
  async createTicket(data) {
    const response = await apiClient.post("/candidate/support/tickets", data);
    return unwrapData(response);
  },
  async uploadSupportAttachment(file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(
      "/candidate/support/attachments",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return unwrapData(response);
  },
  async replyToTicket(id, data) {
    const response = await apiClient.post(
      `/candidate/support/tickets/${id}/reply`,
      data,
    );
    return unwrapData(response);
  },
  async closeTicket(id) {
    const response = await apiClient.patch(
      `/candidate/support/tickets/${id}/close`,
    );
    return unwrapData(response);
  },
  async completeTicketAction(id) {
    const response = await apiClient.patch(
      `/candidate/support/tickets/${id}/complete-action`,
    );
    return unwrapData(response);
  },

  // ── Payments ──────────────────────────────────────────────
  async getMyPayments(params = {}) {
    const response = await apiClient.get("/candidate/payments/history", {
      params,
    });
    return unwrapData(response);
  },
  async initiatePayment(applicationId, gateway = "razorpay") {
    const response = await apiClient.post("/candidate/payments/initiate", {
      applicationId,
      gateway,
    });
    return unwrapData(response);
  },
  async verifyPayment(data) {
    const response = await apiClient.post("/candidate/payments/verify", data);
    return unwrapData(response);
  },
  async getPaymentByTransaction(transactionId) {
    const response = await apiClient.get(
      `/candidate/payments/${transactionId}`,
    );
    return unwrapData(response);
  },
  async getMyAdmitCards() {
    const response = await apiClient.get("/candidate/admit-cards");
    return unwrapData(response);
  },
  getAdmitCardHtmlUrl(id) {
    return `${API_BASE_URL}/candidate/admit-cards/${id}/html`;
  },
  getAdmitCardPdfUrl(id) {
    return `${API_BASE_URL}/candidate/admit-cards/${id}/pdf`;
  },
};
