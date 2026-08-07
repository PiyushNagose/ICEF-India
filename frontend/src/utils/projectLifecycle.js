const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfDay = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

export const getProjectLifecycleStatus = (project) => {
  if (!project) return "Upcoming";
  if (project.status === "Cancelled") return "Cancelled";

  const today = startOfDay(new Date());
  const start = startOfDay(project.startDate);
  const end = startOfDay(project.closureDate || project.endDate);

  if (start && today < start) return "Upcoming";
  if (end && today > end) return "Completed";
  if (start && (!end || today <= end)) return "Active";

  return project.status || "Upcoming";
};

export const getProjectStatusBadgeClass = (status) => {
  if (status === "Active") return "bg-green-100 text-green-700";
  if (status === "Completed") return "bg-blue-100 text-blue-700";
  if (status === "Cancelled") return "bg-red-100 text-red-700";
  return "bg-orange-100 text-orange-700";
};
