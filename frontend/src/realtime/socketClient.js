import { io } from "socket.io-client";
import {
  REALTIME_ENABLED,
  REALTIME_SOCKET_URLS,
  SERVICE_SOCKET_URLS,
  STORAGE_KEYS,
} from "../api/config";

const SOCKET_EVENTS = [
  "dashboard:stats:update",
  "dashboard:funnel:update",
  "application:submitted",
  "application:status:changed",
  "application:autosaved",
  "application:updated",
  "admin:application:new",
  "document:verified",
  "document:rejected",
  "payment:success",
  "payment:failed",
  "project:created",
  "project:updated",
  "project:deleted",
  "job:created",
  "job:updated",
  "job:published",
  "job:closed",
  "cms:created",
  "cms:updated",
  "cms:deleted",
  "support:ticket:created",
  "support:ticket:reply",
  "support:ticket:resolved",
  "correction:requested",
  "correction:submitted",
  "correction:reviewed",
  "exam:center:changed",
  "exam:room:changed",
  "exam:schedule:created",
  "exam:schedule:updated",
  "exam:allocation:changed",
  "exam:admit-card:generated",
  "exam:admit-card:published",
  "exam:admit-card:unpublished",
  "exam:bulk-job:updated",
  "notification:new",
  "admin:live:count",
];

const uniqueUrls = (urls) => [...new Set(urls.filter(Boolean))];
const REALTIME_EVENT_PREFIXES = [
  "admin:",
  "application:",
  "cms:",
  "correction:",
  "dashboard:",
  "document:",
  "exam:",
  "job:",
  "notification:",
  "payment:",
  "project:",
  "support:",
];
const TEARDOWN_GRACE_MS = 2000;

let activeSockets = [];
let activeToken = null;
let activeSubscribers = new Set();
let teardownTimer = null;
let subscriberCount = 0;

export const getRealtimeToken = () =>
  localStorage.getItem(STORAGE_KEYS.accessToken);

export const getRealtimeSocketUrls = () => {
  if (!REALTIME_ENABLED) {
    return [];
  }

  if (REALTIME_SOCKET_URLS.length > 0) {
    return REALTIME_SOCKET_URLS;
  }

  return uniqueUrls(Object.values(SERVICE_SOCKET_URLS));
};

const disconnectActiveSockets = () => {
  activeSockets.forEach((socket) => {
    socket.offAny();
    socket.disconnect();
  });
  activeSockets = [];
};

const isRealtimeDomainEvent = (eventName) =>
  SOCKET_EVENTS.includes(eventName) ||
  REALTIME_EVENT_PREFIXES.some((prefix) => eventName?.startsWith(prefix));

const getSocketEndpoint = (url) => {
  try {
    const parsedUrl = new URL(url);
    const pathPrefix = parsedUrl.pathname.replace(/\/$/, "");

    if (!pathPrefix) {
      return { origin: parsedUrl.origin };
    }

    parsedUrl.pathname = "/";
    parsedUrl.search = "";
    parsedUrl.hash = "";

    return {
      origin: parsedUrl.origin,
      path: `${pathPrefix}/socket.io`,
    };
  } catch {
    return { origin: url };
  }
};

const createSocketConnections = (token) => {
  activeToken = token;

  activeSockets = getRealtimeSocketUrls().map((url) => {
    const endpoint = getSocketEndpoint(url);
    const socket = io(endpoint.origin, {
      auth: token ? { token } : {},
      path: endpoint.path,
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      autoConnect: true,
    });

    socket.on("connect", () => {
      activeSubscribers.forEach((subscriber) => {
        subscriber.onStatusChange?.({
          url,
          connected: true,
          socketId: socket.id,
        });
      });
    });

    socket.on("disconnect", (reason) => {
      activeSubscribers.forEach((subscriber) => {
        subscriber.onStatusChange?.({ url, connected: false, reason });
      });
    });

    socket.on("connect_error", (error) => {
      activeSubscribers.forEach((subscriber) => {
        subscriber.onStatusChange?.({
          url,
          connected: false,
          reason: error.message,
        });
      });
    });

    socket.onAny((eventName, payload) => {
      if (!isRealtimeDomainEvent(eventName)) return;

      activeSubscribers.forEach((subscriber) => {
        subscriber.onEvent?.({ eventName, payload, source: url });
      });
    });

    return socket;
  });
};

export const createRealtimeSockets = ({ onEvent, onStatusChange }) => {
  const token = getRealtimeToken();
  const subscriber = { onEvent, onStatusChange };

  if (teardownTimer) {
    window.clearTimeout(teardownTimer);
    teardownTimer = null;
  }

  activeSubscribers.add(subscriber);
  subscriberCount += 1;

  if (activeSockets.length === 0 || activeToken !== token) {
    disconnectActiveSockets();
    createSocketConnections(token);
  }

  return () => {
    activeSubscribers.delete(subscriber);
    subscriberCount = Math.max(0, subscriberCount - 1);

    teardownTimer = window.setTimeout(() => {
      if (subscriberCount === 0) {
        disconnectActiveSockets();
        activeToken = null;
      }
      teardownTimer = null;
    }, TEARDOWN_GRACE_MS);
  };
};
