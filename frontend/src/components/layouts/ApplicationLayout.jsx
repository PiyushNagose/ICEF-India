import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle,
  Lock,
  User,
  GraduationCap,
  FileText,
  MapPin,
  Upload,
  Eye,
  CreditCard,
  ListChecks,
  CheckCheck,
} from "lucide-react";
import { candidateService } from "../../services/candidate.service";
import {
  buildApplicationSteps,
  isCorrectionMode,
  readApplicationDraft,
} from "../../utils/applicationFlow";
import logo from "../../assets/logo.png";

const FALLBACK_STEPS = [
  {
    id: 1,
    name: "Personal Details",
    icon: User,
    path: "/application/personal-details",
  },
  {
    id: 2,
    name: "Educational Info",
    icon: GraduationCap,
    path: "/application/education",
  },
  {
    id: 3,
    name: "Additional Information",
    icon: FileText,
    path: "/application/additional-info",
  },
  {
    id: 4,
    name: "Address Details",
    icon: MapPin,
    path: "/application/address",
  },
  {
    id: 5,
    name: "Document Upload",
    icon: Upload,
    path: "/application/documents",
  },
  { id: 6, name: "Review", icon: Eye, path: "/application/review" },
  {
    id: 7,
    name: "Post Selection",
    icon: ListChecks,
    path: "/application/post-selection",
  },
  { id: 8, name: "Payment", icon: CreditCard, path: "/application/payment" },
  { id: 9, name: "Submit", icon: CheckCheck, path: "/application/success" },
];

