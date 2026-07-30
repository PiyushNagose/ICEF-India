import { useState, useEffect } from "react";
import { authService, clearStoredSession, getStoredUser } from "../services/auth.service";
import { AUTH_SESSION_EVENT, STORAGE_KEYS } from "../api/config";

/**
 * Helper functions to check user roles
 */
export const isAdminUser = (user) => {
  return (
    user?.role === "admin" ||
    user?.role === "employee" ||
    user?.employeeId ||
    user?.officialEmail
  );
};

export const isCandidateUser = (user) => {
  return user?.role === "candidate" && !user?.employeeId;
};

export const getDashboardPath = (user) => {
  if (isAdminUser(user)) return "/admin/dashboard";
  if (isCandidateUser(user)) return "/candidate/dashboard";
  return "/auth/candidate-login";
};

/**
 * Custom hook for authentication state management
 * Simple and fast - just reads from localStorage
 */
export const useAuth = () => {
  const [user, setUser] = useState(() => getStoredUser());
  const [token, setToken] = useState(() =>
    localStorage.getItem(STORAGE_KEYS.accessToken),
  );
  const [isLoading, setIsLoading] = useState(() =>
    Boolean(localStorage.getItem(STORAGE_KEYS.accessToken)),
  );
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    return !!(storedUser && storedToken);
  });

  const updateAuth = () => {
    const storedUser = getStoredUser();
    const storedToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    setUser(storedUser);
    setToken(storedToken);
    setIsAuthenticated(!!(storedUser && storedToken));
  };

  useEffect(() => {
    let mounted = true;

    const syncAuth = () => {
      if (!mounted) return;
      updateAuth();
    };

    const verifySession = async () => {
      const storedToken = localStorage.getItem(STORAGE_KEYS.accessToken);
      const storedRefreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);

      if (!storedToken && !storedRefreshToken) {
        if (mounted) setIsLoading(false);
        return;
      }

      try {
        const freshUser = await authService.me();
        if (!freshUser) clearStoredSession();
      } catch {
        clearStoredSession();
      } finally {
        if (mounted) {
          updateAuth();
          setIsLoading(false);
        }
      }
    };

    window.addEventListener("storage", syncAuth);
    window.addEventListener(AUTH_SESSION_EVENT, syncAuth);
    verifySession();

    return () => {
      mounted = false;
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener(AUTH_SESSION_EVENT, syncAuth);
    };
  }, []);

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    updateAuth,
  };
};
