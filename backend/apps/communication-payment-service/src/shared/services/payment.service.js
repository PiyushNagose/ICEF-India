const crypto = require("crypto");
const https = require("https");
const Payment = require("../models/Payment");
const Application = require("../models/Application");
const PaymentGateway = require("../models/PaymentGateway");
const Project = require("../models/Project");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const {
  generateUUID,
  getPaginationParams,
  encrypt,
  decrypt,
  calculateFee,
} = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const {
  emitToCandidate,
  emitToAdmins,
  SOCKET_EVENTS,
} = require("../socket/index");
const { sendPaymentSuccessEmail } = require("./email.service");
const { notifyAdmins } = require("../utils/notifyAdmins");
const { assertPaymentWindowOpen } = require("../utils/timeline");
const env = require("../config/env");
const {
  generateRegistrationNumber,
  buildProjectCode,
} = require("./registrationNumber.service");

// ─────────────────────────────────────────────────────────────
// GATEWAY CONFIG HELPERS
// ─────────────────────────────────────────────────────────────

const getActiveGatewayConfig = async (gatewayName) => {
  const gw = await PaymentGateway.findOne({ name: gatewayName }).select(
    "+apiKey +secretKey +webhookSecret +merchantId",
  );
  if (!gw) throw new ApiError(404, `Gateway ${gatewayName} not configured`);
  if (gw.status !== "ACTIVE")
    throw new ApiError(400, `Gateway ${gatewayName} is not active`);
  return {
    name: gw.name,
    mode: gw.mode,
    apiKey: gw.apiKey ? decrypt(gw.apiKey) : null,
    secretKey: gw.secretKey ? decrypt(gw.secretKey) : null,
    webhookSecret: gw.webhookSecret ? decrypt(gw.webhookSecret) : null,
    merchantId: gw.merchantId ? decrypt(gw.merchantId) : null,
  };
};

const getRazorpayEnvConfig = () => {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;

  return {
    name: "Razorpay",
    mode: env.RAZORPAY_KEY_ID.startsWith("rzp_live_") ? "Live" : "Test",
    apiKey: env.RAZORPAY_KEY_ID,
    secretKey: env.RAZORPAY_KEY_SECRET,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null,
  };
};

const getRazorpayConfig = async () => {
  const dbConfig = await getActiveGatewayConfig("Razorpay").catch(() => null);
  if (dbConfig?.apiKey && dbConfig?.secretKey) return dbConfig;

  const envConfig = getRazorpayEnvConfig();
  if (envConfig) return envConfig;

  throw new ApiError(
    400,
    "Razorpay test credentials are not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, or configure Razorpay in Admin Payment Settings.",
  );
};

const validateRazorpayMode = (config) => {
  if (config.mode === "Test" && !config.apiKey.startsWith("rzp_test_")) {
    throw new ApiError(
      400,
      "Razorpay is in Test mode but the key is not a test key.",
    );
  }
  if (config.mode === "Live" && !config.apiKey.startsWith("rzp_live_")) {
    throw new ApiError(
      400,
      "Razorpay is in Live mode but the key is not a live key.",
    );
  }
};

const getDefaultGateway = async () => {
  let gw = await PaymentGateway.findOne({ isDefault: true, status: "ACTIVE" });
  if (!gw) gw = await PaymentGateway.findOne({ status: "ACTIVE" });
  return gw ? gw.name.toLowerCase() : null;
};

// ─────────────────────────────────────────────────────────────
// RAZORPAY
// ─────────────────────────────────────────────────────────────

const createRazorpayOrder = async (config, amount, currency, receipt) => {
  validateRazorpayMode(config);
  const Razorpay = require("razorpay");
  const instance = new Razorpay({
    key_id: config.apiKey,
    key_secret: config.secretKey,
  });
  return instance.orders.create({
    amount: amount * 100,
    currency,
    receipt,
    payment_capture: 1,
  });
};

