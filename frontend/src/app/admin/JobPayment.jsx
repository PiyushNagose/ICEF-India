import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import AdminLayout from "../../components/layouts/AdminLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import AppDatePicker from "../../components/ui/AppDatePicker";
import JobStepProgress from "./JobStepProgress";
import {
  ArrowRight,
  ArrowLeft,
  CreditCard,
  IndianRupee,
  Percent,
  Shield,
  Info,
  CheckCircle,
  FileCheck2,
} from "lucide-react";

const FeeInput = ({
  label,
  field,
  value,
  onChange,
  hint,
  prefix = "Rs.",
  suffix = "",
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label}
      {hint && <span className="ml-1 text-xs text-gray-400">({hint})</span>}
    </label>
    <div className="relative">
      <span className={`${prefix ? "absolute left-3 top-1/2 -translate-y-1/2 w-8 text-gray-400 text-sm pointer-events-none" : "hidden"}`}>
        {prefix}
      </span>
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
          {suffix}
        </span>
      )}
      <input
        type="number"
        min="0"
        step={suffix === "%" ? "0.01" : "1"}
        value={value}
        onChange={(e) => onChange(field, e.target.value)}
        className={`w-full ${prefix ? "pl-12" : "pl-4"} ${suffix ? "pr-9" : "pr-4"} py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm`}
        placeholder="0"
      />
    </div>
  </div>
);