const ApplicationLayout = ({ children, currentStep = 1, title, jobTitle }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const draft = readApplicationDraft();

  const { data: appData } = useQuery({
    queryKey: ["application-layout", draft.applicationId],
    queryFn: () => candidateService.getApplication(draft.applicationId),
    enabled: Boolean(draft.applicationId),
    staleTime: 30000,
  });

  const app = appData?.application || appData;
  const correctionMode = isCorrectionMode(app) || draft.correctionMode === true;
  const dynamicSteps = app?.jobId ? buildApplicationSteps(app.jobId, app) : [];
  const steps = dynamicSteps.length > 0 ? dynamicSteps : FALLBACK_STEPS;
  const activeStep =
    steps.find((step) => {
      const [path, query = ""] = step.path.split("?");
      if (path !== location.pathname) return false;
      if (!query) return true;
      return query === location.search.replace(/^\?/, "");
    })?.id || Math.min(currentStep, steps.length);
  const currentProgressStep = Math.max(
    Number(app?.currentStep || 0),
    Number(activeStep || currentStep || 1),
  );

  // In correction mode, ALL non-payment steps are freely accessible
  // Otherwise, a step is accessible only if currentStep >= step.id
  const canAccess = (stepId) => {
    const step = steps.find((s) => s.id === stepId);
    if (correctionMode) {
      // Payment step is hidden/inaccessible in correction mode
      if (step?.type === "payment") return false;
      // All other steps are freely accessible in correction mode
      return true;
    }
    return stepId <= currentProgressStep;
  };

  const handleStepClick = (step) => {
    if (!canAccess(step.id)) return; // locked — do nothing
    // Get applicationId from sessionStorage
    const draft = JSON.parse(sessionStorage.getItem("app_draft") || "{}");
    navigate(step.path, {
      state: { applicationId: draft.applicationId, jobId: draft.jobId },
    });
  };

  return (
    <div className="customer-motion-root h-screen overflow-hidden bg-orange-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-orange-200 px-6 py-4 flex-shrink-0">
        <div className="w-full flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="flex items-center space-x-3"
          >
            <div className="w-10 h-10 rounded-lg bg-[#1f1d1b] flex items-center justify-center overflow-hidden">
              <img src={logo} alt="ICEF India" className="h-full w-full object-contain p-1" />
            </div>
            <div>
              <div className="font-bold text-gray-800">Recruitment Portal</div>
              <div className="text-sm text-gray-600">GOVERNMENT OF INDIA</div>
            </div>
          </button>
          <div className="text-sm text-gray-600">
            Step{" "}
            <span className="font-semibold text-orange-600">{activeStep}</span>{" "}
            of {steps.length}
          </div>
        </div>
      </header>

      {/* Top progress bar — visual only, no navigation */}
      <div className="bg-white border-b border-orange-200 px-6 py-4 overflow-x-auto flex-shrink-0">
        <div className="w-full">
          <div className="flex items-center min-w-max">
            {steps.map((step, index) => {
              const isCompleted = step.id < activeStep;
              const isActive = step.id === activeStep;
              const isLocked = step.id > activeStep;

              return (
                <div key={step.id} className="flex items-center">
                  <div className="flex items-center">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${
                        isCompleted
                          ? "bg-orange-600 border-orange-600 text-white"
                          : isActive
                            ? "bg-orange-600 border-orange-600 text-white"
                            : "bg-white border-gray-300 text-gray-400"
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : isLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                      ) : (
                        <span className="text-xs font-bold">{step.id}</span>
                      )}
                    </div>
                    <div className="ml-2 hidden lg:block">
                      <div
                        className={`text-xs font-medium whitespace-nowrap ${
                          isLocked ? "text-gray-400" : "text-orange-600"
                        }`}
                      >
                        {step.name}
                      </div>
                    </div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`w-6 h-0.5 mx-2 flex-shrink-0 ${
                        isCompleted ? "bg-orange-600" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[288px_1fr]">
        {/* Sidebar */}
        <div className="hidden lg:block p-5 min-h-0 overflow-hidden">
          <div className="bg-gray-800 rounded-xl shadow-lg h-full min-h-0 flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-700">
              <h2 className="text-white font-semibold text-sm">
                Application Steps
              </h2>
              <p className="text-gray-400 text-xs mt-1 truncate">
                {jobTitle || "Application Form"}
              </p>
              {correctionMode && (
                <div className="mt-2 px-2 py-1.5 bg-orange-600 rounded-lg">
                  <p className="text-white text-xs font-semibold">
                    ✎ Correction Mode
                  </p>
                  <p className="text-orange-200 text-xs">
                    You can edit any step freely
                  </p>
                </div>
              )}
            </div>

            <nav className="hover-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-0.5">
              {steps.map((step) => {
                const Icon =
                  step.icon ||
                  (step.type === "form"
                    ? FileText
                    : step.type === "documents"
                      ? Upload
                      : step.type === "post-selection"
                        ? ListChecks
                        : step.type === "payment"
                          ? CreditCard
                          : step.type === "success"
                            ? CheckCheck
                            : Eye);
                const isActive = step.id === activeStep;
                const accessible = canAccess(step.id);
                const isCompleted = correctionMode
                  ? step.id < activeStep && accessible
                  : step.id < activeStep;
                const isLocked = !accessible;

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => handleStepClick(step)}
                    disabled={isLocked}
                    title={
                      isLocked ? "Not available in correction mode" : step.name
                    }
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isActive
                        ? "bg-orange-600 text-white"
                        : isLocked
                          ? "text-gray-500 cursor-not-allowed opacity-40"
                          : correctionMode
                            ? "text-orange-300 hover:bg-gray-700 cursor-pointer"
                            : isCompleted
                              ? "text-green-400 hover:bg-gray-700 cursor-pointer"
                              : "text-gray-500 cursor-not-allowed opacity-60"
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {isActive ? (
                        <Icon className="w-4 h-4" />
                      ) : isLocked ? (
                        <Lock className="w-4 h-4" />
                      ) : isCompleted && !correctionMode ? (
                        <CheckCircle className="w-4 h-4" />
                      ) : (
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <span className="text-sm font-medium truncate">
                      {step.name}
                    </span>
                    {isCompleted && !correctionMode && (
                      <span className="ml-auto text-xs text-green-500 flex-shrink-0">
                        ✓
                      </span>
                    )}
                    {correctionMode && !isActive && !isLocked && (
                      <span className="ml-auto text-xs text-orange-400 flex-shrink-0">
                        ✎
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Progress */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex justify-between text-xs text-gray-400 mb-2">
                <span>Progress</span>
                <span className="text-orange-400 font-semibold">
                  Step {activeStep}/{steps.length}
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-orange-600 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${(activeStep / steps.length) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {activeStep < steps.length
                  ? `${steps.length - activeStep} step${steps.length - activeStep !== 1 ? "s" : ""} remaining`
                  : "All steps completed!"}
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="min-w-0 min-h-0">
          <main className="hover-scroll h-full overflow-y-auto p-4 lg:p-6">
            <div className="application-page-root min-h-full w-full">
              {title && (
                <h1 className="text-2xl font-bold text-gray-800 mb-6">
                  {title}
                </h1>
              )}
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default ApplicationLayout;
