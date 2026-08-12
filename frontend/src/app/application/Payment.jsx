import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  CreditCard, Smartphone, Building, Shield,
  AlertCircle, Loader2, CheckCircle, ArrowLeft,
  IndianRupee, QrCode, RefreshCw,
} from "lucide-react";
import ApplicationLayout from "../../components/layouts/ApplicationLayout";
import { Card, CardContent, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { candidateService } from "../../services/candidate.service";
import { buildApplicationSteps, getPaymentTiming } from "../../utils/applicationFlow";

const APP_KEY = "app_draft";
const getAppId = () => {
  try { return JSON.parse(sessionStorage.getItem(APP_KEY) || "{}").applicationId; }
  catch { return null; }
};

const METHODS = [
  { id: "upi",        name: "UPI Payment",         icon: Smartphone, desc: "PhonePe, Google Pay, Paytm, BHIM" },
  { id: "upi_qr",    name: "UPI QR Code",          icon: QrCode,     desc: "Scan & pay with any UPI app" },
  { id: "card",      name: "Credit / Debit Card",  icon: CreditCard, desc: "Visa, Mastercard, RuPay accepted" },
  { id: "netbanking",name: "Net Banking",           icon: Building,   desc: "All major banks supported" },
];

const CATEGORY_LABELS = {
  general: "General", obc: "OBC", sc: "SC", st: "ST", ews: "EWS", pwd: "PwD",
};

const calculateCategoryFee = (feeConfig = {}, category = "") => {
  const cat = String(category || "").toLowerCase().replace(/[^a-z]/g, "");
  if (cat.includes("pwd") || cat.includes("ph") || cat.includes("disabled")) {
    return Number(feeConfig.pwd ?? 0);
  }
  if (cat.includes("sc") || cat.includes("st")) {
    return Number(feeConfig.scSt ?? feeConfig.scst ?? 0);
  }
  if (cat.includes("obc")) {
    return Number(feeConfig.obc ?? feeConfig.general ?? 0);
  }
  if (cat.includes("ews")) {
    return Number(feeConfig.ews ?? feeConfig.general ?? 0);
  }
  return Number(feeConfig.general ?? feeConfig.amount ?? 0);
};

// Load Razorpay checkout and open it
const openRazorpayCheckout = (options) =>
  new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("Razorpay SDK not loaded. Please refresh the page."));
      return;
    }
    const rzp = new window.Razorpay({
      ...options,
      handler: (response) => resolve(response),
      modal: { ondismiss: () => reject(new Error("Payment cancelled by user")) },
    });
    rzp.on("payment.failed", (response) => {
      reject(new Error(response.error?.description || "Payment failed"));
    });
    rzp.open();
  });

