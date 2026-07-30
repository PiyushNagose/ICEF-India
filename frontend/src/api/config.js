const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!envApiBaseUrl && import.meta.env.PROD) {
  throw new Error("VITE_API_BASE_URL is required for production builds.");
}

// All API calls go through the gateway. In development this defaults to /api so
// Vite can proxy requests without extra CORS setup.
export const API_BASE_URL = envApiBaseUrl || "/api";

// Webhook base URL — used for displaying webhook URLs in admin panel
// Defaults to current origin if not specified in environment
export const WEBHOOK_BASE_URL =
  import.meta.env.VITE_WEBHOOK_BASE_URL || `${window.location.origin}`;

const splitUrls = (value) =>
  value
    ?.split(",")
    .map((url) => url.trim())
    .filter(Boolean) || [];

export const REALTIME_SOCKET_URLS = splitUrls(
  import.meta.env.VITE_REALTIME_SOCKET_URLS,
);

export const REALTIME_ENABLED =
  import.meta.env.VITE_REALTIME_ENABLED === "true" ||
  (!import.meta.env.PROD && import.meta.env.VITE_REALTIME_ENABLED !== "false");

const gatewaySocketBase =
  import.meta.env.VITE_GATEWAY_SOCKET_URL ||
  import.meta.env.VITE_GATEWAY_URL ||
  "http://localhost:5000";

export const SERVICE_SOCKET_URLS = {
  identity:
    import.meta.env.VITE_IDENTITY_SOCKET_URL ||
    `${gatewaySocketBase}/realtime/identity`,
  recruitment:
    import.meta.env.VITE_RECRUITMENT_SOCKET_URL ||
    `${gatewaySocketBase}/realtime/recruitment`,
  communication:
    import.meta.env.VITE_COMMUNICATION_SOCKET_URL ||
    `${gatewaySocketBase}/realtime/communication`,
};

export const STORAGE_KEYS = {
  accessToken: "rp_access_token",
  refreshToken: "rp_refresh_token",
  user: "rp_user",
};

export const AUTH_SESSION_EVENT = "rp:auth-session-changed";