const verifyRazorpaySignature = (orderId, paymentId, signature, secret) => {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
};

const calculateProcessingFee = (baseAmount, processingPercent = 0) => {
  const amount = Number(baseAmount) || 0;
  const percent = Math.max(0, Number(processingPercent) || 0);
  return Math.round((amount * percent) / 100);
};

const isEarlyPaymentApplication = (application) => {
  const timing =
    application?.jobId?.paymentConfig?.paymentTiming ||
    application?.paymentTiming ||
    "final";
  return ["after_personal", "step1"].includes(timing);
};

const finalizePaidApplicationForPayment = async (payment, transactionId) => {
  const application = await Application.findById(payment.applicationId)
    .populate("candidateId", "email fullName")
    .populate("jobId", "paymentConfig applicationDeadline projectId title");

  if (!application) return null;

  application.paymentStatus = "paid";
  application.transactionId = transactionId;

  if (isEarlyPaymentApplication(application) && application.status === "draft") {
    application.paymentTiming = "after_personal";
    application.currentStep = Math.max(Number(application.currentStep || 1), 2);
    await application.save();
    return application;
  }

  application.status = "approved";
  application.submittedAt = application.submittedAt || new Date();
  application.currentStep = Math.max(Number(application.currentStep || 1), 9);

  if (application.isPublicApplication && !application.registrationNumber) {
    const project = application.jobId?.projectId
      ? await Project.findById(application.jobId.projectId).select("name publicSlug")
      : null;
    const projectCode = project
      ? buildProjectCode(project.name, new Date().getFullYear())
      : "APP26";
    const registrationNumber = await generateRegistrationNumber(projectCode);
    const numericPart = parseInt(registrationNumber.slice(-6), 10) || 1;
    const batchNumber = `batch-${Math.ceil(numericPart / 10000)}`;

    application.registrationNumber = registrationNumber;
    application.fileStorage = {
      ...(application.fileStorage || {}),
      batchNumber,
      basePath: `recruitment_portal/projects/${project?.publicSlug || "general"}/applicants/${batchNumber}/${registrationNumber}`,
    };

    await User.findByIdAndUpdate(application.candidateId?._id || application.candidateId, {
      registrationNumber,
    });
  }

  await application.save();
  return application;
};

// ─────────────────────────────────────────────────────────────
// CASHFREE  (SDK: cashfree-pg v4)
// Docs: https://docs.cashfree.com/docs/payment-gateway
// ─────────────────────────────────────────────────────────────

const createCashfreeOrder = async (config, amount, orderId, candidateId) => {
  const { Cashfree } = require("cashfree-pg");
  // Set environment based on mode
  Cashfree.XClientId = config.apiKey;
  Cashfree.XClientSecret = config.secretKey;
  Cashfree.XEnvironment =
    config.mode === "Live"
      ? Cashfree.Environment.PRODUCTION
      : Cashfree.Environment.SANDBOX;

  const request = {
    order_amount: amount,
    order_currency: "INR",
    order_id: orderId,
    customer_details: {
      customer_id: candidateId.toString(),
      customer_phone: "9999999999", // placeholder — real phone from application
    },
  };
  const response = await Cashfree.PGCreateOrder("2023-08-01", request);
  // Returns { order_id, payment_session_id, order_status, ... }
  return response.data;
};

const verifyCashfreePayment = async (config, orderId) => {
  const { Cashfree } = require("cashfree-pg");
  Cashfree.XClientId = config.apiKey;
  Cashfree.XClientSecret = config.secretKey;
  Cashfree.XEnvironment =
    config.mode === "Live"
      ? Cashfree.Environment.PRODUCTION
      : Cashfree.Environment.SANDBOX;
  const response = await Cashfree.PGFetchOrder("2023-08-01", orderId);
  return response.data?.order_status === "PAID";
};

