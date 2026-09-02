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
import AppDatePicker from "../../components/ui/AppDatePicker";
import { getLastPublicProjectPath } from "../../utils/publicNavigation";

const APP_KEY = "app_draft";

const PersonalDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  // Persist applicationId in sessionStorage so it survives navigation
  useEffect(() => {
    const stateId = location.state?.applicationId;
    if (stateId) {
      const existing = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
      sessionStorage.setItem(
        APP_KEY,
        JSON.stringify({
          ...existing,
          applicationId: stateId,
          jobId: location.state?.jobId,
        }),
      );
    }
  }, [location.state]);

  const applicationId = (() => {
    try {
      return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
    } catch {
      return null;
    }
  })();
  const isReviewEdit = Boolean(location.state?.returnToReview);

  const [formData, setFormData] = useState({
    fullName: "",
    fatherName: "",
    motherName: "",
    maritalStatus: "",
    religion: "",
    identificationMark: "",
    dateOfBirth: "",
    gender: "",
    category: "",
    isDomicileOfBihar: null,
    registeredMobile: "",
  });
  const [errors, setErrors] = useState({});
  const [dataLoaded, setDataLoaded] = useState(false);
  const configuredFieldsRef = useRef(null);

  // Load existing application data
  const { data: appData, isLoading: loadingApp } = useQuery({
    queryKey: ["application-personal", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  // Populate form with existing data once loaded
  useEffect(() => {
    if (appData) {
      const app = appData?.application || appData;
      const p = app?.personalDetails || {};
      if (p && Object.keys(p).length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFormData({
          fullName: p.fullName || "",
          fatherName: p.fatherName || "",
          motherName: p.motherName || "",
          maritalStatus: p.maritalStatus || "",
          religion: p.religion || "",
          identificationMark: p.identificationMark || "",
          dateOfBirth: p.dateOfBirth ? p.dateOfBirth.split("T")[0] : "",
          gender: p.gender || "",
          category: p.category || "",
          isDomicileOfBihar:
            p.isDomicileOfBihar != null ? p.isDomicileOfBihar : null,
          registeredMobile: p.registeredMobile || "",
        });
      }
      setDataLoaded(true);
    }
  }, [appData]);

  const app = appData?.application || appData;
  const isPaymentPaid = app?.paymentStatus === "paid";

  const { mutate: saveStep, isPending } = useMutation({
    mutationFn: (data) =>
      candidateService.savePersonalDetails(applicationId, data),
    onSuccess: (result) => {
      toast.success("Personal details saved");
      const latestApplication = result?.application || result || app;
      queryClient.setQueryData(["application-personal", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-payment", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-layout", applicationId], {
        application: latestApplication,
      });
      // If editing from Review, go back to Review
      if (location.state?.returnToReview) {
        navigate("/application/review", { state: { applicationId } });
      } else {
        const steps = buildApplicationSteps(
          latestApplication?.jobId || app?.jobId,
          latestApplication,
        );
        const personalStep = steps.find(
          (step) => step.type === "personal-details",
        );
        const nextStep = steps.find((step) => step.id === personalStep?.id + 1);
        navigate(nextStep?.path || "/application/education", {
          state: { applicationId },
        });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });

  const set = (field, value) => {
    if (field === "category" && isPaymentPaid) {
      toast.error("Category is locked after payment");
      return;
    }
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const validate = () => {
    const e = {};
    if (!formData.fullName.trim()) e.fullName = "Full name is required";
    if (!formData.dateOfBirth) e.dateOfBirth = "Date of birth is required";
    if (!formData.gender) e.gender = "Gender is required";
    if (!formData.category) e.category = "Category is required";
    if (!formData.registeredMobile)
      e.registeredMobile = "Mobile number is required";
    else if (!/^[6-9]\d{9}$/.test(formData.registeredMobile))
      e.registeredMobile = "Invalid mobile number";
    if (formData.isDomicileOfBihar === null)
      e.isDomicileOfBihar = "Please select";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = async () => {
    if (!applicationId) {
      toast.error("Application not found. Please start from a job listing.");
      navigate(getLastPublicProjectPath());
      return;
    }
    if (!validate()) return;
    const extraSaved = await configuredFieldsRef.current?.validateAndSave?.();
    if (extraSaved === false) return;
    saveStep({
      fullName: formData.fullName.trim(),
      fatherName: formData.fatherName.trim() || undefined,
      motherName: formData.motherName.trim() || undefined,
      maritalStatus: formData.maritalStatus || undefined,
      religion: formData.religion.trim() || undefined,
      identificationMark: formData.identificationMark.trim() || undefined,
      dateOfBirth: formData.dateOfBirth,
      gender: formData.gender,
      category: formData.category,
      isDomicileOfBihar: formData.isDomicileOfBihar,
      registeredMobile: formData.registeredMobile,
    });
  };

  const inputClass = (field) =>
    `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors[field] ? "border-red-400" : "border-gray-300"}`;

  const dobInitialViewDate = new Date(new Date().getFullYear() - 22, 0, 1);

  if (loadingApp && !dataLoaded) {
    return (
      <ApplicationLayout currentStep={1} title="Personal Details">
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
    <ApplicationLayout currentStep={1} title="Personal Details">
      <div className="space-y-6">
        {!applicationId && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-yellow-800 text-sm">
            No application found. Please go to a job listing and click "Apply
            Now" to start.
          </div>
        )}

        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              Personal Details
            </h2>
            <p className="text-gray-600">
              Please provide your legal identification details exactly as they
              appear on your secondary school certificate.
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Basic Identity */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                BASIC IDENTITY
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Candidate Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className={inputClass("fullName")}
                    placeholder="Enter your full name"
                    value={formData.fullName}
                    onChange={(e) => set("fullName", e.target.value)}
                  />
                  {errors.fullName && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.fullName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Father Full Name
                  </label>
                  <input
                    type="text"
                    className={inputClass("fatherName")}
                    placeholder="Enter your Father full name"
                    value={formData.fatherName}
                    onChange={(e) => set("fatherName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mother Full Name
                  </label>
                  <input
                    type="text"
                    className={inputClass("motherName")}
                    placeholder="Enter your Mother full name"
                    value={formData.motherName}
                    onChange={(e) => set("motherName", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marital Status
                  </label>
                  <CustomSelect
                    className={inputClass("maritalStatus")}
                    value={formData.maritalStatus}
                    onChange={(val) => set("maritalStatus", val)}
                    options={[
                      { value: "", label: "Select" },
                      { value: "single", label: "Single" },
                      { value: "married", label: "Married" },
                      { value: "divorced", label: "Divorced" },
                      { value: "widowed", label: "Widowed" }
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Religion
                  </label>
                  <input
                    type="text"
                    className={inputClass("religion")}
                    placeholder="Enter Your Religion"
                    value={formData.religion}
                    onChange={(e) => set("religion", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Identification Mark
                  </label>
                  <input
                    type="text"
                    className={inputClass("identificationMark")}
                    placeholder="Enter your Identification Mark"
                    value={formData.identificationMark}
                    onChange={(e) => set("identificationMark", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Personal Information */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                PERSONAL INFORMATION
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <AppDatePicker
                    value={formData.dateOfBirth}
                    onChange={(value) => set("dateOfBirth", value)}
                    placeholder="Select date of birth"
                    className={`!h-[54px] !min-h-0 !px-4 !py-0 rounded-lg text-base font-normal ${errors.dateOfBirth ? "border-red-400" : "border-gray-300"}`}
                    error={Boolean(errors.dateOfBirth)}
                    maxDate={new Date()}
                    initialViewDate={dobInitialViewDate}
                  />
                  {errors.dateOfBirth && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.dateOfBirth}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    className={inputClass("gender")}
                    value={formData.gender}
                    onChange={(val) => set("gender", val)}
                    options={[
                      { value: "", label: "Select Gender" },
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "other", label: "Other" }
                    ]}
                  />
                  {errors.gender && (
                    <p className="text-red-500 text-xs mt-1">{errors.gender}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    className={inputClass("category")}
                    value={formData.category}
                    onChange={(val) => set("category", val)}
                    disabled={isPaymentPaid}
                    options={[
                      { value: "", label: "Select Category" },
                      { value: "general", label: "General" },
                      { value: "obc", label: "OBC" },
                      { value: "sc", label: "SC" },
                      { value: "st", label: "ST" },
                      { value: "ews", label: "EWS" }
                    ]}
                  />
                  {errors.category && (
                    <p className="text-red-500 text-xs mt-1">
                      {errors.category}
                    </p>
                  )}
                  {isPaymentPaid && (
                    <p className="text-xs text-orange-700 mt-1">
                      Category is locked after payment because the fee is based
                      on it.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Domicile */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                ELIGIBILITY & QUOTA
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domicile of Bihar? <span className="text-red-500">*</span>
                </label>
                <p className="text-sm text-gray-600 mb-3">
                  Are you a permanent resident of Bihar?
                </p>
                <div className="flex space-x-4">
                  {[true, false].map((val) => (
                    <button
                      key={String(val)}
                      type="button"
                      onClick={() => set("isDomicileOfBihar", val)}
                      className={`px-6 py-2 rounded-lg ${formData.isDomicileOfBihar === val ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                    >
                      {val ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
                {errors.isDomicileOfBihar && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.isDomicileOfBihar}
                  </p>
                )}
              </div>
            </div>

            {/* Contact */}
            <div>
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                CONTACT INFORMATION
              </h3>
              <div className="max-w-sm">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Registered Mobile Number{" "}
                  <span className="text-red-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 py-3 border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm rounded-l-lg">
                    +91
                  </span>
                  <input
                    type="tel"
                    maxLength={10}
                    placeholder="98765 43210"
                    className={`flex-1 px-4 py-3 border rounded-r-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${errors.registeredMobile ? "border-red-400" : "border-gray-300"}`}
                    value={formData.registeredMobile}
                    onChange={(e) =>
                      set("registeredMobile", e.target.value.replace(/\D/g, ""))
                    }
                  />
                </div>
                {errors.registeredMobile && (
                  <p className="text-red-500 text-xs mt-1">
                    {errors.registeredMobile}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <JobConfiguredSection
          ref={configuredFieldsRef}
          app={app}
          applicationId={applicationId}
          systemSource="personal"
        />

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          <strong>Important:</strong> Please ensure all data matches your
          10th/12th Education Certificate. Once submitted, personal details
          cannot be amended.
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate(getLastPublicProjectPath())}>
            Cancel
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
              isReviewEdit ? "Save & Return to Review" : "Save & Continue"
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default PersonalDetails;
