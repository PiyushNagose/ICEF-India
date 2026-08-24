/* global process */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite dev proxy — routes API calls directly to each microservice.
// This avoids CORS (same-origin from browser's perspective) and bypasses
// the API Gateway's path-stripping proxy issue entirely.
const IDENTITY_URL      = process.env.VITE_IDENTITY_URL      || 'http://localhost:5001'
const RECRUITMENT_URL   = process.env.VITE_RECRUITMENT_URL   || 'http://localhost:5002'
const COMMUNICATION_URL = process.env.VITE_COMMUNICATION_URL || 'http://localhost:5003'
const GATEWAY_URL       = process.env.VITE_GATEWAY_URL       || 'http://localhost:5000'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['recharts', 'react-is'],
    force: true,
  },
  build: {
    commonjsOptions: {
      include: [/recharts/, /node_modules/],
    },
  },
  server: {
    proxy: {
      // ── Identity Service ──────────────────────────────────
      '/api/auth': {
        target: IDENTITY_URL,
        changeOrigin: true,
      },
      '/api/admin/employees': {
        target: IDENTITY_URL,
        changeOrigin: true,
      },
      '/api/admin/roles': {
        target: IDENTITY_URL,
        changeOrigin: true,
      },
      '/api/admin/activity-logs': {
        target: IDENTITY_URL,
        changeOrigin: true,
      },
      '/api/admin/notifications': {
        target: IDENTITY_URL,
        changeOrigin: true,
      },

      // ── Recruitment Service ───────────────────────────────
      '/api/jobs': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/cms': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/projects': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/jobs': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/applications': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/analytics': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/cms': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/admin/exams': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/candidate/applications': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },
      '/api/candidate/admit-cards': {
        target: RECRUITMENT_URL,
        changeOrigin: true,
      },

      // ── Communication & Payment Service ───────────────────
      '/api/admin/payments': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/admin/payment-gateways': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/admin/support': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/candidate/notifications': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/candidate/support': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },
      '/api/candidate/payments': {
        target: COMMUNICATION_URL,
        changeOrigin: true,
      },

      // â”€â”€ API Gateway dashboards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      '/api/dashboard': {
        target: GATEWAY_URL,
        changeOrigin: true,
      },
    },
  },
})
