const nodemailer = require("nodemailer");
const env = require("../config/env");
const logger = require("../utils/logger");

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    logger.warn("⚠️  SMTP credentials not configured. Email sending disabled.");
    return null;
  }

  try {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false, // true for 465, false for other ports
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });

    logger.info(`📧 Email service configured: ${env.SMTP_USER}`);
    return transporter;
  } catch (error) {
    logger.error(`Email service configuration failed: ${error.message}`);
    return null;
  }
};

// Initialize transporter
const getTransporter = () => {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
};

// Send email function
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transport = getTransporter();

    if (!transport) {
      logger.warn(`Email not sent (SMTP not configured): ${subject} to ${to}`);
      return { success: false, message: "SMTP not configured" };
    }

    const mailOptions = {
      from: `"${env.EMAIL_FROM_NAME || "Recruitment Portal"}" <${env.EMAIL_FROM}>`,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    };

    const info = await transport.sendMail(mailOptions);
    logger.info(`📧 Email sent: ${subject} to ${to} (${info.messageId})`);

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error(`Email sending failed: ${error.message}`);
    return { success: false, error: error.message };
  }
};

// Email templates
const sendOTPEmail = async (to, otp, name) => {
  const subject = "Verify Your Email - OTP";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Email Verification</h2>
      <p>Hello ${name},</p>
      <p>Your OTP for email verification is:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>If you didn't request this, please ignore this email.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendWelcomeEmail = async (to, name, employeeId, tempPassword, mode = "created") => {
  const isReset = mode === "reset";
  const subject = isReset
    ? "Recruitment Portal Password Reset"
    : "Welcome to Recruitment Portal";
  const loginUrl = `${env.CLIENT_URL}/auth/employee-login`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">${isReset ? "Password Reset" : "Welcome to Recruitment Portal!"}</h2>
      <p>Hello ${name},</p>
      <p>Your employee account has been ${isReset ? "updated with a new temporary password" : "created successfully"}.</p>
      <div style="background: #f4f4f4; padding: 20px; margin: 20px 0;">
        <p><strong>Employee ID:</strong> ${employeeId}</p>
        <p><strong>Email:</strong> ${to}</p>
        <p><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>
      <p><strong>Important:</strong> Please change your password after first login.</p>
      <p>Login at: <a href="${loginUrl}">${loginUrl}</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendPasswordResetEmail = async (to, otp, name, accountType = "candidate") => {
  const subject = "Password Reset Request";
  const resetUrl = `${env.CLIENT_URL}/auth/forgot-password?type=${accountType}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Password Reset</h2>
      <p>Hello ${name},</p>
      <p>You requested to reset your password. Use the OTP below:</p>
      <div style="background: #f4f4f4; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p>This OTP is valid for 10 minutes.</p>
      <p>Reset here: <a href="${resetUrl}">${resetUrl}</a></p>
      <p>If you didn't request this, please ignore this email and your password will remain unchanged.</p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendPaymentSuccessEmail = async (to, name, transactionId, amount) => {
  const subject = "Payment Successful - Application Fee";
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Payment Successful!</h2>
      <p>Hello ${name},</p>
      <p>Your payment has been processed successfully.</p>
      <div style="background: #f4f4f4; padding: 20px; margin: 20px 0;">
        <p><strong>Transaction ID:</strong> ${transactionId}</p>
        <p><strong>Amount:</strong> ₹${amount}</p>
        <p><strong>Status:</strong> <span style="color: #28a745;">Success</span></p>
      </div>
      <p>You can now proceed with your application.</p>
      <p>View your application: <a href="${env.CLIENT_URL}/candidate/applications">${env.CLIENT_URL}/candidate/applications</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendTicketReplyEmail = async (to, ticketId, message) => {
  const subject = `Support Ticket Update - ${ticketId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Support Ticket Update</h2>
      <p>Your support ticket <strong>${ticketId}</strong> has a new reply:</p>
      <div style="background: #f4f4f4; padding: 20px; margin: 20px 0; border-left: 4px solid #007bff;">
        ${message}
      </div>
      <p>View ticket: <a href="${env.CLIENT_URL}/candidate/support">${env.CLIENT_URL}/candidate/support</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

const sendTicketResolvedEmail = async (to, ticketId) => {
  const subject = `Support Ticket Resolved - ${ticketId}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #28a745;">Ticket Resolved</h2>
      <p>Your support ticket <strong>${ticketId}</strong> has been resolved.</p>
      <p>If you have any further questions, feel free to create a new ticket.</p>
      <p>View tickets: <a href="${env.CLIENT_URL}/candidate/support">${env.CLIENT_URL}/candidate/support</a></p>
      <hr style="margin: 30px 0; border: none; border-top: 1px solid #ddd;">
      <p style="color: #666; font-size: 12px;">Government Recruitment Portal</p>
    </div>
  `;

  return sendEmail({ to, subject, html });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendPaymentSuccessEmail,
  sendTicketReplyEmail,
  sendTicketResolvedEmail,
};
