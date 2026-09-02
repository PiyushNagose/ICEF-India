/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, ArrowRight } from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import CustomSelect from "../../components/ui/CustomSelect";
import { candidateService } from "../../services/candidate.service";
import {
  buildApplicationSteps,
  getJobFormSections,
  persistApplicationDraft,
  readApplicationDraft,
} from "../../utils/applicationFlow";
import {
  INDIA_STATE_CITIES,
  INDIA_STATES,
} from "../../constants/indiaLocations";
import { getLastPublicProjectPath } from "../../utils/publicNavigation";

export const fieldKey = (field) => String(field._id || field.id);

const isStateField = (field) =>
  /(^|\s)(state|state\/ut)(\s|$)/i.test(field.label || "");
const isCityField = (field) =>
  /(^|\s)(city|district)(\s|$)/i.test(field.label || "");

const normaliseValue = (field, value) => {
  if (field.type === "number") return value === "" ? "" : Number(value);
  if (field.type === "checkbox") return Boolean(value);
  return value;
};

const getSelectedStateForField = (section, field, formData) => {
  const fields = section.fields || [];
  const currentIndex = fields.findIndex(
    (item) => fieldKey(item) === fieldKey(field),
  );
  const previousStateField = fields
    .slice(0, Math.max(0, currentIndex))
    .reverse()
    .find(isStateField);
  return previousStateField ? formData[fieldKey(previousStateField)] : "";
};

export const validateValue = (field, value) => {
  const label = field.label || "This field";
  if (field.required) {
    if (field.type === "file") return "";
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "string" && !value.trim());
    if (empty) return `${label} is required`;
  }
  if (value === undefined || value === null || value === "") return "";
  if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "Enter a valid email address";
  }
  if (
    field.type === "tel" &&
    !/^[6-9]\d{9}$/.test(String(value).replace(/\D/g, ""))
  ) {
    return "Enter a valid 10 digit mobile number";
  }
  if (
    field.validation?.min !== undefined &&
    Number(value) < field.validation.min
  ) {
    return (
      field.validation.message ||
      `${label} must be at least ${field.validation.min}`
    );
  }
  if (
    field.validation?.max !== undefined &&
    Number(value) > field.validation.max
  ) {
    return (
      field.validation.message ||
      `${label} must be at most ${field.validation.max}`
    );
  }
  if (field.validation?.pattern) {
    try {
      if (!new RegExp(field.validation.pattern).test(String(value))) {
        return field.validation.message || `${label} is invalid`;
      }
    } catch {
      return "";
    }
  }
  return "";
};

