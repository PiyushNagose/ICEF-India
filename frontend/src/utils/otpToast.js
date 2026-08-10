import toast from "react-hot-toast";

const extractOtp = (response) =>
  response?.otp ||
  response?.data?.otp ||
  response?.payload?.otp ||
  response?.result?.otp ||
  null;

export const showOtpToast = (response, fallbackMessage) => {
  const otp = extractOtp(response);
  if (!otp) {
    toast.success(fallbackMessage);
    return;
  }

  toast.success(`${fallbackMessage}. Test OTP: ${otp}`, {
    duration: 12000,
    style: {
      maxWidth: "360px",
      lineHeight: "1.35",
      wordBreak: "break-word",
    },
  });
};
