const Payment = require("../models/Payment");
const Application = require("../models/Application");
const PaymentGateway = require("../models/PaymentGateway");
const Project = require("../models/Project");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { generateUUID, getPaginationParams } = require("../utils/helpers");
const { paginationMeta } = require("../utils/ApiResponse");
const {
  emitToCandidate,
  emitToAdmins,
  SOCKET_EVENTS,
} = require("../socket/index");
const { sendPaymentSuccessEmail } = require("./email.service");
const {
  generateRegistrationNumber,
  buildProjectCode,
} = require("./registrationNumber.service");

const initiatePayment = async (
  applicationId,
  candidateId,
  gateway = "razorpay",
) => {
  const application = await Application.findOne({
    _id: applicationId,
    candidateId,
  }).populate("appliedPosts");
  if (!application) throw new ApiError(404, "Application not found");
  if (application.paymentStatus === "paid")
    throw new ApiError(400, "Payment already completed");

  const totalFee = application.appliedPosts.reduce(
    (sum, p) => sum + (p.fee || 0),
    0,
  );
  if (totalFee === 0)
    throw new ApiError(400, "No fee applicable for selected posts");

  const transactionId = `TXN-${Date.now()}-${generateUUID().slice(0, 8).toUpperCase()}`;

  const payment = await Payment.create({
    transactionId,
    applicationId,
    candidateId,
    amount: totalFee,
    gateway,
    status: "initiated",
  });

  // In production: call gateway SDK here to create order
  // For now return the transaction details for frontend to proceed
  return {
    transactionId,
    paymentId: payment._id,
    amount: totalFee,
    currency: "INR",
    gateway,
    // gatewayOrderId: razorpayOrder.id  ← add when integrating real gateway
  };
};

const verifyPayment = async ({
  transactionId,
  gatewayPaymentId,
  gatewaySignature,
  status,
}) => {
  const payment = await Payment.findOne({ transactionId });
  if (!payment) throw new ApiError(404, "Transaction not found");

  payment.gatewayPaymentId = gatewayPaymentId;
  payment.gatewaySignature = gatewaySignature;
  payment.status = status === "success" ? "success" : "failed";
  if (status === "success") payment.paidAt = new Date();
  await payment.save();

  // Update application payment status
  const application = await Application.findById(
    payment.applicationId,
  ).populate("candidateId", "email fullName");

  if (application) {
    application.paymentStatus = status === "success" ? "paid" : "failed";
    application.transactionId = transactionId;
    await application.save();

    const candidateId = application.candidateId._id.toString();

    if (status === "success") {
      // ── Generate registration number for public applications ──
      if (application.isPublicApplication && !application.registrationNumber) {
        try {
          const job = await require("../models/Job")
            .findById(application.jobId)
            .select("projectId");
          const project = job?.projectId
            ? await Project.findById(job.projectId).select("name publicSlug")
            : null;

          const projectCode = project
            ? buildProjectCode(project.name, new Date().getFullYear())
            : "APP26";

          const regNum = await generateRegistrationNumber(projectCode);
          const numericPart = parseInt(regNum.slice(-6));
          const batchNumber = `batch-${Math.ceil(numericPart / 10000)}`;

          application.registrationNumber = regNum;
          application.status = "submitted";
          application.submittedAt = application.submittedAt || new Date();
          application.fileStorage = {
            ...(application.fileStorage || {}),
            batchNumber,
            basePath: `recruitment_portal/projects/${project?.publicSlug || "general"}/applicants/${batchNumber}/${regNum}`,
          };

          // Sync registration number to ghost user
          await User.findByIdAndUpdate(application.candidateId._id, {
            registrationNumber: regNum,
          });
        } catch (err) {
          console.error(
            "[RegNum] Failed to generate registration number:",
            err.message,
          );
        }
      }

      await application.save();

      // Notify candidate in real-time
      emitToCandidate(candidateId, SOCKET_EVENTS.PAYMENT_SUCCESS, {
        transactionId,
        amount: payment.amount,
        applicationId: application.applicationId,
        registrationNumber: application.registrationNumber || null,
      });

      // Notify admin dashboard
      emitToAdmins(SOCKET_EVENTS.ADMIN_LIVE_COUNT, {
        type: "payment_received",
        amount: payment.amount,
      });

      // Send confirmation email
      await sendPaymentSuccessEmail(
        application.candidateId.email,
        application.candidateId.fullName,
        transactionId,
        payment.amount,
      );
    } else {
      emitToCandidate(candidateId, SOCKET_EVENTS.PAYMENT_FAILED, {
        transactionId,
        applicationId: application.applicationId,
      });
    }
  }

  return payment;
};

const getPaymentHistory = async (candidateId, query) => {
  const { page, limit, skip } = getPaginationParams(query);
  const [payments, total] = await Promise.all([
    Payment.find({ candidateId })
      .populate("applicationId", "applicationId")
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

// ── Admin: Get all payments ───────────────────────────────────
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

// ── Admin: Payment gateway config ────────────────────────────
const getGateways = async () =>
  PaymentGateway.find().select("-apiKey -secretKey -webhookSecret");

const upsertGateway = async (name, data, updatedBy) => {
  const { encrypt } = require("../utils/helpers");
  const updateData = { ...data, updatedBy };
  if (data.apiKey) updateData.apiKey = encrypt(data.apiKey);
  if (data.secretKey) updateData.secretKey = encrypt(data.secretKey);
  if (data.webhookSecret)
    updateData.webhookSecret = encrypt(data.webhookSecret);

  return PaymentGateway.findOneAndUpdate({ name }, updateData, {
    new: true,
    upsert: true,
    runValidators: true,
  }).select("-apiKey -secretKey -webhookSecret");
};

module.exports = {
  initiatePayment,
  verifyPayment,
  getPaymentHistory,
  getPaymentByTransaction,
  getAdminPayments,
  getGateways,
  upsertGateway,
};
