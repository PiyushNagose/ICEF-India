import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { AlertCircle, ExternalLink, FileText, Loader2, RefreshCw } from "lucide-react";
import { API_BASE_URL, STORAGE_KEYS } from "../../api/config";

const getPreviewError = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return payload?.message || "This document is not available yet.";
  }
  const text = await response.text().catch(() => "");
  return text || "This document is not available yet.";
};

const isImageSource = (src = "") =>
  /\.(png|jpe?g|webp|gif|bmp|svg)(\?|#|$)/i.test(src);

const isPdfSource = (src = "") => /\.pdf(\?|#|$)/i.test(src);

const isExternalSource = (src = "") => {
  try {
    return new URL(src, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
};

const resolvePreviewSource = (src = "") => {
  if (!src) return "";
  if (/^https?:\/\//i.test(src) || src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }
  if (src.startsWith("/api/")) {
    return `${API_BASE_URL.replace(/\/+$/, "")}${src.slice(4)}`;
  }
  return src;
};

const DocumentPreviewFrame = ({
  src,
  title = "Document Preview",
  className = "",
  notifyOnError = false,
}) => {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewMime, setPreviewMime] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    const resolvedSrc = resolvePreviewSource(src);

    const checkDocument = async () => {
      if (!resolvedSrc) {
        setStatus("error");
        setMessage("Document link is missing.");
        return;
      }

      setStatus("loading");
      setMessage("");
      setPreviewUrl("");
      setPreviewMime("");

      if (isExternalSource(resolvedSrc) && !resolvedSrc.includes("/api/")) {
        setPreviewUrl(resolvedSrc);
        setStatus("ready");
        return;
      }

      try {
        const token = localStorage.getItem(STORAGE_KEYS.accessToken);
        const response = await fetch(resolvedSrc, {
          method: "GET",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!active) return;

        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || contentType.includes("application/json")) {
          const errorMessage = await getPreviewError(response);
          setStatus("error");
          setMessage(errorMessage);
          if (notifyOnError) toast.error(errorMessage);
          return;
        }

        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        if (!active) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setPreviewUrl(objectUrl);
        setPreviewMime(contentType);
        setStatus("ready");
      } catch {
        if (!active) return;
        const errorMessage = "Unable to load preview. Please check your session and try again.";
        setStatus("error");
        setMessage(errorMessage);
        if (notifyOnError) toast.error(errorMessage);
      }
    };

    checkDocument();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, reloadKey, notifyOnError]);

  if (status === "loading") {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-white ${className}`}>
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <p className="text-sm font-semibold text-slate-700">Loading preview...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={`flex h-full w-full items-center justify-center bg-white p-6 ${className}`}>
        <div className="max-w-md rounded-2xl border border-orange-100 bg-orange-50 px-6 py-7 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Preview not available</h3>
          <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
          >
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const displayUrl = previewUrl || resolvePreviewSource(src);
  const sourceSignature = `${displayUrl || ""} ${src || ""} ${title || ""}`;

  if (isImageSource(sourceSignature)) {
    return (
      <div className={`flex h-full w-full items-center justify-center overflow-auto bg-slate-100 p-4 ${className}`}>
        <img
          key={`${displayUrl}-${reloadKey}`}
          src={displayUrl}
          alt={title}
          className="max-h-full max-w-full bg-white object-contain shadow-xl ring-1 ring-slate-200"
        />
      </div>
    );
  }

  if (isPdfSource(sourceSignature) || previewMime.includes("application/pdf") || previewMime.includes("text/html")) {
    return (
      <iframe
        key={`${displayUrl}-${reloadKey}`}
        title={title}
        src={displayUrl}
        className={`h-full w-full border-0 bg-white ${className}`}
      />
    );
  }

  return (
    <div className={`flex h-full w-full items-center justify-center bg-white p-6 ${className}`}>
      <div className="max-w-md rounded-2xl border border-orange-100 bg-orange-50 px-6 py-7 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-white text-orange-600 shadow-sm">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">Preview not supported</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This file type cannot be displayed inside the browser preview. Open it
          in a new tab to view or download it.
        </p>
        <a
          href={displayUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700"
        >
          <ExternalLink className="h-4 w-4" />
          Open Document
        </a>
      </div>
    </div>
  );
};

export default DocumentPreviewFrame;