const DynamicFormFields = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const draft = readApplicationDraft();
  const applicationId = location.state?.applicationId || draft.applicationId;
  const isReviewEdit = Boolean(location.state?.returnToReview);
  const [formData, setFormData] = useState({});
  const [errors, setErrors] = useState({});
  const [loadedForApp, setLoadedForApp] = useState(null);

  useEffect(() => {
    if (location.state?.applicationId || location.state?.jobId) {
      persistApplicationDraft({
        applicationId: location.state?.applicationId,
        jobId: location.state?.jobId,
      });
    }
  }, [location.state]);

  const { data: appData, isLoading } = useQuery({
    queryKey: ["application-dynamic-form", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const app = appData?.application || appData;
  const job = app?.jobId;
  const formSections = getJobFormSections(job);
  const sectionIndex = Math.min(
    Math.max(Number(searchParams.get("section") || 0), 0),
    Math.max(formSections.length - 1, 0),
  );
  const currentSection = formSections[sectionIndex];
  const steps = useMemo(() => buildApplicationSteps(job, app), [job, app]);
  const currentStep =
    steps.find(
      (step) =>
        step.type === "form-section" && step.sectionIndex === sectionIndex,
    )?.id || 1;
  const nextStep = steps.find((step) => step.id === currentStep + 1);
  const previousStep = steps.find((step) => step.id === currentStep - 1);

  useEffect(() => {
    if (app && loadedForApp !== app._id) {
      persistApplicationDraft({
        applicationId: app._id,
        jobId: app.jobId?._id || app.jobId,
      });
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(app.formResponses || {});
      setLoadedForApp(app._id);
    }
  }, [app, loadedForApp]);

  useEffect(() => {
    if (!isLoading && app && formSections.length === 0) {
      const documentsStep = steps.find((step) => step.type === "documents");
      navigate(documentsStep?.path || "/application/documents", {
        state: { applicationId },
        replace: true,
      });
    }
  }, [isLoading, app, formSections.length, navigate, applicationId, steps]);

  const { mutate: saveDynamicForm, isPending } = useMutation({
    mutationFn: (data) =>
      candidateService.saveDynamicFormResponses(applicationId, data, {
        sectionIndex,
      }),
    onSuccess: (result) => {
      toast.success("Form responses saved");
      const latestApplication = result?.application || result || app;
      queryClient.setQueryData(["application-layout", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-dynamic-form", applicationId], {
        application: latestApplication,
      });
      if (location.state?.returnToReview) {
        navigate("/application/review", { state: { applicationId } });
      } else if (nextStep) {
        navigate(nextStep.path, {
          state: { applicationId, jobId: app?.jobId?._id || app?.jobId },
        });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });

  const handleFieldChange = (section, field, value) => {
    const key = fieldKey(field);
    setFormData((prev) => {
      const updated = { ...prev, [key]: normaliseValue(field, value) };
      if (isStateField(field)) {
        (section.fields || []).filter(isCityField).forEach((cityField) => {
          const cityKey = fieldKey(cityField);
          const cities = INDIA_STATE_CITIES[value] || [];
          if (updated[cityKey] && !cities.includes(updated[cityKey]))
            updated[cityKey] = "";
        });
      }
      return updated;
    });
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const validateSection = () => {
    const nextErrors = {};
    (currentSection?.fields || []).forEach((field) => {
      const error = validateValue(field, formData[fieldKey(field)]);
      if (error) nextErrors[fieldKey(field)] = error;
    });
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleNext = () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate(getLastPublicProjectPath());
      return;
    }
    if (!validateSection()) return;
    const allowedKeys = new Set();
    formSections.forEach((section) => {
      (section.fields || []).forEach((field) => allowedKeys.add(fieldKey(field)));
    });
    const cleanFormData = Object.fromEntries(
      Object.entries(formData).filter(([key]) => allowedKeys.has(key)),
    );
    saveDynamicForm(cleanFormData);
  };

  const handleBack = () => {
    if (previousStep) navigate(previousStep.path, { state: { applicationId } });
    else navigate(getLastPublicProjectPath());
  };

  if (isLoading || !app) {
    return (
      <ApplicationLayout currentStep={currentStep}>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="ml-3 text-gray-600">
            Loading application form...
          </span>
        </div>
      </ApplicationLayout>
    );
  }

  if (!currentSection) return null;

  return (
    <ApplicationLayout currentStep={currentStep} title={currentSection.title}>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h1 className="text-xl font-semibold text-gray-800">
              {currentSection.title}
            </h1>
            <p className="text-gray-600 text-sm">
              Fill only the information requested for this job.
            </p>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {(currentSection.fields || []).map((field) => (
                <div
                  key={fieldKey(field)}
                  className={field.type === "textarea" ? "md:col-span-2" : ""}
                >
                  {renderField(
                    currentSection,
                    field,
                    formData,
                    errors,
                    handleFieldChange,
                  )}
                </div>
              ))}
            </form>
          </CardContent>
        </Card>

        <div className="flex justify-between items-center">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isPending}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isPending}
            className="gap-2 bg-orange-600 hover:bg-orange-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                {isReviewEdit ? "Save & Return to Review" : "Save & Continue"}
                {!isReviewEdit && <ArrowRight className="w-4 h-4" />}
              </>
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export const renderField = (section, field, formData, errors, onChange) => {
  const key = fieldKey(field);
  const value = formData[key] ?? (field.type === "checkbox" ? false : "");
  const error = errors[key];
  const inputClass = `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
    error ? "border-red-400" : "border-gray-300"
  }`;
  const label = (
    <label className="block text-sm font-medium text-gray-700 mb-2">
      {field.label}
      {field.required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );

  if (isStateField(field)) {
    return (
      <>
        {label}
        <CustomSelect
          value={value}
          onChange={(next) => onChange(section, field, next)}
          options={INDIA_STATES}
          placeholder="Select State"
          className={inputClass}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </>
    );
  }

  if (isCityField(field)) {
    const selectedState = getSelectedStateForField(section, field, formData);
    const cities = selectedState ? INDIA_STATE_CITIES[selectedState] || [] : [];
    return (
      <>
        {label}
        <CustomSelect
          value={value}
          onChange={(next) => onChange(section, field, next)}
          options={cities}
          placeholder={selectedState ? "Select City" : "Select state first"}
          className={inputClass}
          disabled={!selectedState}
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </>
    );
  }

  switch (field.type) {
    case "textarea":
      return (
        <>
          {label}
          <textarea
            value={value}
            onChange={(e) => onChange(section, field, e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={inputClass}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
    case "select":
      return (
        <>
          {label}
          <CustomSelect
            value={value}
            onChange={(next) => onChange(section, field, next)}
            options={field.options || []}
            placeholder={`Select ${field.label}`}
            className={inputClass}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
    case "radio":
      return (
        <>
          {label}
          <div className="space-y-2">
            {(field.options || []).map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <input
                  type="radio"
                  name={key}
                  value={option}
                  checked={value === option}
                  onChange={(e) => onChange(section, field, e.target.value)}
                  className="w-4 h-4 text-orange-500"
                />
                {option}
              </label>
            ))}
          </div>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
    case "checkbox":
      return (
        <>
          {label}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(section, field, e.target.checked)}
              className="w-4 h-4 text-orange-500 rounded"
            />
            {field.placeholder || "Yes"}
          </label>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
    case "file":
      return (
        <>
          {label}
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            This file should be configured under job document requirements so it
            can be uploaded and verified securely.
            {field.validation?.maxSizeKB ? (
              <div className="mt-1 text-xs text-amber-700">
                Max size: {field.validation.maxSizeKB} KB
              </div>
            ) : null}
          </div>
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
    default:
      return (
        <>
          {label}
          <input
            type={field.type || "text"}
            value={value}
            onChange={(e) => onChange(section, field, e.target.value)}
            placeholder={field.placeholder}
            className={inputClass}
          />
          {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
        </>
      );
  }
};

export default DynamicFormFields;