const verifyCashfreeWebhookSignature = (
  rawBody,
  timestamp,
  signature,
  secret,
) => {
  const data = `${timestamp}${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64");
  return expected === signature;
};

// ─────────────────────────────────────────────────────────────
// PHONEPE  (REST API — no official npm package)
// Docs: https://developer.phonepe.com/v1/docs
// ─────────────────────────────────────────────────────────────

const createPhonePeOrder = async (
  config,
  amount,
  transactionId,
  candidateId,
) => {
  const BASE_URL =
    config.mode === "Live"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  const payload = {
    merchantId: config.merchantId,
    merchantTransactionId: transactionId,
    merchantUserId: `USER_${candidateId}`,
    amount: amount * 100, // paise
    redirectUrl: `${env.CLIENT_URL}/application/payment-callback?gateway=phonepe&txn=${transactionId}`,
    redirectMode: "REDIRECT",
    callbackUrl: `${env.WEBHOOK_BASE_URL}/api/candidate/payments/phonepe/webhook`,
    paymentInstrument: { type: "PAY_PAGE" },
  };

  const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
  const saltKey = config.secretKey;
  const saltIndex = 1;
  const checksum =
    crypto
      .createHash("sha256")
      .update(`${base64Payload}/pg/v1/pay${saltKey}`)
      .digest("hex") + `###${saltIndex}`;

  const response = await fetch(`${BASE_URL}/pg/v1/pay`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-VERIFY": checksum },
    body: JSON.stringify({ request: base64Payload }),
  });
  const data = await response.json();
  if (!data.success)
    throw new Error(data.message || "PhonePe order creation failed");

  return {
    merchantTransactionId: transactionId,
    redirectUrl: data.data?.instrumentResponse?.redirectInfo?.url,
  };
};

const verifyPhonePePayment = async (config, transactionId) => {
  const BASE_URL =
    config.mode === "Live"
      ? "https://api.phonepe.com/apis/hermes"
      : "https://api-preprod.phonepe.com/apis/pg-sandbox";

  const saltKey = config.secretKey;
  const saltIndex = 1;
  const path = `/pg/v1/status/${config.merchantId}/${transactionId}`;
  const checksum =
    crypto.createHash("sha256").update(`${path}${saltKey}`).digest("hex") +
    `###${saltIndex}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      "X-VERIFY": checksum,
      "X-MERCHANT-ID": config.merchantId,
    },
  });
  const data = await response.json();
  return data.success && data.data?.state === "COMPLETED";
};

// ─────────────────────────────────────────────────────────────
// PAYTM  (REST API — official SDK deprecated, use REST)
// Docs: https://developer.paytm.com/docs
// ─────────────────────────────────────────────────────────────

const createPaytmOrder = async (config, amount, orderId, candidateId) => {
  const BASE_URL =
    config.mode === "Live"
      ? "https://securegw.paytm.in"
      : "https://securegw-stage.paytm.in";

  const paytmParams = {
    body: {
      requestType: "Payment",
      mid: config.merchantId,
      websiteName: config.mode === "Live" ? "WEBPROD" : "WEBSTAGING",
      orderId,
      callbackUrl: `${env.WEBHOOK_BASE_URL}/api/candidate/payments/paytm/webhook`,
      txnAmount: { value: amount.toString(), currency: "INR" },
      userInfo: { custId: candidateId.toString() },
    },
  };

  // Generate checksum using Paytm's algorithm
  const body = JSON.stringify(paytmParams.body);
  const checksum = await generatePaytmChecksum(body, config.secretKey);

  const response = await fetch(
    `${BASE_URL}/theia/api/v1/initiateTransaction?mid=${config.merchantId}&orderId=${orderId}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: paytmParams.body,
        head: { signature: checksum },
      }),
    },
  );
  const data = await response.json();
  if (data.body?.resultInfo?.resultStatus !== "S")
    throw new Error(
      data.body?.resultInfo?.resultMsg || "Paytm order creation failed",
    );

  return { orderId, txnToken: data.body.txnToken };
};

