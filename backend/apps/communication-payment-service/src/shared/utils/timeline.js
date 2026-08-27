const ApiError = require("./ApiError");

const parseDate = (value) => {
  if (!value) return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoDateOnly = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoDateOnly) {
      const [, year, month, day] = isoDateOnly.map(Number);
      return new Date(year, month - 1, day);
    }

    const indianDate = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (indianDate) {
      const [, day, month, year] = indianDate.map(Number);
      return new Date(year, month - 1, day);
    }
  }

  const date = new Date(value);
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
