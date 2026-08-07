import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  PlayCircle,
  Loader2,
  Edit3,
} from "lucide-react";
import CandidateLayout from "../../components/layouts/CandidateLayout";
import { Card, CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";
import {
  getRouteForApplicationStep,
  isCorrectionMode,
  persistApplicationDraft,
} from "../../utils/applicationFlow";

const STATUS_CONFIG = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: Clock },
  submitted: {
    label: "Submitted",
    color: "bg-blue-100 text-blue-700",
    icon: FileText,
  },
  under_review: {
    label: "Under Review",
    color: "bg-yellow-100 text-yellow-700",
    icon: AlertCircle,
  },
  verified: {
    label: "Verified",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  approved: {
    label: "Approved",
    color: "bg-green-100 text-green-700",
    icon: CheckCircle,
  },
  clarification_required: {
    label: "Clarification Required",
    color: "bg-orange-100 text-orange-700",
    icon: AlertCircle,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  shortlisted: {
    label: "Shortlisted",
    color: "bg-purple-100 text-purple-700",
    icon: CheckCircle,
  },
};

// Step labels for progress display
const STEP_LABELS = {
  1: "Personal Details",
  2: "Education",
  3: "Additional Info",
  4: "Address",
  5: "Documents",
  6: "Review",
  7: "Post Selection",
  8: "Payment",
  9: "Submitted",
};

const Applications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["candidate-applications", activeTab],
    queryFn: () =>
      candidateService.getMyApplications({
        status: activeTab === "all" ? undefined : activeTab,
        limit: 20,
      }),
  });

  const applications = Array.isArray(data)
    ? data
    : data?.applications || data?.data || [];
  const total =
    data?.meta?.totalItems ||
    data?.pagination?.totalItems ||
    applications.length;

  const tabs = [
    { id: "all", label: "All" },
    { id: "draft", label: "Draft" },
    { id: "submitted", label: "Submitted" },
    { id: "under_review", label: "Under Review" },
    { id: "verified", label: "Verified" },
    { id: "clarification_required", label: "Clarification" },
    { id: "rejected", label: "Rejected" },
  ];

  const handleView = (app) => {
    persistApplicationDraft({ applicationId: app._id, jobId: app.jobId?._id });
    navigate(`/candidate/applications/${app._id}`);
  };

  const handleResume = (app) => {
    persistApplicationDraft({ applicationId: app._id, jobId: app.jobId?._id });
    const route = getRouteForApplicationStep(app, app.currentStep || 1);
    navigate(route, {
      state: { applicationId: app._id, jobId: app.jobId?._id },
    });
  };

  const handleEditCorrection = (app) => {
    // Set correction mode in session draft so ApplicationLayout knows
    persistApplicationDraft({
      applicationId: app._id,
      jobId: app.jobId?._id,
      correctionMode: true,
    });
    // Start from step 1 so candidate can freely navigate all steps
    const route = getRouteForApplicationStep(app, 1);
    navigate(route, {
      state: { applicationId: app._id, jobId: app.jobId?._id },
    });
  };

  return (
    <CandidateLayout title="My Applications">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              My Applications
            </h1>
            <p className="text-gray-600 text-sm">{total} total applications</p>
          </div>
          <Button
            onClick={() => navigate("/candidate/jobs")}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            Browse Jobs
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-orange-200">
          <nav className="-mb-px flex space-x-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? "border-orange-500 text-orange-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* List */}
        <Card>
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-6 text-center text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading applications...
              </div>
            )}

            {!isLoading && applications.length === 0 && (
              <div className="p-8 text-center">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  No applications found
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  Browse available jobs and start applying
                </p>
                <Button
                  onClick={() => navigate("/candidate/jobs")}
                  className="mt-4 bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Browse Jobs
                </Button>
              </div>
            )}

            {applications.map((app) => {
              const cfg = STATUS_CONFIG[app.status] || STATUS_CONFIG.submitted;
              const StatusIcon = cfg.icon;
              const isDraft = app.status === "draft";
              const needsCorrection = isCorrectionMode(app);
              const correctionSubmitted =
                app.correction?.status === "submitted";
              const stepProgress = Math.round(
                ((app.currentStep || 1) / 9) * 100,
              );

              return (
                <div
                  key={app._id}
                  className={`grid grid-cols-1 gap-4 p-4 border-b border-gray-100 last:border-0 transition-colors sm:grid-cols-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_160px_170px_120px] lg:items-center ${
                    needsCorrection
                      ? "bg-orange-50 hover:bg-orange-100"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        needsCorrection
                          ? "bg-orange-200"
                          : isDraft
                            ? "bg-gray-100"
                            : "bg-orange-100"
                      }`}
                    >
                      {needsCorrection ? (
                        <Edit3 className="w-5 h-5 text-orange-700" />
                      ) : (
                        <FileText
                          className={`w-5 h-5 ${isDraft ? "text-gray-500" : "text-orange-600"}`}
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {app.jobId?.title || "Job Application"}
                      </p>
                      <p className="text-sm text-gray-500 truncate">
                        {app.jobId?.department || "-"}
                      </p>
                      <p className="text-xs text-orange-600 mt-0.5 font-mono">
                        {app.applicationId}
                      </p>

                      {needsCorrection && (
                        <p className="text-xs font-semibold text-orange-700 mt-1 flex items-center gap-1">
                          <Edit3 className="w-3 h-3" />
                          Admin requested corrections - action required
                        </p>
                      )}
                      {correctionSubmitted && (
                        <p className="text-xs font-semibold text-blue-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Corrections submitted - awaiting admin re-review
                        </p>
                      )}

                      {isDraft && (
                        <div className="mt-2 w-full max-w-[220px]">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs text-gray-500 truncate">
                              Step {app.currentStep || 1}/9 - {STEP_LABELS[app.currentStep || 1]}
                            </span>
                            <span className="text-xs font-semibold text-orange-600 flex-shrink-0">
                              {stepProgress}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-orange-500 h-1.5 rounded-full transition-all"
                              style={{ width: `${stepProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 sm:text-right lg:text-left lg:self-center">
                    {app.submittedAt
                      ? `Submitted ${new Date(app.submittedAt).toLocaleDateString("en-IN")}`
                      : `Started ${new Date(app.createdAt).toLocaleDateString("en-IN")}`}
                  </p>

                  <div className="flex lg:justify-start">
                    {needsCorrection ? (
                      <Badge className="bg-orange-100 text-orange-700 border border-orange-300 whitespace-nowrap">
                        <Edit3 className="w-3 h-3 mr-1 inline" />
                        Correction Needed
                      </Badge>
                    ) : (
                      <Badge className={`${cfg.color} whitespace-nowrap`}>
                        <StatusIcon className="w-3 h-3 mr-1 inline" />
                        {cfg.label}
                      </Badge>
                    )}
                  </div>

                  <div className="flex sm:justify-end lg:justify-end">
                    {isDraft ? (
                      <Button
                        size="sm"
                        onClick={() => handleResume(app)}
                        className="min-w-[112px] bg-orange-600 hover:bg-orange-700 text-white gap-1.5 whitespace-nowrap"
                      >
                        <PlayCircle className="w-4 h-4" />
                        Resume
                      </Button>
                    ) : needsCorrection ? (
                      <Button
                        size="sm"
                        onClick={() => handleEditCorrection(app)}
                        className="min-w-[112px] bg-orange-600 hover:bg-orange-700 text-white gap-1.5 whitespace-nowrap"
                      >
                        <Edit3 className="w-4 h-4" />
                        Edit Now
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(app)}
                        className="min-w-[44px] text-orange-600 hover:bg-orange-50"
                        title="View application"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </CandidateLayout>
  );
};

export default Applications;
