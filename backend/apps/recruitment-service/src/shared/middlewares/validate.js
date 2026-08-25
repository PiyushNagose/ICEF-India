const { z } = require("zod");
const ApiError = require("../utils/ApiError");

/**
 * Zod validation middleware factory.
 * Usage: validate(schema) — validates req.body by default.
 * Usage: validate(schema, 'query') — validates req.query.
 * Usage: validate(schema, 'params') — validates req.params.
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.errors.map((err) => ({
        field: err.path.join("."),
        message: err.message,
      }));
      const detailedMessage = "Validation failed: " + errors.map(e => `${e.field} (${e.message})`).join(", ");
      throw new ApiError(400, detailedMessage, errors);
    }

    // Replace the source with the parsed (and coerced) data
    req[source] = result.data;
    next();
  };
};

module.exports = validate;
