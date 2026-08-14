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
  const employeeId =
    payload.employeeId || payload.employee?._id || payload.employee?.id;
  const roleId = payload.roleId || payload.role?._id || payload.role?.id;

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

  if (eventName === "realtime:connected") {
    addRoots(
      "admin-activity-logs",
      "admin-analytics-funnel",
      "admin-analytics-overview",
      "admin-analytics-top-jobs",
      "admin-application-stats",
      "admin-applications",
      "admin-cms-activity",
      "admin-cms-pages",
      "admin-dashboard",
      "admin-employee-stats",
      "admin-employees",
      "admin-job-stats",
      "admin-jobs",
      "admin-jobs-cms",
      "admin-jobs-export-list",
      "admin-jobs-for-exams",
      "admin-jobs-list",
      "admin-notifications",
      "admin-notifications-count",
      "admin-payment-analytics",
      "admin-payment-gateways",
      "admin-payment-stats",
      "admin-project-stats",
      "admin-projects",
      "admin-projects-for-job-create",
      "admin-roles",
      "admin-support-stats",
      "admin-support-tickets",
      "admin-support-tickets-kanban",
      "candidate-applications-ids",
      "departments",
      "eligible-jobs",
      "exam-centers",
      "exam-schedule-stats",
      "exam-schedules",
      "job-departments",
      "public-about-stats",
      "public-admit-cards",
      "public-apply-entry",
      "public-cms-banner",
      "public-downloads",
      "public-faq-stats",
      "public-home-projects",
      "public-home-stats",
      "public-jobs",
      "public-notices",
      "public-project",
      "public-project-applications",
      "public-projects",
      "public-results",
      "public-state-cms",
      "public-state-projects",
    );
  }

  if (
    eventName.startsWith("application:") ||
    eventName.startsWith("correction:") ||
    eventName.startsWith("document:") ||
    eventName === "admin:application:new"
  ) {
    addRoots(
      "admin-application-stats",
      "admin-applications",
      "admin-dashboard",
      "admin-jobs",
      "admin-job-stats",
      "admin-jobs-export-list",
      "candidate-dashboard",
      "candidate-applications",
      "candidate-applications-ids",
      "application-address",
      "application-additional",
      "application-documents",
      "application-dynamic-form",
      "application-education",
      "application-layout",
      "application-payment",
      "application-personal",
      "public-application-status",
      "public-apply-entry",
    );
    if (applicationId) {
      addExact(
        ["admin-application", applicationId],
        ["candidate-application-status", applicationId],
        ["application-success", applicationId],
        ["application-review", applicationId],
        ["application-post-selection", applicationId],
        ["application-address", applicationId],
        ["application-additional", applicationId],
        ["application-documents", applicationId],
        ["application-dynamic-form", applicationId],
        ["application-education", applicationId],
        ["application-layout", applicationId],
        ["application-payment", applicationId],
        ["application-personal", applicationId],
      );
    }
  }

  if (eventName.startsWith("payment:")) {
    addRoots(
      "admin-application-stats",
      "admin-applications",
      "admin-dashboard",
      "admin-payment-stats",
      "admin-payment-analytics",
      "candidate-dashboard",
      "candidate-payments",
      "candidate-applications-ids",
      "application-layout",
      "application-payment",
      "public-application-status",
      "public-apply-entry",
    );
    if (applicationId) {
      addExact(
        ["admin-application", applicationId],
        ["application-layout", applicationId],
        ["application-payment", applicationId],
        ["application-success", applicationId],
      );
    }
  }

  if (eventName.startsWith("project:")) {
    addRoots(
      "admin-dashboard",
      "admin-job-stats",
      "admin-jobs",
      "admin-jobs-cms",
      "admin-jobs-export-list",
      "admin-jobs-for-exams",
      "admin-jobs-list",
      "admin-project-stats",
      "admin-projects",
      "admin-projects-for-job-create",
      "public-project",
      "public-project-applications",
      "public-projects",
      "public-home-projects",
      "public-home-stats",
      "public-state-projects",
      "public-jobs",
      "public-downloads",
      "public-results",
      "public-notices",
      "public-about-stats",
      "public-faq-stats",
      "eligible-jobs",
    );
    if (projectId) {
      addExact(["admin-project", projectId], ["public-project", projectId]);
    }
  }

  if (eventName.startsWith("job:")) {
    addRoots(
      "admin-jobs",
      "admin-job-stats",
      "admin-jobs-cms",
      "admin-jobs-export-list",
      "admin-jobs-for-exams",
      "admin-jobs-list",
      "admin-project-stats",
      "admin-projects",
      "admin-projects-for-job-create",
      "candidate-jobs",
      "candidate-applications-ids",
      "public-jobs",
      "public-project",
      "public-projects",
      "public-home-projects",
      "public-home-stats",
      "public-state-projects",
      "public-project-applications",
      "public-apply-entry",
      "public-downloads",
      "public-results",
      "public-notices",
      "public-about-stats",
      "public-faq-stats",
      "eligible-jobs",
      "departments",
      "job-departments",
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
      "admin-cms-activity",
      "admin-cms-pages",
      "admin-jobs-cms",
      "public-cms-page",
      "public-cms-banner",
      "public-state-cms",
      "public-project",
      "public-projects",
      "public-home-projects",
      "public-state-projects",
      "public-jobs",
    );
  }

  if (eventName.startsWith("exam:")) {
    addRoots(
      "admin-dashboard",
      "exam-centers",
      "exam-rooms",
      "exam-schedules",
      "exam-schedule-stats",
      "schedule-admit-cards",
      "exam-bulk-job",
      "public-admit-cards",
      "public-jobs",
      "public-project",
      "public-home-projects",
      "public-state-projects",
      "public-projects",
      "admin-applications",
      "admin-application-stats",
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
      "admin-dashboard",
    );
    if (ticketId) {
      addExact(["candidate-ticket", ticketId], ["admin-support-ticket", ticketId]);
    }
  }

  if (eventName.startsWith("employee:") || eventName.startsWith("role:")) {
    addRoots(
      "admin-activity-logs",
      "admin-dashboard",
      "admin-employees",
      "admin-employee-stats",
      "admin-roles",
      "admin-my-profile",
      "employee-activity-logs",
    );
    if (employeeId) {
      addExact(
        ["admin-employee", employeeId],
        ["admin-activity-logs", employeeId],
      );
    }
    if (roleId) {
      addExact(["admin-role", roleId]);
    }
  }

  if (
    eventName.startsWith("dashboard:") ||
    eventName === "admin:live:count"
  ) {
    addRoots(
      "admin-analytics",
      "admin-analytics-funnel",
      "admin-analytics-overview",
      "admin-analytics-top-jobs",
      "admin-application-stats",
      "admin-applications",
      "admin-dashboard",
      "admin-employee-stats",
      "admin-employees",
      "admin-job-stats",
      "admin-jobs",
      "admin-jobs-cms",
      "admin-jobs-export-list",
      "admin-jobs-for-exams",
      "admin-jobs-list",
      "admin-notifications",
      "admin-notifications-count",
      "admin-payment-analytics",
      "admin-payment-stats",
      "admin-project-stats",
      "admin-projects",
      "admin-projects-for-job-create",
      "admin-roles",
      "admin-support-stats",
      "candidate-dashboard",
      "candidate-applications-ids",
      "exam-centers",
      "exam-schedule-stats",
      "exam-schedules",
      "job-departments",
      "public-about-stats",
      "public-apply-entry",
      "public-cms-banner",
      "public-downloads",
      "public-faq-stats",
      "public-home-stats",
      "public-jobs",
      "public-projects",
      "public-home-projects",
      "public-state-projects",
      "public-project-applications",
      "public-results",
      "public-state-cms",
      "eligible-jobs",
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
      onStatusChange: (status) => {
        if (status?.connected) {
          scheduleTargetedRefresh({ eventName: "realtime:connected" });
        }
      },
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
