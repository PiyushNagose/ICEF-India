import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { candidateService } from "../../services/candidate.service";
import JobConfiguredSection from "./JobConfiguredSection";
import { buildApplicationSteps } from "../../utils/applicationFlow";

const APP_KEY = "app_draft";
const getAppId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
  } catch {
    return null;
  }
};

const AdditionalInfo = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
  const [dataLoaded, setDataLoaded] = useState(false);
  const configuredFieldsRef = useRef(null);

  const [formData, setFormData] = useState({
    isGovtEmployee: false,
    departmentName: "",
    yearsOfService: "",
    isExServiceman: false,
    isPwD: false,
    disabilityType: "",
    disabilityPercentage: "",
    drivingLicense: "",
    computerCertificate: "",
    subjectCombination: "",
  });

  // Load existing data
  const { data: appData, isLoading: loadingApp } = useQuery({
    queryKey: ["application-additional", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (appData && !dataLoaded) {
      const app = appData?.application || appData;
      const info = app?.additionalInfo || {};
      if (info && Object.keys(info).length > 0) {
        setFormData({
          isGovtEmployee: info.isGovtEmployee || false,
          departmentName: info.departmentName || "",
          yearsOfService:
            info.yearsOfService != null ? String(info.yearsOfService) : "",
          isExServiceman: info.isExServiceman || false,
          isPwD: info.isPwD || false,
          disabilityType: info.disabilityType || "",
          disabilityPercentage:
            info.disabilityPercentage != null
              ? String(info.disabilityPercentage)
              : "",
          drivingLicense: info.drivingLicense || "",
          computerCertificate: info.computerCertificate || "",
          subjectCombination: info.subjectCombination || "",
        });
      }
      setDataLoaded(true);
    }
  }, [appData, dataLoaded]);

  const set = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const { mutate: saveStep, isPending } = useMutation({
    mutationFn: (data) =>
      candidateService.saveAdditionalInfo(applicationId, data),
    onSuccess: () => {
      toast.success("Additional info saved");
      if (location.state?.returnToReview) {
        navigate("/application/review", { state: { applicationId } });
      } else {
        const app = appData?.application || appData;
        const steps = buildApplicationSteps(app?.jobId, app);
        const additionalStep =
          steps.find((step) => step.type === "additional-info")?.id || 3;
        const nextStep = steps.find((step) => step.id === additionalStep + 1);
        navigate(nextStep?.path || "/application/address", {
          state: { applicationId },
        });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });

  const app = appData?.application || appData;

  const handleNext = async () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate("/jobs");
      return;
    }
    const payload = {
      isGovtEmployee: formData.isGovtEmployee,
      isExServiceman: formData.isExServiceman,
      isPwD: formData.isPwD,
    };
    if (formData.isGovtEmployee) {
      if (formData.departmentName)
        payload.departmentName = formData.departmentName;
      if (formData.yearsOfService)
        payload.yearsOfService = Number(formData.yearsOfService);
    }
    if (formData.isPwD) {
      if (formData.disabilityType)
        payload.disabilityType = formData.disabilityType;
      if (formData.disabilityPercentage)
        payload.disabilityPercentage = Number(formData.disabilityPercentage);
    }
    if (formData.drivingLicense)
      payload.drivingLicense = formData.drivingLicense;
    if (formData.computerCertificate)
      payload.computerCertificate = formData.computerCertificate;
    if (formData.subjectCombination)
      payload.subjectCombination = formData.subjectCombination;
    const extraSaved = await configuredFieldsRef.current?.validateAndSave?.();
    if (extraSaved === false) return;
    saveStep(payload);
  };

  const inputCls =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500";
  const YesNo = ({ field }) => (
    <div className="flex space-x-4">
      {[true, false].map((val) => (
        <button
          key={String(val)}
          type="button"
          onClick={() => set(field, val)}
          className={`px-8 py-3 rounded-lg border-2 transition-all ${formData[field] === val ? "border-orange-500 bg-orange-50 text-orange-700" : "border-gray-300 text-gray-700 hover:border-orange-300"}`}
        >
          {val ? "YES" : "NO"}
        </button>
      ))}
    </div>
  );

  if (loadingApp && !dataLoaded) {
    return (
      <ApplicationLayout currentStep={3} title="Additional Details">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
          <span className="ml-3 text-gray-600">
            Loading your application...
          </span>
        </div>
      </ApplicationLayout>
    );
  }

  return (
    <ApplicationLayout currentStep={3} title="Additional Details">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              Additional Details
            </h2>
            <p className="text-gray-600">
              Please provide supplementary information for eligibility
              verification.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Govt Employee */}
            <div className="border-l-4 border-orange-400 pl-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Government Employment Status
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Are you a Government employee (3+ years)?
                  </p>
                  <YesNo field="isGovtEmployee" />
                </div>
                {formData.isGovtEmployee && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Department Name
                      </label>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="e.g. Department of Education"
                        value={formData.departmentName}
                        onChange={(e) => set("departmentName", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Years of Service
                      </label>
                      <input
                        type="number"
                        min="0"
                        className={inputCls}
                        placeholder="4"
                        value={formData.yearsOfService}
                        onChange={(e) => set("yearsOfService", e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Special Categories */}
            <div className="border-l-4 border-yellow-400 pl-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Special Category Details
              </h3>
              <div className="space-y-6">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Ex-serviceman?
                  </p>
                  <YesNo field="isExServiceman" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Person with Disability (PwD)?
                  </p>
                  <YesNo field="isPwD" />
                  {formData.isPwD && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Disability Type
                        </label>
                        <select
                          className={inputCls}
                          value={formData.disabilityType}
                          onChange={(e) =>
                            set("disabilityType", e.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="locomotor">
                            Locomotor Disability
                          </option>
                          <option value="visual">Visual Impairment</option>
                          <option value="hearing">Hearing Impairment</option>
                          <option value="intellectual">
                            Intellectual Disability
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Disability Percentage (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          className={inputCls}
                          placeholder="45"
                          value={formData.disabilityPercentage}
                          onChange={(e) =>
                            set("disabilityPercentage", e.target.value)
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Special Qualifications */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Driving License
                </label>
                <select
                  className={inputCls}
                  value={formData.drivingLicense}
                  onChange={(e) => set("drivingLicense", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="LMV">Yes — LMV (Light Motor Vehicle)</option>
                  <option value="HMV">Yes — HMV (Heavy Motor Vehicle)</option>
                  <option value="none">No</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Computer Certificate
                </label>
                <select
                  className={inputCls}
                  value={formData.computerCertificate}
                  onChange={(e) => set("computerCertificate", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="dca">
                    DCA (Diploma in Computer Applications)
                  </option>
                  <option value="pgdca">PGDCA</option>
                  <option value="other">Other</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Subject Combination
                </label>
                <select
                  className={inputCls}
                  value={formData.subjectCombination}
                  onChange={(e) => set("subjectCombination", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="english-hindi">English + Hindi</option>
                  <option value="hindi-urdu">Hindi + Urdu</option>
                  <option value="english-bengali">English + Bengali</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <JobConfiguredSection
          ref={configuredFieldsRef}
          app={app}
          applicationId={applicationId}
          systemSource="additional"
        />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              navigate("/application/education", { state: { applicationId } })
            }
          >
            ← Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isPending || !applicationId}
            className="px-6 bg-orange-600 hover:bg-orange-700"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save & Continue →"
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default AdditionalInfo;
