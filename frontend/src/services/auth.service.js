import { apiClient, unwrapData } from "../api/client";
import { AUTH_SESSION_EVENT, STORAGE_KEYS } from "../api/config";

// Normalise the user object so it always has a `role` field.
// The Employee model has no role field — we infer it from employeeId / officialEmail.
const normaliseUser = (user) => {
  if (!user) return user;
  if (user.role) return user;
  if (user.employeeId || user.officialEmail)
    return { ...user, role: "employee" };
  return user;
};

export const notifyAuthSessionChanged = () => {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT));
  }
};

export const clearStoredSession = () => {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.user);
  notifyAuthSessionChanged();
};

const saveSession = ({ user, accessToken, refreshToken }, options = {}) => {
  if (accessToken) localStorage.setItem(STORAGE_KEYS.accessToken, accessToken);
  if (refreshToken)
    localStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  if (options.internalLoginPath) {
    localStorage.setItem(STORAGE_KEYS.internalLoginPath, options.internalLoginPath);
  }
  const normalisedUser = normaliseUser(user);
  if (normalisedUser)
    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(normalisedUser));
  notifyAuthSessionChanged();
  return { user: normalisedUser, accessToken, refreshToken };
};

export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.user) || "null");
  } catch {
    return null;
  }
};

export const getLastInternalLoginPath = (fallback = "/auth/employee-login") =>
  localStorage.getItem(STORAGE_KEYS.internalLoginPath) || fallback;

export const authService = {
  async adminLogin(payload) {
    const response = await apiClient.post("/auth/admin/login", payload);
    return saveSession(unwrapData(response), {
      internalLoginPath: "/auth/admin-login",
    });
  },

  async employeeLogin(payload) {
    const response = await apiClient.post("/auth/employee/login", payload);
    return saveSession(unwrapData(response), {
      internalLoginPath: "/auth/employee-login",
    });
  },

  async candidateLogin(payload) {
    const response = await apiClient.post("/auth/login", payload);
    return saveSession(unwrapData(response));
  },

  async register(payload) {
    const response = await apiClient.post("/auth/register", payload);
    return unwrapData(response);
  },

  async verifyOtp(payload) {
    const response = await apiClient.post("/auth/verify-otp", payload);
    return saveSession(unwrapData(response));
  },

  async resendOtp(email) {
    const response = await apiClient.post("/auth/resend-otp", { email });
    return unwrapData(response);
  },

  async me() {
    const response = await apiClient.get("/auth/me");
    const data = unwrapData(response);
    const user = normaliseUser(data?.user);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      notifyAuthSessionChanged();
    }
    return user;
  },

  async refreshSession() {
    try {
      const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
      if (!refreshToken) return null;

      const response = await apiClient.post("/auth/refresh-token", {
        refreshToken,
      });
      const data = unwrapData(response);

      if (data.accessToken) {
        localStorage.setItem(STORAGE_KEYS.accessToken, data.accessToken);
        if (data.refreshToken) {
          localStorage.setItem(STORAGE_KEYS.refreshToken, data.refreshToken);
        }

        // Fetch user data after refresh
        const user = await this.me();
        return user;
      }
      return null;
    } catch (error) {
      // Refresh failed - clear session
      clearStoredSession();
      return null;
    }
  },

  async logout() {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      clearStoredSession();
    }
  },

  async forgotPassword(payload) {
    const body =
      typeof payload === "string" ? { email: payload, accountType: "candidate" } : payload;
    const response = await apiClient.post("/auth/forgot-password", body);
    return unwrapData(response);
  },

  async resetPassword(payload) {
    const response = await apiClient.post("/auth/reset-password", payload);
    return unwrapData(response);
  },

  async updateProfile(data) {
    const response = await apiClient.put("/auth/profile", data);
    const result = unwrapData(response);
    // Update stored user with fresh data
    const user = normaliseUser(result?.user);
    if (user) {
      localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
      notifyAuthSessionChanged();
    }
    return user;
  },

  async changePassword(data) {
    const response = await apiClient.put("/auth/change-password", data);
    return unwrapData(response);
  },
};
