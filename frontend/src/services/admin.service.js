import { apiClient, unwrapData } from "../api/client";

export const adminService = {
  // ── Projects ──────────────────────────────────────────────
  async getProjects(params = {}) {
    const response = await apiClient.get("/admin/projects", { params });
    return unwrapData(response);
  },
  async getProjectStats() {
    const response = await apiClient.get("/admin/projects/stats");
    return unwrapData(response);
  },
  async getProject(id) {
    const response = await apiClient.get(`/admin/projects/${id}`);
    return unwrapData(response);
  },
  async createProject(data) {
    const response = await apiClient.post("/admin/projects", data);
    return unwrapData(response);
  },
  async updateProject(id, data) {
    const response = await apiClient.put(`/admin/projects/${id}`, data);
    return unwrapData(response);
  },
  async deleteProject(id) {
    const response = await apiClient.delete(`/admin/projects/${id}`);
    return unwrapData(response);
  },

  // ── Jobs ──────────────────────────────────────────────────
  async getAdminJobs(params = {}) {
    const response = await apiClient.get("/admin/jobs", { params });
    return unwrapData(response);
  },
  async getAdminJobStats() {
    const response = await apiClient.get("/admin/jobs/stats");
    return unwrapData(response);
  },
  async getAdminJob(id) {
    const response = await apiClient.get(`/admin/jobs/${id}`);
    return unwrapData(response);
  },
  async getAdminJobByPostCode(postCode) {
    const response = await apiClient.get(`/admin/jobs/by-postcode/${encodeURIComponent(postCode)}`);
    return unwrapData(response);
  },
  async createJob(data) {
    const response = await apiClient.post("/admin/jobs", data);
    return unwrapData(response);
  },
  async updateJob(id, data) {
    const response = await apiClient.put(`/admin/jobs/${id}`, data);
    return unwrapData(response);
  },
  async publishJob(id) {
    const response = await apiClient.put(`/admin/jobs/${id}/publish`);
    return unwrapData(response);
  },
  async closeJob(id) {
    const response = await apiClient.put(`/admin/jobs/${id}/close`);
    return unwrapData(response);
  },
  async deleteJob(id) {
    const response = await apiClient.delete(`/admin/jobs/${id}`);
    return unwrapData(response);
  },

  // ── Applications ──────────────────────────────────────────
  async getApplications(params = {}) {
    const response = await apiClient.get("/admin/applications", { params });
    return unwrapData(response);
  },
  async getApplicationStats() {
    const response = await apiClient.get("/admin/applications/stats");
    return unwrapData(response);
  },
  async getApplication(id) {
    const response = await apiClient.get(`/admin/applications/${id}`);
    return unwrapData(response);
  },
  async downloadApplicationExport(type = "register", params = {}) {
    const response = await apiClient.get(
      `/admin/applications/exports/${type}`,
      {
        params,
        responseType: "blob",
      },
    );
    return response;
  },
  async repairApplicationStorageManifests(params = {}) {
    const response = await apiClient.post(
      "/admin/applications/exports/repair-manifests",
      null,
      { params },
    );
    return unwrapData(response);
  },
  async updateApplicationStatus(id, data) {
    const response = await apiClient.put(
      `/admin/applications/${id}/status`,
      data,
    );
    return unwrapData(response);
  },
  async reviewApplicationCorrection(id, data) {
    const response = await apiClient.put(
      `/admin/applications/${id}/correction-review`,
      data,
    );
    return unwrapData(response);
  },
  async verifyDocument(applicationId, documentId) {
    const response = await apiClient.put(
      `/admin/applications/${applicationId}/documents/${documentId}/verify`,
    );
    return unwrapData(response);
  },
  async rejectDocument(applicationId, documentId, rejectionReason) {
    const response = await apiClient.put(
      `/admin/applications/${applicationId}/documents/${documentId}/reject`,
      { rejectionReason },
    );
    return unwrapData(response);
  },
  async bulkUpdateApplications(data) {
    const response = await apiClient.post(
      "/admin/applications/bulk-action",
      data,
    );
    return unwrapData(response);
  },

  // ── Exams / Admit Cards ───────────────────────────────────
  async getExamCenters(params = {}) {
    const response = await apiClient.get("/admin/exams/centers", { params });
    return unwrapData(response);
  },
  async createExamCenter(data) {
    const response = await apiClient.post("/admin/exams/centers", data);
    return unwrapData(response);
  },
  async getExamCenter(id) {
    const response = await apiClient.get(`/admin/exams/centers/${id}`);
    return unwrapData(response);
  },
  async updateExamCenter(id, data) {
    const response = await apiClient.put(`/admin/exams/centers/${id}`, data);
    return unwrapData(response);
  },
  async getExamRooms(centerId) {
    const response = await apiClient.get(`/admin/exams/centers/${centerId}/rooms`);
    return unwrapData(response);
  },
  async createExamRoom(centerId, data) {
    const response = await apiClient.post(`/admin/exams/centers/${centerId}/rooms`, data);
    return unwrapData(response);
  },
  async updateExamRoom(roomId, data) {
    const response = await apiClient.put(`/admin/exams/rooms/${roomId}`, data);
    return unwrapData(response);
  },
  async getExamSchedules(params = {}) {
    const response = await apiClient.get("/admin/exams/schedules", { params });
    return unwrapData(response);
  },
  async createExamSchedule(data) {
    const response = await apiClient.post("/admin/exams/schedules", data);
    return unwrapData(response);
  },
  async getExamSchedule(id) {
    const response = await apiClient.get(`/admin/exams/schedules/${id}`);
    return unwrapData(response);
  },
  async updateExamSchedule(id, data) {
    const response = await apiClient.put(`/admin/exams/schedules/${id}`, data);
    return unwrapData(response);
  },
  async getExamScheduleStats(id) {
    const response = await apiClient.get(`/admin/exams/schedules/${id}/stats`);
    return unwrapData(response);
  },
  async previewExamAllocation(id, data = {}) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/allocation/preview`, data);
    return unwrapData(response);
  },
  async runExamAllocation(id, data = {}) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/allocation/run`, data);
    return unwrapData(response);
  },
  async queueExamAllocation(id, data = {}) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/allocation/run-job`, data);
    return unwrapData(response);
  },
  async lockExamAllocation(id) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/allocation/lock`);
    return unwrapData(response);
  },
  async getExamAllocations(id, params = {}) {
    const response = await apiClient.get(`/admin/exams/schedules/${id}/allocations`, { params });
    return unwrapData(response);
  },
  async generateAdmitCards(id) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/admit-cards/generate`);
    return unwrapData(response);
  },
  async queueAdmitCardGeneration(id) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/admit-cards/generate-job`);
    return unwrapData(response);
  },
  async publishAdmitCards(id) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/admit-cards/publish`);
    return unwrapData(response);
  },
  async unpublishAdmitCards(id, reason) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/admit-cards/unpublish`, { reason });
    return unwrapData(response);
  },
  async regenerateAdmitCards(id, reason) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/admit-cards/regenerate`, { reason });
    return unwrapData(response);
  },
  async getScheduleAdmitCards(id, params = {}) {
    const response = await apiClient.get(`/admin/exams/schedules/${id}/admit-cards`, { params });
    return unwrapData(response);
  },
  getAdminAdmitCardHtmlUrl(id) {
    return `/api/admin/exams/admit-cards/${id}/html`;
  },
  getAdminAdmitCardPdfUrl(id) {
    return `/api/admin/exams/admit-cards/${id}/pdf`;
  },
  getAttendanceSheetHtmlUrl(id) {
    return `/api/admin/exams/schedules/${id}/attendance-sheet/html`;
  },
  getAttendanceSheetPdfUrl(id) {
    return `/api/admin/exams/schedules/${id}/attendance-sheet/pdf`;
  },
  getCenterAttendanceSheetHtmlUrl(id, centerId) {
    return `/api/admin/exams/schedules/${id}/attendance-sheet/html?centerId=${encodeURIComponent(centerId)}`;
  },
  getCenterAttendanceSheetPdfUrl(id, centerId) {
    return `/api/admin/exams/schedules/${id}/attendance-sheet/pdf?centerId=${encodeURIComponent(centerId)}`;
  },
  async queueBulkAdmitCards(id, data = {}) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/bulk/admit-cards`, data);
    return unwrapData(response);
  },
  async queueBulkAttendance(id, data = {}) {
    const response = await apiClient.post(`/admin/exams/schedules/${id}/bulk/attendance`, data);
    return unwrapData(response);
  },
  async getBulkExamJob(jobId) {
    const response = await apiClient.get(`/admin/exams/jobs/${jobId}`);
    return unwrapData(response);
  },
  async retryBulkExamJob(jobId) {
    const response = await apiClient.post(`/admin/exams/jobs/${jobId}/retry`);
    return unwrapData(response);
  },
  getBulkExamJobDownloadUrl(jobId) {
    return `/api/admin/exams/jobs/${jobId}/download`;
  },

  // ── Employees ─────────────────────────────────────────────
  async getEmployees(params = {}) {
    const response = await apiClient.get("/admin/employees", { params });
    return unwrapData(response);
  },
  async getEmployeeStats() {
    const response = await apiClient.get("/admin/employees/stats");
    return unwrapData(response);
  },
  async getEmployee(id) {
    const response = await apiClient.get(`/admin/employees/${id}`);
    return unwrapData(response);
  },
  async createEmployee(data) {
    const response = await apiClient.post("/admin/employees", data);
    return unwrapData(response);
  },
  async updateEmployee(id, data) {
    const response = await apiClient.put(`/admin/employees/${id}`, data);
    return unwrapData(response);
  },
  async deleteEmployee(id) {
    const response = await apiClient.delete(`/admin/employees/${id}`);
    return unwrapData(response);
  },

  // ── Roles ─────────────────────────────────────────────────
  async getRoles(params = {}) {
    const response = await apiClient.get("/admin/roles", { params });
    return unwrapData(response);
  },
  async getRole(id) {
    const response = await apiClient.get(`/admin/roles/${id}`);
    return unwrapData(response);
  },
  async createRole(data) {
    const response = await apiClient.post("/admin/roles", data);
    return unwrapData(response);
  },
  async updateRole(id, data) {
    const response = await apiClient.put(`/admin/roles/${id}`, data);
    return unwrapData(response);
  },
  async deleteRole(id) {
    const response = await apiClient.delete(`/admin/roles/${id}`);
    return unwrapData(response);
  },

  // ── Analytics ─────────────────────────────────────────────
  async getAnalyticsOverview() {
    const response = await apiClient.get("/admin/analytics/overview");
    return unwrapData(response);
  },
  async getAnalyticsFunnel(params = {}) {
    const response = await apiClient.get("/admin/analytics/funnel", { params });
    return unwrapData(response);
  },
  async getTopJobs(params = {}) {
    const response = await apiClient.get("/admin/analytics/top-jobs", {
      params,
    });
    return unwrapData(response);
  },
  async getPaymentAnalytics() {
    const response = await apiClient.get("/admin/analytics/payments");
    return unwrapData(response);
  },
  async getDepartmentStats() {
    const response = await apiClient.get("/admin/analytics/departments");
    return unwrapData(response);
  },
  async getDemographics() {
    const response = await apiClient.get("/admin/analytics/demographics");
    return unwrapData(response);
  },

  // ── Support ───────────────────────────────────────────────
  async getSupportTickets(params = {}) {
    const response = await apiClient.get("/admin/support/tickets", { params });
    const tickets = unwrapData(response);
    return {
      tickets: Array.isArray(tickets) ? tickets : tickets?.tickets || [],
      meta: tickets?.meta || response?.meta || {},
    };
  },
  async getSupportStats() {
    const response = await apiClient.get("/admin/support/stats");
    return unwrapData(response);
  },
  async getSupportTicket(id) {
    const response = await apiClient.get(`/admin/support/tickets/${id}`);
    return unwrapData(response);
  },
  async updateSupportTicket(id, data) {
    const response = await apiClient.put(`/admin/support/tickets/${id}`, data);
    return unwrapData(response);
  },
  async replyToTicket(id, data) {
    const response = await apiClient.post(
      `/admin/support/tickets/${id}/reply`,
      data,
    );
    return unwrapData(response);
  },
  async requestTicketCorrection(id, data = {}) {
    const response = await apiClient.post(
      `/admin/support/tickets/${id}/request-correction`,
      data,
    );
    return unwrapData(response);
  },
  async verifyTicketPayment(id, data = {}) {
    const response = await apiClient.post(
      `/admin/support/tickets/${id}/verify-payment`,
      data,
    );
    return unwrapData(response);
  },

  // ── Payments ──────────────────────────────────────────────
  async getPayments(params = {}) {
    const response = await apiClient.get("/admin/payments", { params });
    return unwrapData(response);
  },
  async getPaymentStats() {
    const response = await apiClient.get("/admin/payments/stats");
    return unwrapData(response);
  },
  async getPaymentGateways() {
    const response = await apiClient.get("/admin/payment-gateways");
    return unwrapData(response);
  },
  async getPaymentGateway(name) {
    const response = await apiClient.get(`/admin/payment-gateways/${name}`);
    return unwrapData(response);
  },
  async upsertPaymentGateway(name, data) {
    const response = await apiClient.put(`/admin/payment-gateways/${name}`, data);
    return unwrapData(response);
  },
  async testPaymentGateway(name) {
    const response = await apiClient.post(`/admin/payment-gateways/${name}/test`);
    return unwrapData(response);
  },
  async setDefaultGateway(name) {
    const response = await apiClient.post(`/admin/payment-gateways/${name}/set-default`);
    return unwrapData(response);
  },

  // ── Admin Notifications ───────────────────────────────────
  async getAdminNotifications(params = {}) {
    const response = await apiClient.get("/admin/notifications", { params });
    const data = unwrapData(response);
    return {
      notifications: data?.notifications ?? [],
      unreadCount: data?.unreadCount ?? 0,
      meta: data?.meta ?? {},
    };
  },
  async markAdminNotificationRead(id) {
    const response = await apiClient.patch(`/admin/notifications/${id}/read`);
    return unwrapData(response);
  },
  async markAllAdminNotificationsRead() {
    const response = await apiClient.patch("/admin/notifications/read-all");
    return unwrapData(response);
  },
  async deleteAdminNotification(id) {
    const response = await apiClient.delete(`/admin/notifications/${id}`);
    return unwrapData(response);
  },

  // ── Admin Profile (self) ──────────────────────────────────
  async getMyProfile() {
    const response = await apiClient.get("/auth/me");
    return unwrapData(response);
  },
  async updateMyProfile(data) {
    const response = await apiClient.put("/auth/profile", data);
    return unwrapData(response);
  },

  // ── CMS — State Banner Pages ──────────────────────────────
  async getCmsPages() {
    const response = await apiClient.get("/admin/cms");
    return unwrapData(response);
  },
  async getCmsActivity(limit = 10) {
    const response = await apiClient.get(`/admin/cms/activity?limit=${limit}`);
    return unwrapData(response);
  },
  async getCmsPage(state) {
    const response = await apiClient.get(`/admin/cms/${encodeURIComponent(state)}`);
    return unwrapData(response);
  },
  async uploadCmsBannerImage(file) {
    const formData = new FormData();
    formData.append("image", file);
    const response = await apiClient.post("/admin/cms/upload-image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return unwrapData(response);
  },
  async createCmsPage(data) {
    const response = await apiClient.post("/admin/cms", data);
    return unwrapData(response);
  },
  async updateCmsPage(state, data) {
    const response = await apiClient.put(`/admin/cms/${encodeURIComponent(state)}`, data);
    return unwrapData(response);
  },
  async publishCmsPage(state) {
    const response = await apiClient.put(`/admin/cms/${encodeURIComponent(state)}/publish`);
    return unwrapData(response);
  },
  async deleteCmsPage(state) {
    const response = await apiClient.delete(`/admin/cms/${encodeURIComponent(state)}`);
    return unwrapData(response);
  },

  // ── Activity Logs ─────────────────────────────────────────
  async getActivityLogs(params = {}) {
    const response = await apiClient.get("/admin/activity-logs", { params });
    // response is full body: { data: [...logs], meta: {...} }
    return { logs: response?.data ?? [], meta: response?.meta ?? {} };
  },
  async getEmployeeActivityLogs(employeeId, params = {}) {
    const response = await apiClient.get(`/admin/activity-logs/employee/${employeeId}`, { params });
    // response.data = { logs, stats }
    return { logs: response?.data?.logs ?? [], stats: response?.data?.stats ?? [], meta: response?.meta ?? {} };
  },
};
