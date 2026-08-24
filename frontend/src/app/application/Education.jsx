import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import CustomSelect from "../../components/ui/CustomSelect";
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

const YEARS = Array.from(
  { length: 30 },
  (_, i) => new Date().getFullYear() - i,
);

const Education = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Persist applicationId if passed via state
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
    tenth: { board: "", school: "", rollNumber: "", year: "", percentage: "" },
    twelfth: {
      board: "",
      stream: "",
      school: "",
      rollNumber: "",
      year: "",
      percentage: "",
    },
    graduation: { degree: "", university: "", year: "", percentage: "" },
    hasPostGraduation: false,
  });

  // Load existing data
  const { data: appData, isLoading: loadingApp } = useQuery({
    queryKey: ["application-education", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (appData) {
      const app = appData?.application || appData;
      const edu = app?.education || {};
      if (edu && Object.keys(edu).length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData({
          tenth: {
            board: edu.tenth?.board || "",
            school: edu.tenth?.school || "",
            rollNumber: edu.tenth?.rollNumber || "",
            year: edu.tenth?.year ? String(edu.tenth.year) : "",
            percentage:
              edu.tenth?.percentage != null ? String(edu.tenth.percentage) : "",
          },
          twelfth: {
            board: edu.twelfth?.board || "",
            stream: edu.twelfth?.stream || "",
            school: edu.twelfth?.school || "",
            rollNumber: edu.twelfth?.rollNumber || "",
            year: edu.twelfth?.year ? String(edu.twelfth.year) : "",
            percentage:
              edu.twelfth?.percentage != null
                ? String(edu.twelfth.percentage)
                : "",
          },
          graduation: {
            degree: edu.graduation?.degree || "",
            university: edu.graduation?.university || "",
            year: edu.graduation?.year ? String(edu.graduation.year) : "",
            percentage:
              edu.graduation?.percentage != null
                ? String(edu.graduation.percentage)
                : "",
          },
          hasPostGraduation: edu.hasPostGraduation || false,
        });
      }
      setDataLoaded(true);
    }
  }, [appData]);

  const set = (section, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const { mutate: saveStep, isPending } = useMutation({
    mutationFn: (data) => candidateService.saveEducation(applicationId, data),
    onSuccess: (result) => {
      toast.success("Education details saved");
      const latestApplication = result?.application || result || appData?.application || appData;
      queryClient.setQueryData(["application-layout", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-education", applicationId], {
        application: latestApplication,
      });
      if (location.state?.returnToReview) {
        navigate("/application/review", { state: { applicationId } });
      } else {
        const app = latestApplication;
        const steps = buildApplicationSteps(app?.jobId, app);
        const educationStep =
          steps.find((step) => step.type === "education")?.id || 2;
        const nextStep = steps.find((step) => step.id === educationStep + 1);
        navigate(nextStep?.path || "/application/additional-info", {
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
    const payload = {};
    const tenth = formData.tenth;
    if (tenth.board || tenth.school || tenth.rollNumber) {
      payload.tenth = {
        board: tenth.board,
        school: tenth.school,
        rollNumber: tenth.rollNumber,
        year: tenth.year ? Number(tenth.year) : undefined,
        percentage: tenth.percentage ? Number(tenth.percentage) : undefined,
      };
    }
    const twelfth = formData.twelfth;
    if (twelfth.board || twelfth.school) {
      payload.twelfth = {
        board: twelfth.board,
        stream: twelfth.stream,
        school: twelfth.school,
        rollNumber: twelfth.rollNumber,
        year: twelfth.year ? Number(twelfth.year) : undefined,
        percentage: twelfth.percentage ? Number(twelfth.percentage) : undefined,
      };
    }
    const grad = formData.graduation;
    if (grad.degree || grad.university) {
      payload.graduation = {
        degree: grad.degree,
        university: grad.university,
        year: grad.year ? Number(grad.year) : undefined,
        percentage: grad.percentage ? Number(grad.percentage) : undefined,
      };
    }
    payload.hasPostGraduation = formData.hasPostGraduation;
    const extraSaved = await configuredFieldsRef.current?.validateAndSave?.();
    if (extraSaved === false) return;
    saveStep(payload);
  };

  const inputCls =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500";
  const selectCls =
    "w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500";

  if (loadingApp && !dataLoaded) {
    return (
      <ApplicationLayout currentStep={2} title="Education">
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
    <ApplicationLayout currentStep={2} title="Education">
      <div className="space-y-6">
        {/* 10th */}
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              10th Education (Secondary)
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Board / Council
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. BSEB Patna"
                  value={formData.tenth.board}
                  onChange={(e) => set("tenth", "board", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School / Institute Name
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Enter your school's full name"
                  value={formData.tenth.school}
                  onChange={(e) => set("tenth", "school", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roll Number
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 240012"
                  value={formData.tenth.rollNumber}
                  onChange={(e) => set("tenth", "rollNumber", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year of Passing
                </label>
                <CustomSelect
                  className={selectCls}
                  value={formData.tenth.year}
                  onChange={(val) => set("tenth", "year", val)}
                  options={[
                    { value: "", label: "Select Year" },
                    ...YEARS.map((y) => ({ value: y, label: y }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage / CGPA
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls}
                  placeholder="e.g. 85.5"
                  value={formData.tenth.percentage}
                  onChange={(e) => set("tenth", "percentage", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 12th */}
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              12th Education (Senior Secondary)
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Board / Council
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. CBSE / BSEB"
                  value={formData.twelfth.board}
                  onChange={(e) => set("twelfth", "board", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stream
                </label>
                <CustomSelect
                  className={selectCls}
                  value={formData.twelfth.stream}
                  onChange={(val) => set("twelfth", "stream", val)}
                  options={[
                    { value: "", label: "Select Stream" },
                    { value: "science", label: "Science" },
                    { value: "commerce", label: "Commerce" },
                    { value: "arts", label: "Arts" }
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  School / Institute Name
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="Enter school name"
                  value={formData.twelfth.school}
                  onChange={(e) => set("twelfth", "school", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Roll Number
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. 1102932"
                  value={formData.twelfth.rollNumber}
                  onChange={(e) => set("twelfth", "rollNumber", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year of Passing
                </label>
                <CustomSelect
                  className={selectCls}
                  value={formData.twelfth.year}
                  onChange={(val) => set("twelfth", "year", val)}
                  options={[
                    { value: "", label: "Select Year" },
                    ...YEARS.map((y) => ({ value: y, label: y }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls}
                  placeholder="e.g. 92.0"
                  value={formData.twelfth.percentage}
                  onChange={(e) => set("twelfth", "percentage", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Graduation */}
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              Graduation Details
            </h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Degree Name
                </label>
                <CustomSelect
                  className={selectCls}
                  value={formData.graduation.degree}
                  onChange={(val) => set("graduation", "degree", val)}
                  options={[
                    { value: "", label: "Select Degree" },
                    ...[
                      "B.A.",
                      "B.Sc.",
                      "B.Com.",
                      "B.Tech.",
                      "B.E.",
                      "B.B.A.",
                      "B.C.A.",
                      "Other",
                    ].map((d) => ({ value: d, label: d }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  University / Board
                </label>
                <input
                  type="text"
                  className={inputCls}
                  placeholder="e.g. Patna University"
                  value={formData.graduation.university}
                  onChange={(e) =>
                    set("graduation", "university", e.target.value)
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Year of Passing
                </label>
                <CustomSelect
                  className={selectCls}
                  value={formData.graduation.year}
                  onChange={(val) => set("graduation", "year", val)}
                  options={[
                    { value: "", label: "Select Year" },
                    ...YEARS.map((y) => ({ value: y, label: y }))
                  ]}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Percentage / CGPA
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  className={inputCls}
                  placeholder="Enter final aggregate"
                  value={formData.graduation.percentage}
                  onChange={(e) =>
                    set("graduation", "percentage", e.target.value)
                  }
                />
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-700 mb-3">
                Do you have a postgraduate degree?
              </p>
              <div className="flex space-x-4">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        hasPostGraduation: val,
                      }))
                    }
                    className={`px-6 py-2 rounded-lg ${formData.hasPostGraduation === val ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <JobConfiguredSection
          ref={configuredFieldsRef}
          app={app}
          applicationId={applicationId}
          systemSource="education"
        />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              navigate("/application/personal-details", {
                state: { applicationId },
              })
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

export default Education;
