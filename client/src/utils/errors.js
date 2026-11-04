const FALLBACK = 'Something went wrong. Please try again.';

export const getErrorMessage = (err) => {
  if (err?.response) return err.response.data?.error?.message || FALLBACK;
  if (err?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (err?.request) return 'Cannot reach the server. Check your connection and try again.';
  return err?.message || FALLBACK;
};

export const getFieldErrors = (err) => {
  const details = err?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return details.reduce((acc, { field, message }) => {
    if (field && !acc[field]) acc[field] = message;
    return acc;
  }, {});
};

export const getErrorCode = (err) => err?.response?.data?.error?.code;
