import { useEffect, useState } from "react";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { STORAGE_KEYS } from "../../api/config";

const getPreviewError = async (response) => {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const payload = await response.json().catch(() => null);
    return payload?.message || "This document is not available yet.";
  }
  const text = await response.text().catch(() => "");
  return text || "This document is not available yet.";
};

const DocumentPreviewFrame = ({ src, title = "Document Preview", className = "" }) => {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const checkDocument = async () => {
      if (!src) {
        setStatus("error");
        setMessage("Document link is missing.");
        return;
      }

      setStatus("loading");
      setMessage("");

      try {
        const token = localStorage.getItem(STORAGE_KEYS.accessToken);
        const response = await fetch(src, {
          method: "GET",
          credentials: "include",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!active) return;

        const contentType = response.headers.get("content-type") || "";
        if (!response.ok || contentType.includes("application/json")) {
          setStatus("error");
          setMessage(await getPreviewError(response));
          return;
        }

        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
        setMessage("Unable to load preview. Please check your session and try again.");
      }
    };

    checkDocument();

    return () => {
      active = false;
    };
  }, [src, reloadKey]);

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

  return (
    <iframe
      key={`${src}-${reloadKey}`}
      title={title}
      src={src}
      className={`h-full w-full border-0 ${className}`}
    />
  );
};

export default DocumentPreviewFrame;
