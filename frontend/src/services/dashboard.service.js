import { apiClient, unwrapData } from '../api/client'

export const dashboardService = {
  async adminDashboard(params = {}) {
    const response = await apiClient.get('/dashboard/admin', { params })
    return unwrapData(response)
  },

  async candidateDashboard() {
    const response = await apiClient.get('/dashboard/candidate')
    return unwrapData(response)
  },
}