// Paytm checksum generation (HMAC-SHA256)
const generatePaytmChecksum = async (body, key) => {
  const salt = crypto.randomBytes(4).toString("hex");
  const data = `${body}${salt}`;
  const hash = crypto.createHmac("sha256", key).update(data).digest("hex");
  return `${hash}####${salt}`;
};

const verifyPaytmChecksum = (body, checksum, key) => {
  try {
    const parts = checksum.split("####");
    if (parts.length !== 2) return false;
    const [hash, salt] = parts;
    const data = `${body}${salt}`;
    const expected = crypto
      .createHmac("sha256", key)
      .update(data)
      .digest("hex");
    return expected === hash;
  } catch {
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// INITIATE PAYMENT
// ─────────────────────────────────────────────────────────────

const initiatePayment = async (applicationId, candidateId, gatewayName) => {
  const application = await Application.findOne({
    _id: applicationId,
    candidateId,
  })
    .populate("jobId", "paymentConfig applicationDeadline applicationFee")
    .populate("appliedPosts");
  if (!application) throw new ApiError(404, "Application not found");
  if (application.paymentStatus === "paid")
    throw new ApiError(400, "Payment already completed");
  assertPaymentWindowOpen(application.jobId);

  let applicationFee = application.totalFee || 0;
  if (!applicationFee && application.appliedPosts?.length > 0)
    applicationFee = application.appliedPosts.reduce(
      (s, p) => s + (p.fee || 0),
      0,
    );
  if (!applicationFee) {
    applicationFee = calculateFee(
      application.jobId?.applicationFee || {},
      application.personalDetails?.category,
    );
  }
  if (!application.totalFee && applicationFee >= 0) {
    application.totalFee = applicationFee;
    application.paymentTiming =
      application.jobId?.paymentConfig?.paymentTiming || application.paymentTiming;
    await application.save();
  }
  const processingPercent =
    application.jobId?.paymentConfig?.processingFee || 0;
  const processingFee = calculateProcessingFee(
    applicationFee,
    processingPercent,
  );
  const totalFee = applicationFee + processingFee;
  // Allow ₹0 fee — free applications still need a payment record for tracking
  // if (totalFee === 0) throw new ApiError(400, "No fee applicable for this application");

  const resolvedGateway = gatewayName || (await getDefaultGateway());
  const normalizedGateway = resolvedGateway
    ? resolvedGateway.toLowerCase()
    : "simulation";
  const transactionId = `TXN-${Date.now()}-${generateUUID().slice(0, 8).toUpperCase()}`;

  const payment = await Payment.create({
    transactionId,
    applicationId,
    candidateId,
    amount: totalFee,
    gateway:
      normalizedGateway === "simulation" ? "razorpay" : normalizedGateway,
    status: "initiated",
  });

  let gatewayOrderId = null;
  let gatewayKeyId = null;
  let gatewayData = {};

  try {
    if (normalizedGateway === "razorpay") {
      const config = await getRazorpayConfig();
      if (config?.apiKey && config?.secretKey) {
        const order = await createRazorpayOrder(
          config,
          totalFee,
          "INR",
          transactionId,
        );
        gatewayOrderId = order.id;
        gatewayKeyId = config.apiKey;
        payment.gatewayOrderId = gatewayOrderId;
        await payment.save();
      }
    } else if (normalizedGateway === "cashfree") {
      const config = await getActiveGatewayConfig("Cashfree").catch(() => null);
      if (config?.apiKey && config?.secretKey) {
        const result = await createCashfreeOrder(
          config,
          totalFee,
          transactionId,
          candidateId,
        );
        gatewayOrderId = result.order_id;
        gatewayData = { paymentSessionId: result.payment_session_id };
        payment.gatewayOrderId = gatewayOrderId;
        await payment.save();
      }
    } else if (normalizedGateway === "phonepe") {
      const config = await getActiveGatewayConfig("PhonePe").catch(() => null);
      if (config?.apiKey && config?.merchantId) {
        const result = await createPhonePeOrder(
          config,
          totalFee,
          transactionId,
          candidateId,
        );
        gatewayOrderId = result.merchantTransactionId;
        gatewayData = { redirectUrl: result.redirectUrl };
        payment.gatewayOrderId = gatewayOrderId;
        await payment.save();
      }
    } else if (normalizedGateway === "paytm") {
      const config = await getActiveGatewayConfig("Paytm").catch(() => null);
      if (config?.merchantId && config?.secretKey) {
        const result = await createPaytmOrder(
          config,
          totalFee,
          transactionId,
          candidateId,
        );
        gatewayOrderId = result.orderId;
        gatewayData = { txnToken: result.txnToken, mid: config.merchantId };
        payment.gatewayOrderId = gatewayOrderId;
        await payment.save();
      }
    }
  } catch (err) {
    // Gateway order creation failed - will be logged by error handler
    if (normalizedGateway === "razorpay") {
      throw err.statusCode
        ? err
        : new ApiError(502, `Razorpay order creation failed: ${err.message}`);
    }
  }

  return {
    transactionId,
    paymentId: payment._id,
    amount: totalFee,
    currency: "INR",
    gateway: normalizedGateway,
    gatewayOrderId,
    gatewayKeyId,
    gatewayData,
    feeBreakdown: {
      applicationFee,
      processingFee,
      processingPercent,
      totalFee,
    },
    applicationId: application.applicationId,
  };
};

// ─────────────────────────────────────────────────────────────
// VERIFY PAYMENT  (called by frontend after gateway callback)
// ─────────────────────────────────────────────────────────────

const verifyPayment = async ({
  transactionId,
  gatewayOrderId,
  gatewayPaymentId,
  gatewaySignature,
  status,
}) => {
  const payment = await Payment.findOne({ transactionId });
  if (!payment) throw new ApiError(404, "Transaction not found");
  if (payment.status === "success") {
    await finalizePaidApplicationForPayment(payment, transactionId);
    return payment;
  }

  let verified = false;

  try {
    if (
      payment.gateway === "razorpay" &&
      gatewayPaymentId &&
      gatewaySignature
    ) {
      // Verify the checkout response server-side using the configured Razorpay secret.
      const config = await getRazorpayConfig();
      if (config?.secretKey) {
        const orderId = gatewayOrderId || payment.gatewayOrderId;
        verified = verifyRazorpaySignature(
          orderId,
          gatewayPaymentId,
          gatewaySignature,
          config.secretKey,
        );
        if (!verified) {
          payment.status = "failed";
          payment.failureReason = "Signature verification failed";
          await payment.save();
          throw new ApiError(400, "Payment signature verification failed");
        }
      }
    } else if (payment.gateway === "razorpay" && !gatewayPaymentId) {
      // No Razorpay response fields — trust status (free/simulation)
      verified = status === "success";
    } else if (payment.gateway === "cashfree") {
      const config = await getActiveGatewayConfig("Cashfree").catch(() => null);
      if (config?.apiKey && payment.gatewayOrderId) {
        verified = await verifyCashfreePayment(config, payment.gatewayOrderId);
      } else {
        verified = status === "success";
      }
    } else if (payment.gateway === "phonepe") {
      const config = await getActiveGatewayConfig("PhonePe").catch(() => null);
      if (config?.apiKey) {
        verified = await verifyPhonePePayment(config, transactionId);
      } else {
        verified = status === "success";
      }
    } else if (payment.gateway === "paytm") {
      verified = status === "success";
    } else if (payment.gateway === "simulation") {
      verified = status === "success";
    } else {
      // Unknown gateway — trust status
      verified = status === "success";
    }
  } catch (err) {
    if (err.statusCode) throw err;
    throw new ApiError(500, err.message || "Payment verification failed");
  }

  payment.gatewayPaymentId = gatewayPaymentId;
  payment.gatewaySignature = gatewaySignature;
  if (gatewayOrderId) payment.gatewayOrderId = gatewayOrderId;
  payment.status = verified ? "success" : "failed";
  if (verified) payment.paidAt = new Date();
  if (!verified && !payment.failureReason)
    payment.failureReason = "Payment failed at gateway";
  await payment.save();

  let application = null;

  if (verified) {
    const paymentApplication = await Application.findById(payment.applicationId)
      .populate("jobId", "paymentConfig applicationDeadline");
    try {
      assertPaymentWindowOpen(paymentApplication?.jobId);
    } catch (err) {
      payment.status = "failed";
      payment.failureReason = err.message || "Payment deadline has passed";
      await payment.save();
      if (paymentApplication) {
        paymentApplication.paymentStatus = "failed";
        paymentApplication.transactionId = transactionId;
        await paymentApplication.save();
      }
      throw err;
    }
    application = await finalizePaidApplicationForPayment(payment, transactionId);
  } else {
    application = await Application.findById(payment.applicationId)
      .populate("candidateId", "email fullName")
      .populate("jobId", "paymentConfig applicationDeadline");
    if (application) {
      application.paymentStatus = "failed";
      application.transactionId = transactionId;
      await application.save();
    }
  }

  if (application) {
    const cid = application.candidateId?._id?.toString();
    if (verified && cid) {
      emitToCandidate(cid, SOCKET_EVENTS.PAYMENT_SUCCESS, {
        transactionId,
        amount: payment.amount,
        applicationId: application.applicationId,
      });
      emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
        type: "payment_received",
        amount: payment.amount,
      });
      try {
        await sendPaymentSuccessEmail(
          application.candidateId.email,
          application.candidateId.fullName,
          transactionId,
          payment.amount,
        );
      } catch (_) {}
      // Notify all admins about the new payment
      notifyAdmins({
        type: "payment_success",
        title: "Payment Received",
        message: `₹${Number(payment.amount).toLocaleString("en-IN")} received from ${application.candidateId.fullName} for application ${application.applicationId}`,
        link: `/admin/applications/${application._id}`,
        metadata: { transactionId, applicationId: application.applicationId },
      });
    } else if (!verified && cid) {
      emitToCandidate(cid, SOCKET_EVENTS.PAYMENT_FAILED, {
        transactionId,
        applicationId: application.applicationId,
      });
    }
  }

  return payment;
};