// Dynamically load an external script
const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const stateId = location.state?.applicationId;
    if (stateId) {
      const ex = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
      sessionStorage.setItem(APP_KEY, JSON.stringify({ ...ex, applicationId: stateId }));
    }
  }, [location.state]);

  const applicationId = location.state?.applicationId || getAppId();
  const [method, setMethod] = useState("upi");
  const [processing, setProcessing] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);
  const paymentRequestRef = useRef(false);

  useEffect(() => {
    if (!applicationId) {
      toast.error("No application found");
      navigate("/check-status");
    }
  }, [applicationId, navigate]);

  const { data: appData, isLoading, refetch: refetchApplication } = useQuery({
    queryKey: ["application-payment", applicationId],
    queryFn: () => candidateService.getApplication(applicationId),
    enabled: Boolean(applicationId),
    staleTime: 0,
    refetchOnMount: "always",
  });

  const application = appData?.application || appData;
  const steps = buildApplicationSteps(application?.jobId, application);
  const paymentStep = steps.find((step) => step.type === "payment")?.id || 1;
  const previousStep = steps.find((step) => step.id === paymentStep - 1);
  const nextStep = steps.find((step) => step.id === paymentStep + 1);
  const paymentTiming = getPaymentTiming(application?.jobId, application);
  const isEarlyPayment = paymentTiming === "after_personal";
  const candidateCategory = application?.personalDetails?.category || "";
  const calculatedCategoryFee = calculateCategoryFee(
    application?.jobId?.applicationFee,
    candidateCategory,
  );
  const savedApplicationFee = Number(application?.totalFee ?? 0);
  const applicationFee =
    savedApplicationFee > 0 ? savedApplicationFee : calculatedCategoryFee;
  const processingPercent = Math.max(0, Number(application?.jobId?.paymentConfig?.processingFee || 0));
  const processingFee = applicationFee > 0 ? Math.round((applicationFee * processingPercent) / 100) : 0;
  const grandTotal = applicationFee + processingFee;
  const isPaymentCompleted = application?.paymentStatus === "paid";
  const paidTransactionId =
    application?.transactionId || `PAID-${application?.applicationId || applicationId || Date.now()}`;
  const paidAmount = Number(application?.totalFee || grandTotal || 0);
  const paymentAttemptKey = applicationId
    ? `payment_attempt_${applicationId}`
    : null;

  // Map UI method to Razorpay prefill method
  const getRazorpayMethod = () => {
    if (method === "upi" || method === "upi_qr") return "upi";
    if (method === "card") return "card";
    if (method === "netbanking") return "netbanking";
    return "upi";
  };

  const buildSuccessState = ({
    finalized,
    amount,
    transactionId,
    submittedAt,
  }) => {
    const submitted = finalized?.application || finalized || {};
    return {
      applicationId,
      paymentSuccess: true,
      amount,
      transactionId,
      submittedAt: submitted?.submittedAt || submittedAt || new Date().toISOString(),
      registrationNumber: submitted?.registrationNumber || "",
    };
  };

  const completePaidApplication = async (transactionId, amount) => {
    const draft = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
    let finalized;

    try {
      finalized = await candidateService.finalizeApplication(
        applicationId,
        transactionId,
        draft.declaration || "",
      );
    } catch (err) {
      const latestData = await candidateService.getApplication(applicationId);
      const latest = latestData?.application || latestData;
      const isPaid = latest?.paymentStatus === "paid";
      const isSubmitted = ["submitted", "approved"].includes(latest?.status);

      if (!isPaid || !isSubmitted) {
        throw err;
      }

      finalized = { application: latest };
    }

    sessionStorage.removeItem(APP_KEY);
    if (paymentAttemptKey) sessionStorage.removeItem(paymentAttemptKey);
    toast.success("Payment successful! Application submitted.");
    navigate("/application/success", {
      state: buildSuccessState({
        finalized,
        amount,
        transactionId,
      }),
    });
  };

  const continueAfterPayment = (transactionId, amount) => {
    if (paymentAttemptKey) sessionStorage.removeItem(paymentAttemptKey);
    toast.success("Payment successful. Continue your application.");
    navigate(nextStep?.path || "/application/education", {
      state: { applicationId, transactionId, amount },
    });
  };

  const completePaymentStep = async (transactionId, amount) => {
    if (isEarlyPayment) {
      continueAfterPayment(transactionId, amount);
      return;
    }
    await completePaidApplication(transactionId, amount);
  };

  const recoverPaidApplication = async (fallbackTransactionId, amount) => {
    const latestData = await candidateService.getApplication(applicationId);
    const latest = latestData?.application || latestData;
    const isPaid = latest?.paymentStatus === "paid";
    const isSubmitted = ["submitted", "approved"].includes(latest?.status);

    if (isEarlyPayment && isPaid) {
      continueAfterPayment(latest?.transactionId || fallbackTransactionId, amount);
      return true;
    }

    if (!isPaid || !isSubmitted) return false;

    await completePaidApplication(
      latest?.transactionId || fallbackTransactionId,
      amount,
    );
    return true;
  };

  const handleContinueFromCompletedPayment = async () => {
    if (processing) return;
    if (isEarlyPayment) {
      continueAfterPayment(paidTransactionId, paidAmount);
      return;
    }

    if (["submitted", "approved"].includes(application?.status)) {
      navigate("/application/success", {
        state: buildSuccessState({
          finalized: { application },
          amount: paidAmount,
          transactionId: paidTransactionId,
          submittedAt: application?.submittedAt,
        }),
      });
      return;
    }

    setProcessing(true);
    try {
      await completePaidApplication(paidTransactionId, paidAmount);
    } catch (err) {
      toast.error(err.message || "Payment is complete, but submission sync failed. Please check status.");
    } finally {
      setProcessing(false);
    }
  };

  const handlePay = async () => {
    if (processing || paymentRequestRef.current) return;

    if (isPaymentCompleted) {
      await handleContinueFromCompletedPayment();
      return;
    }

    if (grandTotal === 0) {
      paymentRequestRef.current = true;
      // Free application — submit directly
      setProcessing(true);
      try {
        const draft = JSON.parse(sessionStorage.getItem(APP_KEY) || "{}");
        const freeTransactionId = `FREE-${Date.now()}`;
        if (isEarlyPayment) {
          continueAfterPayment(freeTransactionId, 0);
          return;
        }
        const finalized = await candidateService.finalizeApplication(
          applicationId,
          freeTransactionId,
          draft.declaration || "",
        );
        sessionStorage.removeItem(APP_KEY);
        toast.success("Application submitted successfully!");
        navigate("/application/success", {
          state: buildSuccessState({
            finalized,
            amount: 0,
            transactionId: freeTransactionId,
          }),
        });
      } catch (err) {
        toast.error(err.message || "Submission failed");
      } finally {
        paymentRequestRef.current = false;
        setProcessing(false);
      }
      return;
    }

    paymentRequestRef.current = true;
    setProcessing(true);
    try {
      const latestData = await refetchApplication();
      const latestApplication =
        latestData?.data?.application || latestData?.data || application;
      if (latestApplication?.paymentStatus === "paid") {
        if (isEarlyPayment) {
          continueAfterPayment(
            latestApplication?.transactionId || paidTransactionId,
            Number(latestApplication?.totalFee || grandTotal || 0),
          );
          return;
        }
        navigate("/application/success", {
          state: buildSuccessState({
            finalized: { application: latestApplication },
            amount: Number(latestApplication?.totalFee || grandTotal || 0),
            transactionId: latestApplication?.transactionId || paidTransactionId,
            submittedAt: latestApplication?.submittedAt,
          }),
        });
        sessionStorage.removeItem(APP_KEY);
        if (paymentAttemptKey) sessionStorage.removeItem(paymentAttemptKey);
        return;
      }

      // Step 1: Initiate payment — get gateway order from backend
      const initData = await candidateService.initiatePayment(applicationId, method === "upi_qr" ? "razorpay" : "razorpay");
      const { transactionId, gatewayOrderId, gatewayKeyId, gatewayData, amount, gateway, feeBreakdown } = initData;
      const payableAmount = Number(amount ?? feeBreakdown?.totalFee ?? grandTotal);

      if (initData?.alreadyPaid) {
        await completePaymentStep(transactionId, payableAmount);
        return;
      }

      if (paymentAttemptKey) {
        sessionStorage.setItem(
          paymentAttemptKey,
          JSON.stringify({
            transactionId,
            gatewayOrderId,
            amount: payableAmount,
            gateway,
            createdAt: Date.now(),
          }),
        );
      }

      // ── RAZORPAY ──────────────────────────────────────────
      if (gateway === "razorpay" || !gateway) {
        if (!gatewayOrderId || !gatewayKeyId) {
          throw new Error("Payment gateway configuration is unavailable.");
        }

        const prefillMethod = getRazorpayMethod();
        const options = {
          key: gatewayKeyId,
          amount: payableAmount * 100,
          currency: "INR",
          name: "Bihar Recruitment Portal",
          description: `Application Fee — ${application?.applicationId || ""}`,
          order_id: gatewayOrderId,
          prefill: {
            name:    application?.personalDetails?.fullName || "",
            email:   application?.candidateId?.email || "",
            contact: application?.personalDetails?.registeredMobile || "",
            method:  prefillMethod,
          },
          config: {
            display: {
              blocks: {
                utib:  { name: "Pay via UPI",          instruments: [{ method: "upi" }] },
                other: { name: "Other Payment Modes",  instruments: [{ method: "card" }, { method: "netbanking" }] },
              },
              sequence:    prefillMethod === "upi" ? ["block.utib", "block.other"] : ["block.other", "block.utib"],
              preferences: { show_default_blocks: true },
            },
          },
          theme: { color: "#f97316" },
          modal: { backdropclose: false, escape: false },
        };
        if (method === "upi_qr") {
          options.config.display.blocks.utib.instruments = [{ method: "upi", flows: ["qr"] }];
        }

        const rzpResponse = await openRazorpayCheckout(options);
        await candidateService.verifyPayment({
          transactionId,
          gatewayOrderId:  rzpResponse.razorpay_order_id,
          gatewayPaymentId: rzpResponse.razorpay_payment_id,
          gatewaySignature: rzpResponse.razorpay_signature,
          status: "success",
        });
      }

      // ── CASHFREE ──────────────────────────────────────────
      else if (gateway === "cashfree") {
        if (!gatewayData?.paymentSessionId) {
          await candidateService.verifyPayment({ transactionId, status: "success" });
        } else {
          // Load Cashfree JS SDK dynamically
          await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
          const cashfree = window.Cashfree({ mode: "sandbox" }); // "production" for live
          const checkoutOptions = {
            paymentSessionId: gatewayData.paymentSessionId,
            redirectTarget:   "_modal",
          };
          const result = await cashfree.checkout(checkoutOptions);
          if (result.error) throw new Error(result.error.message || "Cashfree payment failed");
          await candidateService.verifyPayment({ transactionId, gatewayOrderId, status: "success" });
        }
      }

      // ── PHONEPE ───────────────────────────────────────────
      else if (gateway === "phonepe") {
        if (gatewayData?.redirectUrl) {
          // Save state before redirect
          sessionStorage.setItem("pending_payment", JSON.stringify({ transactionId, applicationId, gateway: "phonepe" }));
          window.location.href = gatewayData.redirectUrl;
          return; // page will redirect
        } else {
          await candidateService.verifyPayment({ transactionId, status: "success" });
        }
      }

      // ── PAYTM ─────────────────────────────────────────────
      else if (gateway === "paytm") {
        if (gatewayData?.txnToken && gatewayData?.mid) {
          // Load Paytm JS SDK dynamically
          const paytmUrl = `https://securegw-stage.paytm.in/merchantpgpui/checkoutjs/merchants/${gatewayData.mid}.js`;
          await loadScript(paytmUrl);
          sessionStorage.setItem("pending_payment", JSON.stringify({ transactionId, applicationId, gateway: "paytm" }));
          window.Paytm?.CheckoutJS?.init({
            merchant: { mid: gatewayData.mid, name: "Bihar Recruitment Portal" },
                order:    { id: gatewayOrderId, amount: String(payableAmount), token: gatewayData.txnToken, currency: "INR" },
            flow:     "DEFAULT",
            handler:  {
              notifyMerchant: async (eventName) => {
                if (eventName === "APP_CLOSED") toast.error("Payment cancelled");
              },
              transactionStatus: async (data) => {
                const status = data.STATUS === "TXN_SUCCESS" ? "success" : "failed";
                await candidateService.verifyPayment({ transactionId, gatewayOrderId, status });
                if (status === "success") {
                  sessionStorage.removeItem("pending_payment");
                  await completePaymentStep(transactionId, payableAmount);
                }
              },
            },
          });
          window.Paytm?.CheckoutJS?.invoke();
          return;
        } else {
          await candidateService.verifyPayment({ transactionId, status: "success" });
        }
      }

      // ── FINALIZE (common for Razorpay + Cashfree) ─────────
      await completePaymentStep(transactionId, payableAmount);
    } catch (err) {
      if (err.message === "Payment cancelled by user") {
        toast.error("Payment cancelled");
      } else if (
        /payment already completed/i.test(err.message || "") ||
        (application?.paymentStatus === "paid" &&
          ["submitted", "approved"].includes(application?.status))
      ) {
        try {
          await completePaymentStep(
            application?.transactionId || `PAID-${application?.applicationId || Date.now()}`,
            grandTotal,
          );
        } catch (recoveryErr) {
          toast.error(recoveryErr.message || "Payment completed, but submission sync failed. Please check status.");
        }
      } else {
        try {
          const recovered = await recoverPaidApplication(
            application?.transactionId || `PAID-${application?.applicationId || Date.now()}`,
            grandTotal,
          );
          if (!recovered && !err.toastShown) {
            toast.error(err.message || "Payment failed. Please try again.");
          }
        } catch (recoveryErr) {
          if (!err.toastShown) {
            toast.error(recoveryErr.message || err.message || "Payment failed. Please try again.");
          }
        }
      }
    } finally {
      paymentRequestRef.current = false;
      setProcessing(false);
    }
  };

  if (isLoading)
    return (
      <ApplicationLayout currentStep={paymentStep} title="Payment">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      </ApplicationLayout>
    );

  if (!application && !isLoading)
    return (
      <ApplicationLayout currentStep={paymentStep} title="Payment">
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">Application not found</p>
            <Button onClick={() => navigate("/check-status")}>View Application</Button>
          </CardContent>
        </Card>
      </ApplicationLayout>
    );

  if (isPaymentCompleted)
    return (
      <ApplicationLayout currentStep={paymentStep} title="Payment Gateway">
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="h-full border-green-200 bg-green-50">
                <CardContent className="h-full p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-6 h-6 text-green-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold tracking-[0.18em] uppercase text-green-700">
                        Payment Completed
                      </p>
                      <h2 className="text-2xl font-bold text-gray-900 mt-2">
                        Your application fee is already paid.
                      </h2>
                      <p className="text-gray-600 mt-2">
                        You can continue the application from the next pending step. Re-opening this page will never start a second payment for the same application.
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                        <div className="bg-white border border-green-100 rounded-xl p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Amount Paid</p>
                          <p className="text-lg font-bold text-gray-900 mt-1">INR {paidAmount.toLocaleString("en-IN")}</p>
                        </div>
                        <div className="bg-white border border-green-100 rounded-xl p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Status</p>
                          <p className="text-lg font-bold text-green-700 mt-1">Paid</p>
                        </div>
                        <div className="bg-white border border-green-100 rounded-xl p-4">
                          <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Application ID</p>
                          <p className="text-sm font-mono font-bold text-gray-900 mt-2 break-all">{application?.applicationId}</p>
                        </div>
                      </div>

                      <div className="bg-white border border-green-100 rounded-xl p-4 mt-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Transaction ID</p>
                        <p className="text-sm font-mono font-bold text-gray-900 mt-2 break-all">{paidTransactionId}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <Card className="h-full">
                <CardHeader>
                  <h3 className="font-semibold text-gray-900">Payment Summary</h3>
                </CardHeader>
                <CardContent className="flex h-[calc(100%-72px)] flex-col space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-700" />
                    <p className="text-sm text-green-800 font-semibold">Payment verified</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Application Fee</span>
                      <span className="font-medium">INR {applicationFee.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Processing Fee</span>
                      <span className="font-medium">INR {Math.max(0, paidAmount - applicationFee).toLocaleString("en-IN")}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between">
                      <span className="font-semibold text-gray-800">Total Paid</span>
                      <span className="font-bold text-green-700 text-lg">
                        INR {paidAmount.toLocaleString("en-IN")}
                      </span>
                    </div>
                  </div>
                  <Button
                    onClick={handleContinueFromCompletedPayment}
                    disabled={processing}
                    className="mt-auto w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {processing ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Syncing...</>
                    ) : (
                      isEarlyPayment ? "Continue Application" : "View Submission"
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-start pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              disabled={processing}
              onClick={() =>
                navigate(previousStep?.path || "/application/review", {
                  state: { applicationId },
                })
              }
            >
              <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </Button>
          </div>
        </div>
      </ApplicationLayout>
    );

  return (
    <ApplicationLayout currentStep={paymentStep} title="Payment Gateway">
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Payment Methods */}
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold text-gray-800">Select Payment Method</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  Powered by Razorpay — India's most trusted payment gateway
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {METHODS.map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.id;
                  return (
                    <div
                      key={m.id}
                      onClick={() => setMethod(m.id)}
                      className={`flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                        isSelected ? "border-orange-500 bg-orange-50" : "border-gray-200 hover:border-orange-300"
                      }`}
                    >
                      <input type="radio" readOnly checked={isSelected} className="w-4 h-4 text-orange-600 accent-orange-600" />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isSelected ? "bg-orange-100" : "bg-gray-100"}`}>
                        <Icon className={`w-5 h-5 ${isSelected ? "text-orange-600" : "text-gray-500"}`} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">{m.name}</p>
                        <p className="text-sm text-gray-500">{m.desc}</p>
                      </div>
                      {isSelected && (
                        <span className="ml-auto text-xs font-semibold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full">
                          Selected
                        </span>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Method info cards */}
            {method === "upi" && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-blue-800">UPI Payment</p>
                    <p className="text-xs text-blue-700 mt-0.5">
                      After clicking Pay, a Razorpay popup will open. Enter your UPI ID or scan the QR code shown there.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {method === "upi_qr" && (
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <QrCode className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-purple-800">UPI QR Code</p>
                    <p className="text-xs text-purple-700 mt-0.5">
                      After clicking Pay, a QR code will appear in the Razorpay popup. Scan it with any UPI app to complete payment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {method === "card" && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <CreditCard className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-green-800">Card Payment</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      After clicking Pay, enter your card details securely in the Razorpay popup. Supports Visa, Mastercard, RuPay, and Amex.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {method === "netbanking" && (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4 flex items-start gap-3">
                  <Building className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Net Banking</p>
                    <p className="text-xs text-amber-700 mt-0.5">
                      After clicking Pay, select your bank in the Razorpay popup and complete the payment via your bank's portal.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Security badge */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
              <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="text-xs text-gray-600">
                <span className="font-semibold text-gray-800">Secured by Razorpay</span>
                {" · "}SSL Encrypted · PCI-DSS Level 1 Compliant · 256-bit encryption
              </div>
            </div>
          </div>

          {/* Right: Summary */}
          <div className="space-y-5">
            <Card>
              <CardHeader>
                <h3 className="font-semibold text-gray-800">Payment Summary</h3>
              </CardHeader>
              <CardContent className="space-y-4">
                {candidateCategory && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-center gap-2">
                    <IndianRupee className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <p className="text-xs text-orange-700">
                      Fee for{" "}
                      <strong>{CATEGORY_LABELS[candidateCategory] || candidateCategory.toUpperCase()}</strong>{" "}
                      category
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Application Fee</span>
                    <span className="font-medium">₹{applicationFee.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Processing Fee ({processingPercent}%)</span>
                    <span className="font-medium">₹{processingFee.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="border-t pt-3 flex justify-between">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-orange-600 text-lg">
                      ₹{grandTotal.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {application?.applicationId && (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-1">Application ID</p>
                    <p className="text-xs font-mono font-semibold text-gray-800">{application.applicationId}</p>
                  </div>
                )}

                {applicationFee === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-sm text-green-800 font-medium">No fee for your category</p>
                  </div>
                )}

                {/* Pay button in summary too */}
                <button
                  onClick={handlePay}
                  disabled={processing}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
                >
                  {processing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : grandTotal === 0 ? (
                    isEarlyPayment ? "Continue (No Fee)" : "Submit Application (Free)"
                  ) : (
                    <><IndianRupee className="w-4 h-4" /> Pay ₹{grandTotal.toLocaleString("en-IN")}</>
                  )}
                </button>
              </CardContent>
            </Card>

            {/* Razorpay branding */}
            <div className="text-center">
              <p className="text-xs text-gray-400">Payments powered by</p>
              <p className="text-sm font-bold text-blue-700 mt-0.5">Razorpay</p>
            </div>
          </div>
        </div>

        {/* Bottom nav */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <Button
            variant="outline"
            disabled={processing}
            onClick={() =>
              navigate(previousStep?.path || "/application/review", {
                state: { applicationId },
              })
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            onClick={handlePay}
            disabled={processing}
            className="bg-orange-600 hover:bg-orange-700 text-white px-8"
          >
            {processing ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing...</>
            ) : grandTotal === 0 ? (
              isEarlyPayment ? "Continue (No Fee)" : "Submit Application (Free)"
            ) : (
              `Pay ₹${grandTotal.toLocaleString("en-IN")}`
            )}
          </Button>
        </div>
      </div>
    </ApplicationLayout>
  );
};

export default Payment;
