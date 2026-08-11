import { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { ArrowDown, ArrowUp, Loader2, IndianRupee, Info } from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { candidateService } from "../../services/candidate.service";
import {
  buildApplicationSteps,
  getPaymentTiming,
  isCorrectionMode,
  readApplicationDraft,
} from "../../utils/applicationFlow";

const APP_KEY = "app_draft";
const getAppId = () => {
  try {
    return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId;
  } catch {
    return null;
  }
};

// Mirrors backend calculateFee() — fee based on candidate's category
const calculateFee = (feeConfig, category) => {
  if (!feeConfig) return 0;
  const cat = (category || "").toLowerCase();
  if (cat === "sc" || cat === "st")
    return feeConfig.scSt ?? feeConfig.scst ?? 0;
  if (cat === "pwd") return feeConfig.pwd ?? 0;
  if (cat === "obc") return feeConfig.obc ?? feeConfig.general ?? 0;
  if (cat === "ews") return feeConfig.ews ?? feeConfig.general ?? 0;
  return feeConfig.general ?? 0;
};

const CATEGORY_LABELS = {
  general: "General",
  obc: "OBC",
  sc: "SC",
  st: "ST",
  ews: "EWS",
  pwd: "PwD",
};

const PostSelection = () => {
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

  const applicationId = location.state?.applicationId || getAppId();
  const [selectedPosts, setSelectedPosts] = useState([]);

  const { data: appData, isLoading } = useQuery({
    queryKey: ["application-post-selection", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 2 * 60 * 1000,
  });

  const app = appData?.application || appData;
  const job = app?.jobId;
  const correctionMode =
    isCorrectionMode(app) || readApplicationDraft().correctionMode === true;
  const steps = buildApplicationSteps(job, app);
  const postStep =
    steps.find((step) => step.type === "post-selection")?.id || 1;
  const previousStep = steps.find((step) => step.id === postStep - 1);
  // In correction mode always go to Review after post selection (skip payment)
  const reviewStep = steps.find((step) => step.type === "review");
  const nextStep = correctionMode
    ? reviewStep
    : steps.find((step) => step.id === postStep + 1);

  // Candidate's category from Step 1 personal details
  const candidateCategory = app?.personalDetails?.category || "";
  const allowsPreference = job?.postSelectionMode === "preference";
  const paymentTiming = getPaymentTiming(job, app);
  const isEarlyPayment = paymentTiming === "after_personal";
  const categoryLabel =
    CATEGORY_LABELS[candidateCategory] || candidateCategory.toUpperCase();

  // Fee calculated based on candidate's actual category
  const applicationFee = calculateFee(job?.applicationFee, candidateCategory);
  const feeBreakdown = [];

  // Build available posts from job
  const availablePosts = useMemo(() => {
    if (!job) return [];
    if (job.posts?.length) {
      return job.posts
        .filter((p) => p.status !== "inactive")
        .map((p) => ({
          postId: p._id,
          jobId: job._id,
          postCode: p.postCode || "",
          title: p.title || p.designation || "",
          designation: p.designation || p.title || "",
          department: p.department || job.department || "",
          vacancies: p.vacancies || 0,
          payLevel: p.payLevel || "",
          location: p.location || job.workLocation || "",
        }));
    }
    // Single post job
    return [
      {
        postId: job._id,
        jobId: job._id,
        postCode: job.postCode || "",
        title: job.title || "Untitled Post",
        designation: job.title || "Untitled Post",
        department: job.department || "",
        vacancies: job.totalPosts || 0,
        payLevel: "",
        location: job.workLocation || "",
      },
    ];
  }, [job]);

  // Pre-fill saved selections
  useEffect(() => {
    if (app?.appliedPosts?.length > 0 && selectedPosts.length === 0) {
      const savedPosts = [...app.appliedPosts]
          .sort((a, b) => (a.preference || 0) - (b.preference || 0))
          .map((post, index) => ({
            postId: post.postId || post.jobId,
            jobId: post.jobId || job?._id,
            postCode: post.postCode || "",
            title: post.title || post.designation || "",
            designation: post.designation || post.title || "",
            department: post.department || "",
            vacancies: post.vacancies || 0,
            preference: post.preference || index + 1,
          }));
      setSelectedPosts(allowsPreference ? savedPosts : savedPosts.slice(0, 1));
    }
  }, [allowsPreference, app, job, selectedPosts.length]);

  const isSelected = (postId) => selectedPosts.some((p) => p.postId === postId);

  const normalizePreferences = (posts) =>
    posts.map((p, i) => ({ ...p, preference: i + 1 }));

  const togglePost = (post) => {
    if (isSelected(post.postId)) {
      setSelectedPosts((cur) =>
        normalizePreferences(cur.filter((p) => p.postId !== post.postId)),
      );
    } else {
      setSelectedPosts((cur) =>
        normalizePreferences(
          allowsPreference
            ? [...cur, { ...post, preference: cur.length + 1 }]
            : [{ ...post, preference: 1 }],
        ),
      );
    }
  };

  const movePost = (index, direction) => {
    const next = index + direction;
    if (next < 0 || next >= selectedPosts.length) return;
    setSelectedPosts((cur) => {
      const arr = [...cur];
      const [item] = arr.splice(index, 1);
      arr.splice(next, 0, item);
      return normalizePreferences(arr);
    });
  };

  const { mutate: savePostSelection, isPending } = useMutation({
    mutationFn: (data) =>
      candidateService.savePostSelection(applicationId, data),
    onSuccess: (result) => {
      toast.success(
        allowsPreference ? "Post preferences saved" : "Post selection saved",
      );
      const destination = correctionMode
        ? reviewStep?.path || "/application/review"
        : nextStep?.path || "/application/payment";
      navigate(destination, {
        state: {
          applicationId,
          totalFee: result?.totalFee ?? applicationFee,
          selectedPosts,
        },
      });
    },
    onError: (err) => {
      if (err?.errors?.length > 0) {
        toast.error(
          err.errors.map((e) => `${e.field}: ${e.message}`).join(", "),
        );
      } else {
        toast.error(err.message || "Failed to save post selection");
      }
    },
  });

  const handleNext = () => {
    if (!applicationId) {
      toast.error("Application not found");
      navigate("/jobs");
      return;
    }
    if (selectedPosts.length === 0) {
      toast.error("Please select at least one post");
      return;
    }
    savePostSelection({
      appliedPosts: selectedPosts.map((post, index) => ({
        jobId: job._id,
        postId: post.postId,
        postCode: post.postCode || "",
        title: post.title || post.designation || "",
        designation: post.designation || post.title || "",
        department: post.department || "",
        vacancies: post.vacancies || 0,
        preference: index + 1,
      })),
    });
  };

  return (
    <ApplicationLayout
      currentStep={postStep}
      title={allowsPreference ? "Post Preference Selection" : "Post Selection"}
    >
      <div className="space-y-6">
        {/* Fee info banner — shows candidate's applicable fee */}
        {!isEarlyPayment && candidateCategory && job?.applicationFee && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
            <IndianRupee className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-orange-800">
                Your Applicable Fee:{" "}
                <span className="text-lg">
                  ₹{applicationFee.toLocaleString("en-IN")}
                </span>
                <span className="ml-2 text-xs font-normal bg-orange-200 text-orange-800 px-2 py-0.5 rounded-full">
                  {categoryLabel} category
                </span>
              </p>
              <p className="text-xs text-orange-700 mt-1">
                Fee is determined by your category selected in Step 1 (Personal
                Details).
              </p>
              {/* Fee table */}
              {feeBreakdown.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {feeBreakdown.map(({ label, fee }) => (
                    <span
                      key={label}
                      className={`text-xs px-2 py-1 rounded-lg border ${
                        label
                          .toLowerCase()
                          .includes(candidateCategory.toLowerCase()) ||
                        (candidateCategory === "sc" && label === "SC/ST") ||
                        (candidateCategory === "st" && label === "SC/ST")
                          ? "bg-orange-600 text-white border-orange-600 font-semibold"
                          : "bg-white text-gray-600 border-gray-200"
                      }`}
                    >
                      {label}: ₹{fee}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Post selection */}
        <Card className="shadow-sm">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-800">
              {allowsPreference ? "Select Post Preferences" : "Select Post"}
            </h2>
            <p className="text-gray-600 text-sm">
              {allowsPreference
                ? "Select the posts you want to apply for and arrange them in preference order. Preference 1 is considered first during selection."
                : "Select one post to apply for under this advertisement."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading && (
              <div className="flex items-center gap-2 text-gray-500 py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading posts...
              </div>
            )}
            {!isLoading && availablePosts.length === 0 && (
              <p className="text-gray-500 text-sm py-4">
                No posts available for this application.
              </p>
            )}
            {availablePosts.map((post) => (
              <button
                type="button"
                key={post.postId}
                onClick={() => togglePost(post)}
                className={`w-full text-left border rounded-xl p-4 transition-all ${
                  isSelected(post.postId)
                    ? "border-orange-500 bg-orange-50"
                    : "border-gray-200 hover:border-orange-300 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <input
                      type={allowsPreference ? "checkbox" : "radio"}
                      readOnly
                      checked={isSelected(post.postId)}
                      className="mt-1 w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {post.designation || post.title}
                      </h3>
                      {post.designation !== post.title && (
                        <p className="text-sm text-gray-500 mt-0.5">
                          {post.title}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {post.postCode && (
                          <Badge
                            variant="outline"
                            className="text-xs font-mono"
                          >
                            {post.postCode}
                          </Badge>
                        )}
                        {post.department && (
                          <span className="text-xs text-gray-500">
                            {post.department}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {post.vacancies}{" "}
                          {post.vacancies === 1 ? "vacancy" : "vacancies"}
                        </span>
                        {post.payLevel && (
                          <span className="text-xs text-gray-500">
                            Pay: {post.payLevel}
                          </span>
                        )}
                        {post.location && (
                          <span className="text-xs text-gray-500">
                            {post.location}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {allowsPreference && isSelected(post.postId) && (
                    <div className="rounded-full bg-orange-600 text-white text-xs font-bold px-3 py-1 flex-shrink-0">
                      Pref{" "}
                      {
                        selectedPosts.find((p) => p.postId === post.postId)
                          ?.preference
                      }
                    </div>
                  )}
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Preference order + fee summary */}
        {allowsPreference && selectedPosts.length > 0 && (
          <Card className="shadow-sm bg-orange-50 border-orange-200">
            <CardHeader>
              <h3 className="text-lg font-semibold text-gray-800">
                Your Preference Order
              </h3>
              <p className="text-sm text-gray-600">
                Drag to reorder using the arrows. Preference 1 is your top
                choice.
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedPosts.map((post, index) => (
                  <div
                    key={post.postId}
                    className="flex items-center justify-between gap-3 bg-white border border-orange-100 rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {post.designation || post.title}
                        </p>
                        <p className="text-xs text-gray-500">
                          {post.postCode || "—"} · {post.vacancies} vacancies
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={index === 0}
                        onClick={() => movePost(index, -1)}
                        className="p-1.5"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={index === selectedPosts.length - 1}
                        onClick={() => movePost(index, 1)}
                        className="p-1.5"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {/* Fee summary */}
                {!isEarlyPayment && (
                <div className="border-t border-orange-200 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-gray-800">
                        Application Fee
                      </span>
                      {candidateCategory && (
                        <span className="ml-2 text-xs text-gray-500">
                          (
                          {CATEGORY_LABELS[candidateCategory] ||
                            candidateCategory.toUpperCase()}{" "}
                          rate)
                        </span>
                      )}
                    </div>
                    <span className="font-bold text-orange-600 text-xl">
                      ₹{applicationFee.toLocaleString("en-IN")}
                    </span>
                  </div>
                  {applicationFee === 0 && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ No application fee for your category
                    </p>
                  )}
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card className="shadow-sm border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <Info className="w-4 h-4" />
              {correctionMode
                ? "Correction Mode — Post Selection"
                : "Important Instructions"}
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {correctionMode ? (
                <>
                  <li>
                    {allowsPreference
                      ? 'Update your post preferences if needed, then click "Save & Continue to Review"'
                      : 'Update your selected post if needed, then click "Save & Continue to Review"'}
                  </li>
                  <li>• No additional payment is required for corrections</li>
                  <li>
                    • You will review and submit your changes on the next screen
                  </li>
                </>
              ) : (
                <>
                  <li>
                    {allowsPreference
                      ? "Preference order cannot be changed after final payment"
                      : "Selected post cannot be changed after final payment"}
                  </li>
                  <li>
                    {allowsPreference
                      ? "You must meet eligibility criteria for every selected post"
                      : "You must meet eligibility criteria for the selected post"}
                  </li>
                  <li>
                    • Application fee is charged once for this recruitment
                  </li>
                  <li>
                    • Fee is based on your category as filled in Personal
                    Details (Step 1)
                  </li>
                </>
              )}
            </ul>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() =>
              navigate(previousStep?.path || "/application/review", {
                state: { applicationId },
              })
            }
          >
            ← Back
          </Button>
          <Button
            onClick={handleNext}
            disabled={isPending || selectedPosts.length === 0}
            className="px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400"
          >
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : correctionMode || isEarlyPayment ? (
              "Save & Continue to Review →"
            ) : (
              "Proceed to Payment →"
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default PostSelection;
