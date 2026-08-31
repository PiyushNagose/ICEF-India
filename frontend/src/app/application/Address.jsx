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
import { INDIA_STATE_CITIES, INDIA_STATES } from "../../constants/indiaLocations";
import { buildApplicationSteps } from "../../utils/applicationFlow";
import JobConfiguredSection from "./JobConfiguredSection";

const APP_KEY = "app_draft";
const getAppId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
  } catch {
    return null;
  }
};

const emptyAddr = () => ({
  addressLine1: "",
  addressLine2: "",
  state: "",
  district: "",
  policeStation: "",
  pincode: "",
});

// ── Defined OUTSIDE Address component to prevent remount on every keystroke ──
const AddressFields = ({ data, setFn, prefix, disabled, errors }) => {
  const inputCls = (errKey) =>
    `w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 ${
      errors[errKey] ? "border-red-400" : "border-gray-300"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address Line 1{" "}
          {prefix === "p" && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          disabled={disabled}
          className={inputCls(`${prefix}Addr1`)}
          placeholder="House No, Building Name, Street"
          value={data.addressLine1}
          onChange={(e) => setFn("addressLine1", e.target.value)}
        />
        {errors[`${prefix}Addr1`] && (
          <p className="text-red-500 text-xs mt-1">
            {errors[`${prefix}Addr1`]}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Address Line 2 (Optional)
        </label>
        <input
          type="text"
          disabled={disabled}
          className={inputCls("")}
          placeholder="Landmark, Locality"
          value={data.addressLine2}
          onChange={(e) => setFn("addressLine2", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            State {prefix === "p" && <span className="text-red-500">*</span>}
          </label>
          <CustomSelect
            disabled={disabled}
            className={inputCls(`${prefix}State`)}
            value={data.state}
            onChange={(val) => setFn("state", val)}
            options={[
              { value: "", label: "Select State" },
              ...INDIA_STATES.map((s) => ({ value: s, label: s }))
            ]}
          />
          {errors[`${prefix}State`] && (
            <p className="text-red-500 text-xs mt-1">
              {errors[`${prefix}State`]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            District {prefix === "p" && <span className="text-red-500">*</span>}
          </label>
          <CustomSelect
            disabled={disabled}
            className={inputCls(`${prefix}District`)}
            value={data.district}
            onChange={(val) => setFn("district", val)}
            options={[
              { value: "", label: "Select District" },
              ...(INDIA_STATE_CITIES[data.state] || []).map((d) => ({ value: d, label: d }))
            ]}
          />
          {errors[`${prefix}District`] && (
            <p className="text-red-500 text-xs mt-1">
              {errors[`${prefix}District`]}
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Police Station
          </label>
          <input
            type="text"
            disabled={disabled}
            className={inputCls("")}
            placeholder="Name of Police Station"
            value={data.policeStation}
            onChange={(e) => setFn("policeStation", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pincode {prefix === "p" && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            maxLength={6}
            disabled={disabled}
            className={inputCls(`${prefix}Pincode`)}
            placeholder="6 digit code"
            value={data.pincode}
            onChange={(e) =>
              setFn("pincode", e.target.value.replace(/\D/g, ""))
            }
          />
          {errors[`${prefix}Pincode`] && (
            <p className="text-red-500 text-xs mt-1">
              {errors[`${prefix}Pincode`]}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────

const Address = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

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
  const isReviewEdit = Boolean(location.state?.returnToReview);
  const [dataLoaded, setDataLoaded] = useState(false);
  const configuredFieldsRef = useRef(null);

  const [jobId, setJobId] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").jobId;
    } catch {
      return null;
    }
  });

  const [permanent, setPermanent] = useState(emptyAddr());
  const [correspondence, setCorrespondence] = useState(emptyAddr());
  const [sameAsPermanent, setSameAsPermanent] = useState(false);
  const [errors, setErrors] = useState({});

  // Load job details to check for custom form sections
  const { data: jobData } = useQuery({
    queryKey: ["job-details-for-address", jobId],
    queryFn: () => candidateService.getJobDetails(jobId),
    enabled: Boolean(jobId),
  });

  // Load existing data
  const { data: appData, isLoading: loadingApp } = useQuery({
    queryKey: ["application-address", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (appData && !jobId) {
      const app = appData?.application || appData;
      const resolvedJobId = app?.jobId?._id || app?.jobId;
      if (resolvedJobId) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setJobId(resolvedJobId);
        const existing = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
        sessionStorage.setItem(
          APP_KEY,
          JSON.stringify({ ...existing, jobId: resolvedJobId }),
        );
      }
    }
  }, [appData, jobId]);

  useEffect(() => {
    if (appData) {
      const app = appData?.application || appData;
      const addr = app?.address || {};
      if (addr?.permanent) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPermanent({
          addressLine1: addr.permanent.addressLine1 || "",
          addressLine2: addr.permanent.addressLine2 || "",
          state: addr.permanent.state || "",
          district: addr.permanent.district || "",
          policeStation: addr.permanent.policeStation || "",
          pincode: addr.permanent.pincode || "",
        });
      }
      if (addr?.correspondence) {
        setCorrespondence({
          addressLine1: addr.correspondence.addressLine1 || "",
          addressLine2: addr.correspondence.addressLine2 || "",
          state: addr.correspondence.state || "",
          district: addr.correspondence.district || "",
          policeStation: addr.correspondence.policeStation || "",
          pincode: addr.correspondence.pincode || "",
        });
      }
      if (addr?.sameAsPermanent) setSameAsPermanent(true);
      setDataLoaded(true);
    }
  }, [appData]);

  const setP = (field, value) =>
    setPermanent((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "state" ? { district: "" } : {}),
    }));
  const setC = (field, value) =>
    setCorrespondence((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "state" ? { district: "" } : {}),
    }));

  const handleSameToggle = (checked) => {
    setSameAsPermanent(checked);
    if (checked) setCorrespondence({ ...permanent });
  };

  const { mutate: saveStep, isPending } = useMutation({
    mutationFn: (data) => candidateService.saveAddress(applicationId, data),
    onSuccess: (result) => {
      toast.success("Address saved");
      const latestApplication = result?.application || result || appData?.application || appData;
      queryClient.setQueryData(["application-layout", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-address", applicationId], {
        application: latestApplication,
      });
      if (location.state?.returnToReview) {
        navigate("/application/review", { state: { applicationId } });
      } else {
        const app = latestApplication;
        const job = jobData?.job || jobData || app?.jobId;
        const steps = buildApplicationSteps(job, app);
        const addressStep = steps.find((step) => step.type === "address")?.id || 4;
        const nextStep = steps.find((step) => step.id === addressStep + 1);
        navigate(nextStep?.path || "/application/review", {
          state: { applicationId },
        });
      }
    },
    onError: (err) => toast.error(err.message || "Failed to save"),
  });

  const validate = () => {
    const e = {};
    if (!permanent.addressLine1.trim()) e.pAddr1 = "Address line 1 is required";
    if (!permanent.state) e.pState = "State is required";
    if (!permanent.district) e.pDistrict = "District is required";
    if (!permanent.pincode || !/^\d{6}$/.test(permanent.pincode))
      e.pPincode = "Valid 6-digit pincode required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const app = appData?.application || appData;

  const handleNext = async () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate("/jobs");
      return;
    }
    if (!validate()) return;
    const extraSaved = await configuredFieldsRef.current?.validateAndSave?.();
    if (extraSaved === false) return;
    saveStep({
      permanent,
      correspondence: sameAsPermanent ? permanent : correspondence,
      sameAsPermanent,
    });
  };

  if (loadingApp && !dataLoaded) {
    return (
      <ApplicationLayout currentStep={4} title="Address">
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
    <ApplicationLayout currentStep={4} title="Address">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">Address</h2>
            <p className="text-gray-600">
              Please provide your Permanent and Correspondence Address for
              verification.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Permanent Address */}
            <div className="border-l-4 border-orange-400 pl-6">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Permanent Address
              </h3>
              <AddressFields
                data={permanent}
                setFn={setP}
                prefix="p"
                disabled={false}
                errors={errors}
              />
            </div>

            {/* Correspondence Address */}
            <div className="border-l-4 border-blue-400 pl-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-800">
                  Correspondence Address
                </h3>
                <label className="flex items-center gap-2 bg-orange-600 text-white px-4 py-2 rounded-lg cursor-pointer hover:bg-orange-700">
                  <input
                    type="checkbox"
                    checked={sameAsPermanent}
                    onChange={(e) => handleSameToggle(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-medium text-white">Same as Permanent</span>
                </label>
              </div>
              <AddressFields
                data={correspondence}
                setFn={setC}
                prefix="c"
                disabled={sameAsPermanent}
                errors={errors}
              />
            </div>
          </CardContent>
        </Card>

        <JobConfiguredSection
          ref={configuredFieldsRef}
          app={app}
          applicationId={applicationId}
          systemSource="address"
        />

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              navigate("/application/additional-info", {
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
              isReviewEdit ? "Save & Return to Review" : "Save & Continue"
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default Address;
