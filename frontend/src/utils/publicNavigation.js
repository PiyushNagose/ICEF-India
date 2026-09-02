export const getPublicProjectSlug = () => {
  if (typeof window === "undefined") return "";

  const pathMatch = window.location.pathname.match(/^\/apply\/([^/]+)/);
  if (pathMatch?.[1]) return pathMatch[1];

  const querySlug = new URLSearchParams(window.location.search).get("project");
  if (querySlug) return querySlug;

  let context;
  try {
    context = JSON.parse(
      window.sessionStorage.getItem("publicApplyContext") || "{}",
    );
  } catch {
    context = {};
  }

  return (
    context?.projectSlug ||
    window.sessionStorage.getItem("lastPublicProjectSlug") ||
    ""
  );
};

export const getProjectAwarePublicPath = (path, slug = getPublicProjectSlug()) =>
  slug ? `${path}?project=${encodeURIComponent(slug)}` : path;

export const readProjectSlugFromSearch = (search = "") => {
  const params = new URLSearchParams(search);
  return params.get("project") || "";
};

export const getLastPublicProjectPath = () => {
  if (typeof window === "undefined") return "/check-status";
  const slug = getPublicProjectSlug();

  return slug ? `/apply/${slug}` : "/check-status";
};

export const getPublicJobPath = (job = {}) => {
  const slug =
    job?.projectId?.publicSlug ||
    job?.projectSlug ||
    getPublicProjectSlug();

  return slug && job?._id ? `/apply/${slug}/jobs/${job._id}` : "/check-status";
};
