const ApiError = require("./ApiError");

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const endOfDay = (value) => {
  const date = parseDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
};

const getPaymentDeadline = (job) =>
  parseDate(job?.paymentConfig?.paymentDeadline || job?.applicationDeadline);

const assertPaymentWindowOpen = (job) => {
  const deadline = endOfDay(getPaymentDeadline(job));
  if (deadline && new Date() > deadline) {
    throw new ApiError(400, "Payment deadline has passed");
  }
};

module.exports = { getPaymentDeadline, assertPaymentWindowOpen };
