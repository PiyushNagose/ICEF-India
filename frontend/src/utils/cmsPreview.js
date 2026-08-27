/**
 * CMS preview handoff helpers.
 *
 * The admin preview opens the public landing page in a new tab against the
 * admin-only `GET /admin/projects/:id/preview` endpoint. When the admin wants
 * to preview *unsaved* CMS edits, CmsEdit stashes its in-memory draft in
 * localStorage (survives across tabs, unlike sessionStorage) and opens the
 * preview with `?draft=1`; the preview merges the stash over the saved page.
 */

const CMS_PREVIEW_PREFIX = "cmsPreviewDraft:";
const CMS_PREVIEW_TTL = 30 * 60 * 1000; // 30 minutes

const keyFor = (projectId) => `${CMS_PREVIEW_PREFIX}${projectId}`;

/** Persist the live CMS form draft so the preview tab can render it. */
export const stashCmsPreviewDraft = (projectId, draft) => {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      keyFor(projectId),
      JSON.stringify({ draft, savedAt: Date.now() }),
    );
  } catch {
    /* ignore quota / serialization errors — preview just falls back to saved data */
  }
};

/** Read a stashed draft if it exists and has not expired; otherwise null. */
export const readCmsPreviewDraft = (projectId) => {
  if (!projectId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > CMS_PREVIEW_TTL) {
      window.localStorage.removeItem(keyFor(projectId));
      return null;
    }
    return parsed.draft || null;
  } catch {
    return null;
  }
};

/** Remove a stashed draft (called after a successful save/publish). */
export const clearCmsPreviewDraft = (projectId) => {
  if (!projectId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(projectId));
  } catch {
    /* ignore */
  }
};

/** Admin route for the public-page preview. */
export const getProjectPreviewPath = (projectId, { draft = false } = {}) =>
  `/admin/projects/${projectId}/preview${draft ? "?draft=1" : ""}`;

/** Open the preview in a new tab. */
export const openProjectPreview = (projectId, { draft = false } = {}) => {
  if (!projectId || typeof window === "undefined") return;
  window.open(
    getProjectPreviewPath(projectId, { draft }),
    "_blank",
    "noopener",
  );
};
