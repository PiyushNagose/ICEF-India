import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createRealtimeSockets,
  getRealtimeSocketUrls,
  getRealtimeToken,
} from "./socketClient";

const INVALIDATION_DELAY_MS = 500;
const TOKEN_CHECK_INTERVAL_MS = 1000;

const invalidateForRealtimeEvent = (queryClient, eventName, payload = {}) => {
  const applicationId =
    payload.applicationId ||
    payload.application?._id ||
    payload.application?.id ||
    payload.id;
  const jobId = payload.jobId || payload.job?._id || payload.job?.id;
  const projectId =
    payload.projectId || payload.project?._id || payload.project?.id;
  const scheduleId =
    payload.scheduleId ||
    payload.examScheduleId ||
    payload.schedule?._id ||
    payload.schedule?.id;
  const ticketId = payload.ticketId || payload.ticket?._id || payload.ticket?.id;

  const roots = new Set();
  const exactKeys = [];

  const addRoots = (...keys) => {
    keys.filter(Boolean).forEach((key) => roots.add(key));
  };

  const addExact = (...keys) => {
    keys.filter(Boolean).forEach((key) => exactKeys.push(key));
  };

  if (!eventName || eventName === "application:autosaved") return;

  if (eventName === "notification:new") {
    addRoots(
      "candidate-notifications-count",
      "candidate-notifications",
      "admin-notifications-count",
      "admin-notifications",
    );
  }

  if (
    eventName.startsWith("application:") ||
    eventName.startsWith("correction:") ||
    eventName.startsWith("document:") ||
    eventName === "admin:application:new"
  ) {
    addRoots(
      "admin-applications",
      "candidate-dashboard",
      "candidate-applications",
      "public-application-status",
    );
    if (applicationId) {
      addExact(
        ["admin-application", applicationId],
        ["candidate-application-status", applicationId],
        ["application-success", applicationId],
        ["application-review", applicationId],
        ["application-post-selection", applicationId],
      );
    }
  }

  if (eventName.startsWith("payment:")) {
    addRoots(
      "admin-applications",
      "admin-payment-stats",
      "candidate-dashboard",
      "candidate-payments",
    );
    if (applicationId) {
      addExact(
        ["admin-application", applicationId],
        ["application-success", applicationId],
      );
    }
  }

  if (eventName.startsWith("project:")) {
    addRoots("admin-projects", "public-projects", "public-jobs");
    if (projectId) {
      addExact(["admin-project", projectId], ["public-project", projectId]);
    }
  }

  if (eventName.startsWith("job:")) {
    addRoots(
      "admin-jobs",
      "candidate-jobs",
      "public-jobs",
      "public-projects",
    );
    if (jobId) {
      addExact(["admin-job", jobId], ["public-job", jobId], ["job-details-review", jobId]);
    }
    if (projectId) {
      addExact(["admin-project", projectId], ["public-project", projectId]);
    }
  }

  if (eventName.startsWith("cms:")) {
    addRoots(
      "admin-cms-page",
      "admin-cms-pages",
      "public-cms-page",
      "public-projects",
      "public-jobs",
    );
  }

  if (eventName.startsWith("exam:")) {
    addRoots(
      "exam-centers",
      "exam-rooms",
      "exam-schedules",
      "exam-schedule-stats",
      "public-admit-cards",
      "public-jobs",
      "admin-applications",
    );
    if (scheduleId) {
      addExact(
        ["exam-schedule", scheduleId],
        ["exam-schedule-stats", scheduleId],
        ["exam-allocations", scheduleId],
        ["schedule-admit-cards", scheduleId],
        ["bulk-exam-jobs", scheduleId],
      );
    }
    if (applicationId) {
      addExact(["admin-application", applicationId]);
    }
  }

  if (eventName.startsWith("support:")) {
    addRoots(
      "candidate-tickets",
      "admin-support-tickets",
      "admin-support-tickets-kanban",
      "admin-support-stats",
    );
    if (ticketId) {
      addExact(["candidate-ticket", ticketId], ["admin-support-ticket", ticketId]);
    }
  }

  if (
    eventName.startsWith("dashboard:") ||
    eventName === "admin:live:count"
  ) {
    addRoots(
      "admin-analytics",
      "admin-applications",
      "admin-dashboard",
      "admin-employees",
      "admin-jobs",
      "admin-projects",
      "admin-roles",
      "candidate-dashboard",
      "exam-schedules",
      "public-jobs",
      "public-projects",
    );
  }

  if (roots.size > 0) {
    queryClient.invalidateQueries({
      predicate: (query) => roots.has(query.queryKey?.[0]),
      refetchType: "active",
    });
  }

  exactKeys.forEach((queryKey) => {
    queryClient.invalidateQueries({ queryKey, refetchType: "active" });
  });
};

const useRealtimeTokenVersion = () => {
  const [token, setToken] = useState(() => getRealtimeToken());

  useEffect(() => {
    const syncToken = () => {
      const latestToken = getRealtimeToken();
      setToken((currentToken) =>
        currentToken === latestToken ? currentToken : latestToken,
      );
    };

    const intervalId = window.setInterval(
      syncToken,
      TOKEN_CHECK_INTERVAL_MS,
    );

    window.addEventListener("storage", syncToken);
    window.addEventListener("focus", syncToken);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("storage", syncToken);
      window.removeEventListener("focus", syncToken);
    };
  }, []);

  return token || "anonymous";
};

const RealtimeProvider = ({ children }) => {
  const queryClient = useQueryClient();
  const tokenVersion = useRealtimeTokenVersion();
  const invalidateTimerRef = useRef(null);
  const pendingEventsRef = useRef([]);

  useEffect(() => {
    if (getRealtimeSocketUrls().length === 0) return undefined;

    const scheduleTargetedRefresh = (event) => {
      pendingEventsRef.current.push(event);

      if (invalidateTimerRef.current) {
        window.clearTimeout(invalidateTimerRef.current);
      }

      invalidateTimerRef.current = window.setTimeout(() => {
        const pendingEvents = pendingEventsRef.current;
        pendingEventsRef.current = [];
        pendingEvents.forEach((pendingEvent) => {
          invalidateForRealtimeEvent(
            queryClient,
            pendingEvent?.eventName,
            pendingEvent?.payload,
          );
        });
        invalidateTimerRef.current = null;
      }, INVALIDATION_DELAY_MS);
    };

    const cleanupSockets = createRealtimeSockets({
      onEvent: scheduleTargetedRefresh,
      onStatusChange: () => {},
    });

    return () => {
      if (invalidateTimerRef.current) {
        window.clearTimeout(invalidateTimerRef.current);
        invalidateTimerRef.current = null;
      }
      pendingEventsRef.current = [];
      cleanupSockets();
    };
  }, [queryClient, tokenVersion]);

  return children;
};

export default RealtimeProvider;
