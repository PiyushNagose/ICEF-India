import axios from "axios";
import toast from "react-hot-toast";
import { API_BASE_URL, AUTH_SESSION_EVENT, STORAGE_KEYS } from "./config";

const getStoredToken = () => localStorage.getItem(STORAGE_KEYS.accessToken);
const getStoredRefreshToken = () =>
  localStorage.getItem(STORAGE_KEYS.refreshToken);
const isRequestCanceled = (error) =>
  error?.code === "ERR_CANCELED" || axios.isCancel(error);

let refreshPromise = null;
let rateLimitToastUntil = 0;

const clearSession = () => {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
};

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null");
  } catch {
    return null;
  }
};

const getInternalLoginPath = () => {
  const lastPath = localStorage.getItem(STORAGE_KEYS.internalLoginPath);
  if (lastPath) return lastPath;

  const user = getStoredUser();
  return user?.role === "admin" ||
    user?.systemRole?.roleName?.trim().toLowerCase() === "super admin" ||
    user?.roleDesignation?.trim().toLowerCase() === "super administrator" ||
    user?.fullName?.trim().toLowerCase() === "super admin" ||
    user?.employeeId?.trim().toLowerCase() === "emp-super-001"
    ? "/auth/admin-login"
    : "/auth/employee-login";
};

const redirectToLogin = () => {
  if (typeof window === "undefined") return;
  if (!window.location.pathname.startsWith("/auth")) {
    window.location.href = window.location.pathname.startsWith("/admin")
      ? getInternalLoginPath()
      : "/auth/candidate-login";
  }
};

const resolveErrorMessage = (error) =>
  error?.response?.data?.message ||
  error?.response?.data?.error ||
  (error?.code === "ECONNABORTED"
    ? "Request timed out. Please confirm backend services are running."
    : null) ||
  "Something went wrong. Please try again.";

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true, // Send cookies with requests
});

// Attach Bearer token to every request
apiClient.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url || "";
    const isAuthEndpoint = requestUrl.startsWith("/auth/");
    const isRefreshEndpoint = originalRequest?.url?.includes("/auth/refresh-token");
    const canRefreshAuthEndpoint = requestUrl === "/auth/me";
    const message = resolveErrorMessage(error);

    if (isRequestCanceled(error)) {
      return Promise.reject({
        status,
        message: "Request was canceled.",
        errors: error.response?.data?.errors || [],
        raw: error,
      });
    }

    if (
      status === 401 &&
      !originalRequest?._retry &&
      (!isAuthEndpoint || canRefreshAuthEndpoint) &&
      !isRefreshEndpoint
    ) {
      originalRequest._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(
              `${API_BASE_URL}/auth/refresh-token`,
              { refreshToken: getStoredRefreshToken() },
              { withCredentials: true },
            )
            .then((refreshResponse) => refreshResponse.data?.data || refreshResponse.data)
            .finally(() => {
              refreshPromise = null;
            });
        }

        const refreshedSession = await refreshPromise;
        const newAccessToken = refreshedSession?.accessToken;
        const newRefreshToken = refreshedSession?.refreshToken;

        if (!newAccessToken) {
          throw new Error("Refresh did not return a new access token.");
        }

        localStorage.setItem(STORAGE_KEYS.accessToken, newAccessToken);
        if (newRefreshToken) {
          localStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken);
        }
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch {
        clearSession();
        redirectToLogin();
        return Promise.reject({
          status: 401,
          message: "Session expired. Please login again.",
          errors: [],
          toastShown: true,
          raw: error,
        });
      }
    }

    if (status === 429) {
      const now = Date.now();
      if (now > rateLimitToastUntil) {
        toast.error("Too many requests. Please wait a moment and try again.");
        rateLimitToastUntil = now + 15000;
        error.__toastShown = true;
      }
    } else if (status !== 401 && status !== 404 && status !== 409) {
      toast.error(message);
      error.__toastShown = true;
    }

    return Promise.reject({
      status,
      message,
      errors: error.response?.data?.errors || [],
      toastShown: error.__toastShown === true,
      raw: error,
    });
  },
);

export const unwrapData = (response) => response?.data ?? response;
