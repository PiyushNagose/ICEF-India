import toast from "react-hot-toast";

const DEDUPE_WINDOW_MS = 1800;
const recentToasts = new Map();

const normalizeMessage = (message) => {
  if (typeof message === "string") return message.trim();
  if (message?.props?.children) return String(message.props.children).trim();
  return String(message ?? "").trim();
};

const shouldShowToast = (type, message) => {
  const normalized = normalizeMessage(message);
  if (!normalized) return true;

  const key = `${type}:${normalized}`;
  const now = Date.now();
  const lastShownAt = recentToasts.get(key) || 0;
  if (now - lastShownAt < DEDUPE_WINDOW_MS) return false;

  recentToasts.set(key, now);
  for (const [toastKey, timestamp] of recentToasts.entries()) {
    if (now - timestamp > DEDUPE_WINDOW_MS * 3) recentToasts.delete(toastKey);
  }
  return true;
};

export const installGlobalToastDedupe = () => {
  if (toast.__dedupeInstalled) return;

  const originalError = toast.error.bind(toast);
  const originalSuccess = toast.success.bind(toast);
  const originalLoading = toast.loading.bind(toast);

  toast.error = (message, options = {}) => {
    if (options.id || shouldShowToast("error", message)) {
      return originalError(message, options);
    }
    return undefined;
  };

  toast.success = (message, options = {}) => {
    if (options.id || shouldShowToast("success", message)) {
      return originalSuccess(message, options);
    }
    return undefined;
  };

  toast.loading = (message, options = {}) => {
    if (options.id || shouldShowToast("loading", message)) {
      return originalLoading(message, options);
    }
    return undefined;
  };

  toast.__dedupeInstalled = true;
};