// ─────────────────────────────────────────────────────────────
// WEBHOOK HANDLERS
// ─────────────────────────────────────────────────────────────

const handleRazorpayWebhook = async (rawBody, signature) => {
  const config = await getRazorpayConfig().catch(() => null);
  if (!config?.webhookSecret)
    return { processed: false, reason: "No webhook secret" };

  const expected = crypto
    .createHmac("sha256", config.webhookSecret)
    .update(rawBody)
    .digest("hex");
  if (expected !== signature)
    throw new ApiError(400, "Invalid Razorpay webhook signature");

  const event = JSON.parse(rawBody);
  const eventType = event.event;

  if (eventType === "payment.captured" || eventType === "payment.authorized") {
    const entity = event.payload?.payment?.entity;
    if (entity) {
      const pay = await Payment.findOne({ gatewayOrderId: entity.order_id });
      if (pay && pay.status !== "success") {
        await verifyPayment({
          transactionId: pay.transactionId,
          gatewayOrderId: entity.order_id,
          gatewayPaymentId: entity.id,
          gatewaySignature: entity.signature || "",
          status: "success",
        });
      }
    }
  } else if (eventType === "payment.failed") {
    const entity = event.payload?.payment?.entity;
    if (entity) {
      const pay = await Payment.findOne({ gatewayOrderId: entity.order_id });
      if (pay && pay.status === "initiated") {
        pay.status = "failed";
        pay.failureReason = entity.error_description || "Payment failed";
        await pay.save();
      }
    }
  }
  return { processed: true, event: eventType };
};

