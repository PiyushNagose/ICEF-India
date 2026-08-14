const otpService = require("../shared/services/otp.service");
const { StatusCodes } = require("http-status-codes");
const env = require("../shared/config/env");

const shouldExposeOtp = () =>
  process.env.NODE_ENV === "development" ||
  process.env.PUBLIC_OTP_EXPOSE_IN_RESPONSE === "true" ||
  process.env.EXPOSE_TEST_OTP === "true" ||
  process.env.RAZORPAY_TEST_MODE === "true";

/**
 * Send OTP to email or mobile
 * POST /api/public/otp/send
 */
exports.sendOTP = async (req, res) => {
  try {
    const { identifier, type } = req.body;

    // Validate input
    if (!identifier || !type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Identifier and type are required",
      });
    }

    if (!["email", "mobile"].includes(type)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Type must be 'email' or 'mobile'",
      });
    }

    const isRateLimited = await otpService.isRateLimited(
      identifier,
      type,
      env.PUBLIC_OTP_IDENTIFIER_MAX,
    );
    if (isRateLimited) {
      return res.status(StatusCodes.TOO_MANY_REQUESTS).json({
        success: false,
        message: "Too many OTP requests for this number/email. Please try again later.",
      });
    }

    // Generate and store OTP
    const otp = await otpService.createOTP(identifier, type);


    // Send OTP based on type
    if (type === "email") {
      // TODO: Integrate with email service (NodeMailer, SendGrid, etc.)
      console.log(`[EMAIL] OTP dispatch queued for ${identifier}`);
    } else if (type === "mobile") {
      // TODO: Integrate with SMS service (Twilio, MSG91, etc.)
      console.log(`[SMS] OTP dispatch queued for ${identifier}`);
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: `OTP sent successfully to ${type}`,
      expiresIn: 300, // 5 minutes
      ...(shouldExposeOtp() && { otp }),
    });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to send OTP",
      error: error.message,
    });
  }
};

/**
 * Verify OTP
 * POST /api/public/otp/verify
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { identifier, type, otp } = req.body;

    // Validate input
    if (!identifier || !type || !otp) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Identifier, type, and OTP are required",
      });
    }

    if (!["email", "mobile"].includes(type)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Type must be 'email' or 'mobile'",
      });
    }

    // Verify OTP
    const isValid = await otpService.verifyOTP(identifier, type, otp);

    if (!isValid) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Invalid or expired OTP",
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      message: "OTP verified successfully",
      verificationValid: "30 minutes",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to verify OTP",
      error: error.message,
    });
  }
};

/**
 * Check if identifier is verified
 * POST /api/public/otp/check-verification
 */
exports.checkVerification = async (req, res) => {
  try {
    const { identifier, type } = req.body;

    // Validate input
    if (!identifier || !type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Identifier and type are required",
      });
    }

    // Check verification
    const isVerified = await otpService.isVerified(identifier, type);

    res.status(StatusCodes.OK).json({
      success: true,
      verified: isVerified,
    });
  } catch (error) {
    console.error("Error checking verification:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to check verification",
      error: error.message,
    });
  }
};

/**
 * Get remaining time for OTP
 * POST /api/public/otp/remaining-time
 */
exports.getRemainingTime = async (req, res) => {
  try {
    const { identifier, type } = req.body;

    // Validate input
    if (!identifier || !type) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Identifier and type are required",
      });
    }

    // Get remaining time
    const remainingSeconds = await otpService.getRemainingTime(
      identifier,
      type,
    );

    if (remainingSeconds === -1) {
      return res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: "No active OTP found",
      });
    }

    res.status(StatusCodes.OK).json({
      success: true,
      remainingSeconds,
      remainingMinutes: Math.ceil(remainingSeconds / 60),
    });
  } catch (error) {
    console.error("Error getting remaining time:", error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to get remaining time",
      error: error.message,
    });
  }
};
