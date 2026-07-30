const ApiError = require("./ApiError");

const parseDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPaymentDeadline = (job) =>
  parseDate(job?.paymentConfig?.paymentDeadline || job?.applicationDeadline);

const assertPaymentWindowOpen = (job) => {
  const deadline = getPaymentDeadline(job);
  if (deadline && new Date() > deadline) {
    throw new ApiError(400, "Payment deadline has passed");
  }
};

module.exports = { getPaymentDeadline, assertPaymentWindowOpen };