const handleCashfreeWebhook = async (rawBody, signature, timestamp) => {
  const config = await getActiveGatewayConfig("Cashfree").catch(() => null);
  if (!config?.webhookSecret)
    return { processed: false, reason: "No webhook secret" };

  if (
    !verifyCashfreeWebhookSignature(
      rawBody,
      timestamp,
      signature,
      config.webhookSecret,
    )
  )
    throw new ApiError(400, "Invalid Cashfree webhook signature");

  const event = JSON.parse(rawBody);
  const orderId = event.data?.order?.order_id;
  const orderStatus = event.data?.order?.order_status;

  if (orderId) {
    const pay = await Payment.findOne({ gatewayOrderId: orderId });
    if (pay && pay.status !== "success") {
      await verifyPayment({
        transactionId: pay.transactionId,
        gatewayOrderId: orderId,
        status: orderStatus === "PAID" ? "success" : "failed",
      });
    }
  }
  return { processed: true };
};

const handlePhonePeWebhook = async (rawBody, xVerify) => {
  const config = await getActiveGatewayConfig("PhonePe").catch(() => null);
  if (!config?.secretKey) return { processed: false, reason: "No secret key" };

  // Verify PhonePe webhook signature
  const [receivedHash] = (xVerify || "").split("###");
  const expectedHash = crypto
    .createHash("sha256")
    .update(`${rawBody}${config.secretKey}`)
    .digest("hex");
  if (receivedHash !== expectedHash)
    throw new ApiError(400, "Invalid PhonePe webhook signature");

  const event = JSON.parse(rawBody);
  const txnId = event.data?.merchantTransactionId;
  const state = event.data?.state;

  if (txnId) {
    const pay = await Payment.findOne({ transactionId: txnId });
    if (pay && pay.status !== "success") {
      await verifyPayment({
        transactionId: txnId,
        status: state === "COMPLETED" ? "success" : "failed",
      });
    }
  }
  return { processed: true };
};