const JobPayment = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedDraft = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("job_draft") || "{}");
    } catch {
      return {};
    }
  })();
  const projectId = searchParams.get("project") || savedDraft.projectId || null;
  const returnToReview = searchParams.get("returnTo") === "review";

  const [config, setConfig] = useState(() => {
    const saved = savedDraft;
    const af = saved.applicationFee || {};
    const pc = saved.paymentConfig || {};
    const methods = pc.paymentMethods || ["razorpay"];
    return {
      // Per-category application fees
      general: af.general ?? pc.applicationFee ?? "",
      obc: af.obc ?? "",
      scSt: af.scSt ?? af.scst ?? 0,
      ews: af.ews ?? "",
      pwd: af.pwd ?? 0,
      processingFee: pc.processingFee ?? "",
      paymentTiming: pc.paymentTiming || "final",
      refundPolicy: pc.refundPolicy ?? "",
      paymentDeadline: pc.paymentDeadline ?? "",
      paymentMethods: {
        razorpay: methods.includes("razorpay"),
        payu: methods.includes("payu"),
        ccavenue: methods.includes("ccavenue"),
      },
    };
  });
  const [errors, setErrors] = useState({});

  const set = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };
  const setMethod = (method, enabled) =>
    setConfig((prev) => ({
      ...prev,
      paymentMethods: { ...prev.paymentMethods, [method]: enabled },
    }));

  const handleNext = () => {
    const nextErrors = {};
    if (
      savedDraft.applicationDeadline &&
      config.paymentDeadline &&
      config.paymentDeadline < savedDraft.applicationDeadline
    ) {
      nextErrors.paymentDeadline =
        "Payment deadline cannot be before application deadline";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const existing = JSON.parse(sessionStorage.getItem("job_draft") || "{}");
    const enabledMethods = Object.entries(config.paymentMethods)
      .filter(([, v]) => v)
      .map(([k]) => k);

    sessionStorage.setItem(
      "job_draft",
      JSON.stringify({
        ...existing,
        // applicationFee stored at top level for the Job model
        applicationFee: {
          general: Number(config.general) || 0,
          obc: Number(config.obc) || Number(config.general) || 0,
          scSt: Number(config.scSt) || 0,
          ews: Number(config.ews) || Number(config.general) || 0,
          pwd: Number(config.pwd) || 0,
        },
        paymentConfig: {
          applicationFee: Number(config.general) || 0, // backward compat
          processingFee: Number(config.processingFee) || 0,
          paymentTiming: config.paymentTiming || "final",
          paymentMethods: enabledMethods,
          refundPolicy: config.refundPolicy || undefined,
          paymentDeadline: config.paymentDeadline || undefined,
        },
      }),
    );
    navigate(
      `/admin/jobs/create/review${projectId ? `?project=${projectId}` : ""}`,
    );
  };

  const generalFee = Number(config.general) || 0;
  const processingPercent = Math.max(0, Number(config.processingFee) || 0);
  const processingForGeneral = Math.round((generalFee * processingPercent) / 100);
  const preview = [
    { cat: "General", fee: Number(config.general) || 0 },
    { cat: "OBC", fee: Number(config.obc) || Number(config.general) || 0 },
    { cat: "SC/ST", fee: Number(config.scSt) || 0 },
    { cat: "EWS", fee: Number(config.ews) || Number(config.general) || 0 },
    { cat: "PwD", fee: Number(config.pwd) || 0 },
  ];

  return (
    <AdminLayout title="Create Job - Payment">
      <div className="p-4 sm:p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap justify-between items-start gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Create Job Posting
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                Step 5 of 6: Payment Configuration
              </p>
            </div>
          </div>

          <JobStepProgress currentStep={5} projectId={projectId} clickable />

          <div className="grid grid-cols-1 items-stretch lg:grid-cols-3 gap-6">
            {/* Main Form */}
            <div className="lg:col-span-2 space-y-6">
              {/* Category-wise Application Fee */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <IndianRupee className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Application Fee by Category
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Set different fees for each candidate category. Leave blank
                    to use General fee. SC/ST and PwD are typically free as per
                    government norms.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FeeInput
                      label="General Category *"
                      field="general"
                      value={config.general}
                      onChange={set}
                      hint="required"
                    />
                    <FeeInput
                      label="OBC Category"
                      field="obc"
                      value={config.obc}
                      onChange={set}
                      hint="leave blank = same as General"
                    />
                    <FeeInput
                      label="SC / ST Category"
                      field="scSt"
                      value={config.scSt}
                      onChange={set}
                      hint="usually Rs.0"
                    />
                    <FeeInput
                      label="EWS Category"
                      field="ews"
                      value={config.ews}
                      onChange={set}
                      hint="leave blank = same as General"
                    />
                    <FeeInput
                      label="PwD (Persons with Disability)"
                      field="pwd"
                      value={config.pwd}
                      onChange={set}
                      hint="usually Rs.0"
                    />
                  </div>

                  {/* Live preview */}
                  <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                    <p className="text-xs font-semibold text-orange-800 mb-3 flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      Fee Preview - what each candidate will see
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                      {preview.map(({ cat, fee }) => (
                        <div
                          key={cat}
                          className="bg-white border border-orange-100 rounded-lg p-2.5 text-center"
                        >
                          <p className="text-xs text-gray-500 mb-1">{cat}</p>
                          <p
                            className={`font-bold text-sm ${fee === 0 ? "text-green-600" : "text-orange-600"}`}
                          >
                            {fee === 0
                              ? "Free"
                              : `Rs.${fee.toLocaleString("en-IN")}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Timing */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Payment Step Position
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Choose when candidates pay in the application flow. Early
                    payment appears after Personal Details so category-wise fee
                    can be calculated correctly.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {[
                      {
                        value: "after_personal",
                        title: "After Personal Details",
                        desc: "Candidate verifies details, pays fee, then continues form, documents, review, and final submit.",
                        icon: CreditCard,
                      },
                      {
                        value: "final",
                        title: "Before Final Submit",
                        desc: "Candidate fills the full application first, reviews everything, then pays before submission.",
                        icon: FileCheck2,
                      },
                    ].map((option) => {
                      const selected = config.paymentTiming === option.value;
                      const Icon = option.icon;
                      return (
                        <button
                          type="button"
                          key={option.value}
                          onClick={() => set("paymentTiming", option.value)}
                          className={`relative rounded-xl border p-4 text-left transition-all ${
                            selected
                              ? "border-orange-500 bg-orange-50 shadow-sm"
                              : "border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
                                selected
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">
                                  {option.title}
                                </p>
                                {selected && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              <p className="mt-1 text-sm leading-5 text-gray-600">
                                {option.desc}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Processing Fee */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">Processing Fee</h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Set gateway/platform charge as a percentage of the candidate's application fee.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
                    <FeeInput
                      label="Processing Fee"
                      field="processingFee"
                      value={config.processingFee}
                      onChange={set}
                      hint="percentage"
                      prefix=""
                      suffix="%"
                    />
                    <div className="rounded-xl border border-orange-100 bg-orange-50 px-4 py-3">
                      <p className="text-xs font-medium text-orange-800">General fee preview</p>
                      <p className="mt-1 text-sm text-gray-700">
                        Rs.{generalFee.toLocaleString("en-IN")} + Rs.{processingForGeneral.toLocaleString("en-IN")} processing =
                        <span className="font-semibold text-orange-700">
                          {" "}Rs.{(generalFee + processingForGeneral).toLocaleString("en-IN")}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Deadline
                    </label>
                    <AppDatePicker
                      value={config.paymentDeadline}
                      onChange={(val) => set("paymentDeadline", val)}
                      placeholder="Select payment deadline"
                      showTimeSelect={true}
                    />
                    {errors.paymentDeadline && (
                      <p className="mt-1 text-xs text-red-500">
                        {errors.paymentDeadline}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Refund Policy
                    </label>
                    <textarea
                      value={config.refundPolicy}
                      onChange={(e) => set("refundPolicy", e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm resize-none"
                      placeholder="e.g. Application fee is non-refundable once submitted."
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-5">
              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-orange-600" />
                    <h3 className="font-semibold text-gray-900">
                      Payment Methods
                    </h3>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    ["razorpay", "Razorpay"],
                    ["payu", "PayU"],
                    ["ccavenue", "CCAvenue"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={config.paymentMethods[key]}
                        onChange={(e) => setMethod(key, e.target.checked)}
                        className="w-4 h-4 text-orange-600 rounded border-gray-300"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        {label}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs text-gray-400 mt-2">
                    Payment gateway will be configured by Finance Officer
                    separately.
                  </p>
                </CardContent>
              </Card>

              {/* Tips */}
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    <h3 className="font-semibold text-blue-800 text-sm">
                      Government Fee Norms
                    </h3>
                  </div>
                  <ul className="text-xs text-blue-700 space-y-1.5">
                    <li>- SC/ST candidates are usually exempt (Rs.0)</li>
                    <li>- PwD candidates are usually exempt (Rs.0)</li>
                    <li>- OBC fee is typically 50-60% of General fee</li>
                    <li>- EWS fee is typically same as General</li>
                    <li>- Ex-servicemen may get fee waiver</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Example */}
              <Card className="bg-gray-50 border-gray-200">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">
                    Typical Fee Structure Example
                  </p>
                  <div className="space-y-1 text-xs text-gray-600">
                    <div className="flex justify-between">
                      <span>General</span>
                      <span className="font-medium">Rs.500</span>
                    </div>
                    <div className="flex justify-between">
                      <span>OBC</span>
                      <span className="font-medium">Rs.300</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SC/ST</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                    <div className="flex justify-between">
                      <span>EWS</span>
                      <span className="font-medium">Rs.500</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PwD</span>
                      <span className="font-medium text-green-600">Free</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <Button
              onClick={() =>
                navigate(
                  `/admin/jobs/create/documents${projectId ? `?project=${projectId}` : ""}`,
                )
              }
              variant="outline"
              className="px-6"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back: Documents
            </Button>
            <Button
              onClick={handleNext}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8"
            >
              {returnToReview ? "Save & Return to Review" : "Next: Review"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default JobPayment;






