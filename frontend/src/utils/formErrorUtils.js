/**
 * Extracts field-level validation errors from an API response.
 * Expects the backend to return { statusCode, message, errors: [{ field, message }] }
 * 
 * @param {Error} error - The axios error object
 * @returns {Record<string, string>} - Map of field names to error messages
 */
export const extractApiErrors = (error) => {
  const extractedErrors = {};
  
  if (error?.response?.data?.errors && Array.isArray(error.response.data.errors)) {
    error.response.data.errors.forEach((err) => {
      if (err.field && err.message) {
        extractedErrors[err.field] = err.message;
      }
    });
  }
  
  return extractedErrors;
};
