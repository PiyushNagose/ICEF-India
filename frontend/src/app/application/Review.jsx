import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Loader2, CheckCircle, Edit3 } from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { candidateService } from "../../services/candidate.service";
import {
  buildApplicationSteps,
  isCorrectionMode,
} from "../../utils/applicationFlow";
import { getLastPublicProjectPath } from "../../utils/publicNavigation";

const APP_KEY = "app_draft";
const getAppId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
  } catch {
    return null;
  }
};

const getDraftJobId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").jobId;
  } catch {
    return null;
  }
};

const DECLARATION_TEXT =
  "I hereby declare that all the information provided in this application form is true, complete, and correct to the best of my knowledge and belief. I understand that in the event of any information being found false or incorrect or any ineligibility being detected before or after the examination, my candidature is liable to be cancelled/rejected.";

const Row = ({ label, value }) =>
  value ? (
    <div>
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </span>
      <p className="text-gray-900 text-sm mt-0.5">{value}</p>
    </div>
  ) : null;

const Review = () => {
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
  const [declaration, setDeclaration] = useState(DECLARATION_TEXT);
  const [accepted, setAccepted] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["application-review", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
  });

  const app = data?.application || data;
  const jobId = app?.jobId?._id || app?.jobId || getDraftJobId();

  useEffect(() => {
    if (jobId) {
      const existing = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
      if (existing.jobId !== jobId) {
        sessionStorage.setItem(
          APP_KEY,
          JSON.stringify({ ...existing, jobId }),
        );
      }
    }
  }, [jobId]);

  const { data: jobData } = useQuery({
    queryKey: ["job-details-review", jobId],
    queryFn: () => candidateService.getJobDetails(jobId),
    enabled: Boolean(jobId),
  });

  const job = app?.jobId || jobData?.job || jobData;
  const correctionMode = isCorrectionMode(app);
  const steps = buildApplicationSteps(job, app);
  const reviewStep = steps.find((step) => step.type === "review")?.id || 1;
  const previousStep = steps.find((step) => step.id === reviewStep - 1);
  const nextStep = steps.find((step) => step.id === reviewStep + 1);

  // In correction mode: submit correction directly from review (skip payment)
  const { mutate: doSubmitCorrection, isPending: isSubmittingCorrection } =
    useMutation({
      mutationFn: () =>
        candidateService.submitCorrection(applicationId, declaration),
      onSuccess: () => {
        navigate("/application/success", {
          state: { applicationId, correctionMode: true },
        });
      },
      onError: (err) =>
        toast.error(err.message || "Failed to submit corrections"),
    });

  const { mutate: saveReview, isPending: isSavingReview } = useMutation({
    mutationFn: () => candidateService.submitApplication(applicationId, declaration),
    onSuccess: (result) => {
      const latestApplication = result?.application || result || app;
      queryClient.setQueryData(["application-layout", applicationId], {
        application: latestApplication,
      });
      queryClient.setQueryData(["application-review", applicationId], {
        application: latestApplication,
      });
      navigate(nextStep?.path || "/application/success", {
        state: { applicationId },
      });
    },
    onError: (err) => toast.error(err.message || "Failed to save review"),
  });

  // Review just navigates forward — no API call needed here.
  // Declaration is saved during finalize (after payment).
  const handleNext = () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate(getLastPublicProjectPath());
      return;
    }
    if (!accepted) {
      toast.error("Please accept the declaration to continue");
      return;
    }
    // Store declaration in sessionStorage so Payment/Finalize can use it
    const existing = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
    sessionStorage.setItem(
      APP_KEY,
      JSON.stringify({ ...existing, declaration }),
    );

    if (correctionMode) {
      // In correction mode: submit corrections now — no payment needed
      doSubmitCorrection();
      return;
    }

    saveReview();
  };

  if (!applicationId)
    return (
      <ApplicationLayout currentStep={reviewStep} title="Review">
        <div className="p-6 text-center text-gray-500">
          No application found.{" "}
          <button
            onClick={() => navigate(getLastPublicProjectPath())}
            className="text-orange-600 underline"
          >
            Return to recruitment
          </button>
        </div>
      </ApplicationLayout>
    );

  const personal = app?.personalDetails || {};
  const education = app?.education || {};
  const additional = app?.additionalInfo || {};
  const address = app?.address || {};
  const documents = app?.documents || [];
  const formResponses = app?.formResponses || {};

  // Create field label map from job's formSections
  const fieldLabelMap = {};
  const jobForLabels = jobData?.job || jobData || app?.jobId;
  (jobForLabels?.formSections || []).forEach((section) => {
    (section.fields || []).forEach((field) => {
      fieldLabelMap[String(field._id)] = field.label;
    });
  });

  return (
    <ApplicationLayout currentStep={reviewStep} title="Review your Application">
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              Review your Application
            </h2>
            <p className="text-gray-600">
              Please verify all information before final submission. You can
              edit any section before submitting.
            </p>
          </CardHeader>
          <CardContent className="space-y-8">
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading application data...
              </div>
            )}

            {/* Personal Details */}
            {Object.keys(personal).length > 0 && (
              <div className="border-l-4 border-orange-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    Personal Details
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/personal-details", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Row label="Full Name" value={personal.fullName} />
                  <Row
                    label="Date of Birth"
                    value={
                      personal.dateOfBirth
                        ? new Date(personal.dateOfBirth).toLocaleDateString(
                            "en-IN",
                          )
                        : null
                    }
                  />
                  <Row label="Gender" value={personal.gender} />
                  <Row
                    label="Category"
                    value={personal.category?.toUpperCase()}
                  />
                  <Row label="Father's Name" value={personal.fatherName} />
                  <Row label="Mother's Name" value={personal.motherName} />
                  <Row label="Marital Status" value={personal.maritalStatus} />
                  <Row label="Religion" value={personal.religion} />
                  <Row
                    label="Bihar Domicile"
                    value={
                      personal.isDomicileOfBihar != null
                        ? personal.isDomicileOfBihar
                          ? "Yes"
                          : "No"
                        : null
                    }
                  />
                  <Row label="Mobile" value={personal.registeredMobile} />
                </div>
              </div>
            )}

            {/* Education */}
            {(education.tenth || education.twelfth || education.graduation) && (
              <div className="border-l-4 border-orange-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    Educational Qualifications
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/education", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="space-y-3">
                  {education.tenth && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                      <Row label="Level" value="10th Class" />
                      <Row label="Board" value={education.tenth.board} />
                      <Row label="Year" value={education.tenth.year} />
                      <Row
                        label="Percentage"
                        value={
                          education.tenth.percentage
                            ? `${education.tenth.percentage}%`
                            : null
                        }
                      />
                    </div>
                  )}
                  {education.twelfth && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                      <Row label="Level" value="12th Class" />
                      <Row label="Board" value={education.twelfth.board} />
                      <Row label="Year" value={education.twelfth.year} />
                      <Row
                        label="Percentage"
                        value={
                          education.twelfth.percentage
                            ? `${education.twelfth.percentage}%`
                            : null
                        }
                      />
                    </div>
                  )}
                  {education.graduation && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm p-3 bg-gray-50 rounded-lg">
                      <Row label="Level" value="Graduation" />
                      <Row label="Degree" value={education.graduation.degree} />
                      <Row label="Year" value={education.graduation.year} />
                      <Row
                        label="Percentage"
                        value={
                          education.graduation.percentage
                            ? `${education.graduation.percentage}%`
                            : null
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Info */}
            {additional && Object.keys(additional).length > 0 && (
              <div className="border-l-4 border-yellow-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    Additional Information
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/additional-info", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Row
                    label="Govt Employee"
                    value={additional.isGovtEmployee ? "Yes" : "No"}
                  />
                  {additional.isGovtEmployee && (
                    <Row label="Department" value={additional.departmentName} />
                  )}
                  <Row
                    label="Ex-Serviceman"
                    value={additional.isExServiceman ? "Yes" : "No"}
                  />
                  <Row label="PwD" value={additional.isPwD ? "Yes" : "No"} />
                  {additional.drivingLicense && (
                    <Row
                      label="Driving License"
                      value={additional.drivingLicense}
                    />
                  )}
                  {additional.computerCertificate && (
                    <Row
                      label="Computer Certificate"
                      value={additional.computerCertificate}
                    />
                  )}
                </div>
              </div>
            )}

            {/* Address */}
            {address.permanent && (
              <div className="border-l-4 border-orange-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">Address</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/address", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                      Permanent
                    </p>
                    <p className="text-gray-900">
                      {[
                        address.permanent.addressLine1,
                        address.permanent.district,
                        address.permanent.state,
                        address.permanent.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  {!address.sameAsPermanent && address.correspondence && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase mb-1">
                        Correspondence
                      </p>
                      <p className="text-gray-900">
                        {[
                          address.correspondence.addressLine1,
                          address.correspondence.district,
                          address.correspondence.state,
                          address.correspondence.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Dynamic Form Responses */}
            {Object.keys(formResponses).length > 0 && (
              <div className="border-l-4 border-orange-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    Custom Fields
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/form-responses?section=0", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(formResponses).map(([fieldId, value]) => (
                    <Row
                      key={fieldId}
                      label={fieldLabelMap[fieldId] || fieldId}
                      value={
                        typeof value === "boolean"
                          ? value
                            ? "Yes"
                            : "No"
                          : String(value)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Documents */}
            {documents.length > 0 && (
              <div className="border-l-4 border-green-400 pl-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-medium text-gray-800">
                    Uploaded Documents (
                    {documents.filter((d) => d.status === "uploaded").length}/
                    {documents.length})
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-orange-600 border-orange-200"
                    onClick={() =>
                      navigate("/application/documents", {
                        state: { applicationId, returnToReview: true },
                      })
                    }
                  >
                    Edit
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {documents.map((doc) => (
                    <div
                      key={doc._id || doc.type}
                      className="flex items-center gap-2 p-3 bg-green-50 rounded-lg"
                    >
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm text-gray-800 capitalize">
                        {doc.type.replace(/_/g, " ")}
                      </span>
                      <span
                        className={`ml-auto text-xs font-medium ${doc.status === "uploaded" ? "text-green-600" : "text-yellow-600"}`}
                      >
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Correction Mode Banner */}
            {correctionMode && (
              <div className="border border-orange-300 bg-orange-50 rounded-lg p-4 flex items-start gap-3">
                <Edit3 className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-800 text-sm">
                    Correction Mode
                  </p>
                  <p className="text-orange-700 text-sm mt-0.5">
                    You are reviewing corrections requested by the admin. Once
                    you accept the declaration and submit, your changes will be
                    sent for re-review. No additional payment is required.
                  </p>
                </div>
              </div>
            )}

            {/* Declaration */}
            <div className="bg-gray-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-4">
                Final Declaration
              </h3>
              <textarea
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm"
                rows="4"
                value={declaration}
                onChange={(e) => setDeclaration(e.target.value)}
              />
              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <span className="text-sm text-gray-700">
                  I have read and accept the above declaration. I confirm all
                  information provided is accurate.
                </span>
              </label>
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
            disabled={
              !accepted ||
              !applicationId ||
              isSubmittingCorrection ||
              isSavingReview
            }
            className="px-6 bg-orange-600 hover:bg-orange-700"
          >
            {isSubmittingCorrection || isSavingReview ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {correctionMode ? "Submitting Corrections..." : "Saving..."}
              </>
            ) : correctionMode ? (
              "Submit Corrections →"
            ) : (
              "Continue →"
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default Review;