const handlePaytmWebhook = async (rawBody) => {
  const config = await getActiveGatewayConfig("Paytm").catch(() => null);
  const params = new URLSearchParams(rawBody);
  const body = Object.fromEntries(params);
  const checksum = body.CHECKSUMHASH;
  delete body.CHECKSUMHASH;

  if (config?.secretKey && checksum) {
    const isValid = verifyPaytmChecksum(
      JSON.stringify(body),
      checksum,
      config.secretKey,
    );
    if (!isValid) throw new ApiError(400, "Invalid Paytm webhook signature");
  }

  const orderId = body.ORDERID;
  const txnStatus = body.STATUS; // TXN_SUCCESS | TXN_FAILURE

  if (orderId) {
    const pay = await Payment.findOne({ gatewayOrderId: orderId });
    if (pay && pay.status !== "success") {
      await verifyPayment({
        transactionId: pay.transactionId,
        gatewayOrderId: orderId,
        status: txnStatus === "TXN_SUCCESS" ? "success" : "failed",
      });
    }
  }
  return { processed: true };
};

// ─────────────────────────────────────────────────────────────
// PAYMENT HISTORY & ADMIN
// ─────────────────────────────────────────────────────────────

const getPaymentHistory = async (candidateId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const [payments, total] = await Promise.all([
    Payment.find({ candidateId })
      .populate("applicationId", "applicationId jobId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments({ candidateId }),
  ]);
  return { payments, meta: paginationMeta(total, page, limit) };
};

const getPaymentByTransaction = async (transactionId, candidateId) => {
  const filter = { transactionId };
  if (candidateId) filter.candidateId = candidateId;
  const payment = await Payment.findOne(filter).populate(
    "applicationId",
    "applicationId",
  );
  if (!payment) throw new ApiError(404, "Transaction not found");
  return payment;
};

const getAdminPayments = async (query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.gateway) filter.gateway = query.gateway;
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .populate("candidateId", "fullName email")
      .populate("applicationId", "applicationId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]);
  return { payments, meta: paginationMeta(total, page, limit) };
};

// ─────────────────────────────────────────────────────────────
// GATEWAY CRUD
// ─────────────────────────────────────────────────────────────

const getGateways = async () =>
  PaymentGateway.find()
    .sort({ isDefault: -1, name: 1 })
    .select("-apiKey -secretKey -webhookSecret -merchantId");

const getGatewayByName = async (name) =>
  PaymentGateway.findOne({ name }).select(
    "+apiKey +secretKey +webhookSecret +merchantId",
  );

const upsertGateway = async (name, data, updatedBy) => {
  const updateData = { ...data, updatedBy };
  if (data.apiKey) updateData.apiKey = encrypt(data.apiKey);
  if (data.secretKey) updateData.secretKey = encrypt(data.secretKey);
  if (data.webhookSecret)
    updateData.webhookSecret = encrypt(data.webhookSecret);
  if (data.merchantId) updateData.merchantId = encrypt(data.merchantId);
  if (data.isDefault === true)
    await PaymentGateway.updateMany(
      { name: { $ne: name } },
      { isDefault: false },
    );
  return PaymentGateway.findOneAndUpdate({ name }, updateData, {
    new: true,
    upsert: true,
    runValidators: true,
  }).select("-apiKey -secretKey -webhookSecret -merchantId");
};

const testGatewayConnection = async (name) => {
  try {
    const config =
      name === "Razorpay"
        ? await getRazorpayConfig()
        : await getActiveGatewayConfig(name);
    if (name === "Razorpay" && config.apiKey && config.secretKey) {
      validateRazorpayMode(config);
      const Razorpay = require("razorpay");
      const instance = new Razorpay({
        key_id: config.apiKey,
        key_secret: config.secretKey,
      });
      await instance.orders.all({ count: 1 });
      return { connected: true, message: "Razorpay connection successful" };
    }
    if (name === "Cashfree" && config.apiKey && config.secretKey) {
      const { Cashfree } = require("cashfree-pg");
      Cashfree.XClientId = config.apiKey;
      Cashfree.XClientSecret = config.secretKey;
      Cashfree.XEnvironment =
        config.mode === "Live"
          ? Cashfree.Environment.PRODUCTION
          : Cashfree.Environment.SANDBOX;
      // Lightweight test — fetch a non-existent order (will return 404 but confirms auth)
      try {
        await Cashfree.PGFetchOrder("2023-08-01", "TEST_CONN");
      } catch (e) {
        if (
          e?.response?.status === 404 ||
          e?.response?.data?.code === "ORDER_NOT_FOUND"
        )
          return { connected: true, message: "Cashfree connection successful" };
        throw e;
      }
      return { connected: true, message: "Cashfree connection successful" };
    }
    if (name === "PhonePe" && config.apiKey && config.merchantId) {
      // Test by checking status of a dummy transaction (will return error but confirms connectivity)
      await verifyPhonePePayment(config, "TEST_CONN_CHECK").catch(() => {});
      return { connected: true, message: "PhonePe credentials configured" };
    }
    if (name === "Paytm" && config.merchantId && config.secretKey) {
      return { connected: true, message: "Paytm credentials configured" };
    }
    return { connected: false, message: "No credentials configured" };
  } catch (err) {
    return { connected: false, message: err.message };
  }
};

module.exports = {
  initiatePayment,
  verifyPayment,
  handleRazorpayWebhook,
  handleCashfreeWebhook,
  handlePhonePeWebhook,
  handlePaytmWebhook,
  getPaymentHistory,
  getPaymentByTransaction,
  getAdminPayments,
  getGateways,
  getGatewayByName,
  upsertGateway,
  testGatewayConnection,
  getDefaultGateway,
};
