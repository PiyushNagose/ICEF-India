import { apiClient, unwrapData } from "../api/client";

export const applicationService = {
  // Candidate - Get applications
  async getMyApplications(params = {}) {
    const response = await apiClient.get("/candidate/applications", { params });
    return { data: unwrapData(response), meta: response?.meta };
  },

  // Candidate - Create new application
  async createApplication(jobId) {
    const response = await apiClient.post("/candidate/applications", { jobId });
    return unwrapData(response);
  },

  // Candidate - Get single application
  async getApplication(id) {
    const response = await apiClient.get(`/candidate/applications/${id}`);
    return unwrapData(response);
  },

  // Candidate - Update personal details (Step 1)
  async updatePersonalDetails(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/personal-details`,
      data,
    );
    return unwrapData(response);
  },

  // Candidate - Update education (Step 2)
  async updateEducation(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/education`,
      data,
    );
    return unwrapData(response);
  },

  // Candidate - Update additional info (Step 3)
  async updateAdditionalInfo(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/additional-info`,
      data,
    );
    return unwrapData(response);
  },

  // Candidate - Update address (Step 4)
  async updateAddress(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/address`,
      data,
    );
    return unwrapData(response);
  },

  // Candidate - Save dynamic form responses (Custom fields from job)
  async saveDynamicFormResponses(id, data, meta = {}) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/form-responses`,
      { formResponses: data, ...meta },
    );
    return unwrapData(response);
  },

  // Candidate - Upload document (Step 5)
  async uploadDocument(id, type, file) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(
      `/candidate/applications/${id}/documents/${type}`,
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return unwrapData(response);
  },

  // Candidate - Update post selection (Step 7)
  async updatePostSelection(id, data) {
    const response = await apiClient.put(
      `/candidate/applications/${id}/post-selection`,
      data,
    );
    return unwrapData(response);
  },

  // Candidate - Submit application (Final step)
  async submitApplication(id, declaration) {
    const response = await apiClient.post(
      `/candidate/applications/${id}/submit`,
      { declaration },
    );
    return unwrapData(response);
  },

  // Admin - Get all applications
  async getAdminApplications(params = {}) {
    const response = await apiClient.get("/admin/applications", { params });
    return unwrapData(response);
  },

  // Admin - Get application stats
  async getAdminApplicationStats() {
    const response = await apiClient.get("/admin/applications/stats");
    return unwrapData(response);
  },

  // Get job details (including formSections for candidates)
  async getJobDetails(jobId) {
    const response = await apiClient.get(`/jobs/${jobId}`);
    return unwrapData(response);
  },
};
