import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Loader2,
  CheckCircle,
  Upload,
  Eye,
  RefreshCw,
  FileCheck2,
  X,
  ExternalLink,
} from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { candidateService } from "../../services/candidate.service";
import {
  buildApplicationSteps,
  getJobDocumentRequirements,
} from "../../utils/applicationFlow";
import DocumentPreviewFrame from "../../components/common/DocumentPreviewFrame";

const APP_KEY = "app_draft";
const getAppId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
  } catch {
    return null;
  }
};

const slugify = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const acceptFromFormats = (formats = []) => {
  const map = {
    PDF: "application/pdf",
    JPG: "image/jpeg",
    JPEG: "image/jpeg",
    PNG: "image/png",
    DOC: "application/msword",
    DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const accept = formats.map((format) => map[String(format).toUpperCase()]).filter(Boolean);
  return accept.length ? accept.join(",") : "application/pdf,image/jpeg,image/png";
};

const Documents = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRefs = useRef({});

  useEffect(() => {
    const stateId = location.state?.applicationId;
    if (stateId) {
      const existing = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
      sessionStorage.setItem(
        APP_KEY,
        JSON.stringify({ ...existing, applicationId: stateId }),
      );
    }
  }, [location.state]);

  const applicationId = getAppId();
  const [uploading, setUploading] = useState({}); // { docId: true/false }
  const [uploadedDocs, setUploadedDocs] = useState({}); // { docId: { url, name } }
  const [previewDoc, setPreviewDoc] = useState(null);

  // Load existing uploaded documents
  const {
    data: appData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["application-documents", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 2 * 60 * 1000,
  });

  const app = appData?.application || appData;
  const job = app?.jobId;
  const adminDocuments = getJobDocumentRequirements(job);
  const docTypes = adminDocuments.map((doc) => ({
    id: slugify(doc.name),
    name: doc.name,
    description:
      doc.description ||
      `${(doc.formats || []).join(", ") || "PDF/JPG/PNG"} accepted`,
    required: doc.required !== false,
    accept: acceptFromFormats(doc.formats),
    maxKB: doc.maxSizeKB || 500,
  }));
  const steps = buildApplicationSteps(job, app);
  const currentStep = steps.find((step) => step.type === "documents")?.id || 1;
  const previousStep = steps.find((step) => step.id === currentStep - 1);
  const nextStep = steps.find((step) => step.id === currentStep + 1);

  useEffect(() => {
    if (appData) {
      const docs = app?.documents || [];
      const map = {};
      docs.forEach((doc) => {
        if (doc.status === "uploaded") {
          map[doc.type] = {
            url: doc.cloudinaryUrl,
            name: doc.originalName,
            sizeKB: doc.sizeKB,
          };
        }
      });
      setUploadedDocs(map);
    }
  }, [appData]);

  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    const docConfig = docTypes.find((d) => d.id === docType);
    if (!docConfig) return;

    // Validate size
    const sizeKB = file.size / 1024;
    if (sizeKB > docConfig.maxKB) {
      toast.error(
        `File too large. Max size is ${docConfig.maxKB}KB. Your file is ${Math.round(sizeKB)}KB.`,
      );
      return;
    }

    setUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      await candidateService.uploadDocument(applicationId, docType, file);
      toast.success(`${docConfig.name} uploaded successfully`);
      // Refresh to get updated doc list
      const result = await refetch();
      const app = result.data?.application || result.data;
      const docs = app?.documents || [];
      const map = { ...uploadedDocs };
      docs.forEach((doc) => {
        if (doc.status === "uploaded") {
          map[doc.type] = {
            url: doc.cloudinaryUrl,
            name: doc.originalName,
            sizeKB: doc.sizeKB,
          };
        }
      });
      setUploadedDocs(map);
    } catch (err) {
      if (!err?.raw?.__toastShown) {
        toast.error(err.message || `Failed to upload ${docConfig.name}`);
      }
    } finally {
      setUploading((prev) => ({ ...prev, [docType]: false }));
      // Reset file input
      if (fileInputRefs.current[docType]) {
        fileInputRefs.current[docType].value = "";
      }
    }
  };

  const handleNext = () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate("/jobs");
      return;
    }
    // Check required docs
    const missingRequired = docTypes.filter(
      (d) => d.required && !uploadedDocs[d.id],
    );
    if (missingRequired.length > 0) {
      toast.error(
        `Please upload required documents: ${missingRequired.map((d) => d.name).join(", ")}`,
      );
      return;
    }
    // If editing from Review, go back to Review
    if (location.state?.returnToReview) {
      navigate("/application/review", { state: { applicationId } });
    } else {
      navigate(nextStep?.path || "/application/review", { state: { applicationId } });
    }
  };

  const uploadedCount = Object.keys(uploadedDocs).length;
  const requiredCount = docTypes.filter((d) => d.required).length;
  const uploadedRequiredCount = docTypes.filter(
    (d) => d.required && uploadedDocs[d.id],
  ).length;

  return (
    <ApplicationLayout currentStep={currentStep} title="Document Upload">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Document Upload
                </h2>
                <p className="text-gray-600">
                  Upload the documents configured for this job.
                </p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-700">
                  {uploadedRequiredCount}/{requiredCount} required uploaded
                </div>
                <div className="text-xs text-gray-500">
                  {uploadedCount} total uploaded
                </div>
              </div>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${requiredCount > 0 ? (uploadedRequiredCount / requiredCount) * 100 : 0}%`,
                }}
              />
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Loading uploaded documents...</span>
              </div>
            )}

            {!isLoading && docTypes.length === 0 && (
              <div className="rounded-xl border border-dashed border-green-300 bg-green-50 p-6 text-center">
                <FileCheck2 className="mx-auto mb-3 h-10 w-10 text-green-600" />
                <h3 className="font-semibold text-green-900">
                  No documents required for this job
                </h3>
                <p className="mt-1 text-sm text-green-700">
                  The administrator has not added document uploads for this
                  recruitment. You can continue to the next step.
                </p>
              </div>
            )}

            {docTypes.map((doc) => {
              const isUploaded = Boolean(uploadedDocs[doc.id]);
              const isUploadingNow = uploading[doc.id];
              const uploadedInfo = uploadedDocs[doc.id];

              return (
                <div
                  key={doc.id}
                  className={`grid grid-cols-1 gap-4 p-4 border rounded-lg transition-colors md:grid-cols-[1fr_220px] md:items-center ${
                    isUploaded
                      ? "border-green-200 bg-green-50"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex min-w-0 items-center space-x-4">
                    {/* Status Icon */}
                    <div
                      className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isUploaded
                          ? "bg-green-100"
                          : isUploadingNow
                            ? "bg-yellow-100"
                            : "bg-gray-100"
                      }`}
                    >
                      {isUploaded ? (
                        <CheckCircle className="w-6 h-6 text-green-600" />
                      ) : isUploadingNow ? (
                        <Loader2 className="w-6 h-6 text-yellow-600 animate-spin" />
                      ) : (
                        <Upload className="w-6 h-6 text-gray-400" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-gray-800">
                          {doc.name}
                        </h4>
                        {doc.required && (
                          <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{doc.description}</p>
                      {isUploaded && uploadedInfo && (
                        <p className="text-xs text-green-600 mt-0.5">
                          ✓ {uploadedInfo.name} ({uploadedInfo.sizeKB}KB)
                        </p>
                      )}
                      {isUploadingNow && (
                        <p className="text-xs text-yellow-600 mt-0.5">
                          Uploading...
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-start gap-2 md:justify-end">
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept={doc.accept}
                      ref={(el) => (fileInputRefs.current[doc.id] = el)}
                      onChange={(e) =>
                        handleFileSelect(doc.id, e.target.files[0])
                      }
                      className="hidden"
                    />

                    {isUploaded && uploadedInfo?.url && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-11 min-w-[96px] justify-center text-blue-600 border-blue-200 hover:bg-blue-50"
                        onClick={() => {
                          const url = uploadedInfo.url;
                          if (url) {
                            setPreviewDoc({
                              url: `/api/candidate/applications/${applicationId}/documents/${doc.id}/preview`,
                              originalUrl: url,
                              title: doc.name,
                              name: uploadedInfo.name,
                            });
                          } else {
                            toast.error("File URL not available");
                          }
                        }}
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        View
                      </Button>
                    )}

                    <Button
                      size="sm"
                      disabled={isUploadingNow}
                      className={`h-11 min-w-[132px] justify-center ${
                        isUploaded
                          ? "bg-gray-600 hover:bg-gray-700 text-white"
                          : "bg-orange-600 hover:bg-orange-700 text-white"
                      }`}
                      onClick={() => fileInputRefs.current[doc.id]?.click()}
                    >
                      {isUploadingNow ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Uploading
                        </>
                      ) : isUploaded ? (
                        <>
                          <RefreshCw className="w-3 h-3 mr-1" />
                          Replace
                        </>
                      ) : (
                        <>
                          <Upload className="w-3 h-3 mr-1" />
                          Select File
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Important Note */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mt-4">
              <div className="flex items-start space-x-3">
                <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-orange-600 text-xs font-bold">!</span>
                </div>
                <div>
                  <h4 className="font-medium text-orange-800 mb-1">
                    Important Note
                  </h4>
                  <p className="text-sm text-orange-700">
                    Ensure all documents are clearly legible. Scanned copies
                    should be in high resolution. Failure to provide valid
                    documents will result in immediate rejection of your
                    application.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              navigate(previousStep?.path || "/application/form-responses", {
                state: { applicationId },
              })
            }
          >
            ← Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={!applicationId}
            className="px-6 bg-orange-600 hover:bg-orange-700"
          >
            Save & Continue →
          </Button>
        </div>
      </div>

      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm">
          <div className="flex max-h-[94vh] w-full max-w-[920px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-white/20">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-600">
                  Uploaded Document
                </p>
                <h3 className="truncate text-base font-semibold text-slate-900">
                  {previewDoc.title || "Document Preview"}
                </h3>
                {previewDoc.name && (
                  <p className="truncate text-sm text-slate-500">
                    {previewDoc.name}
                  </p>
                )}
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    window.open(previewDoc.url, "_blank", "noopener,noreferrer")
                  }
                  className="gap-1.5 border-emerald-300 px-4 text-emerald-700 hover:bg-emerald-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPreviewDoc(null)}
                  className="text-slate-500 hover:bg-slate-100"
                  aria-label="Close document preview"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="h-[calc(94vh-76px)] bg-slate-100">
              <DocumentPreviewFrame
                src={previewDoc.url}
                title={previewDoc.name || "Uploaded document"}
              />
            </div>
          </div>
        </div>
      )}
    </ApplicationLayout>
  );
};

export default Documents;
