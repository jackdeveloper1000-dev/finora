export const MAX_UPLOAD_MB = 10;
export const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls', 'csv'];
export const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(',');

export const validateFile = (file) => {
  const ext = file.name.split('.').pop().toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return `Unsupported file type. Use ${ACCEPTED_EXTENSIONS.join(', ').toUpperCase()}.`;
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `File is larger than ${MAX_UPLOAD_MB} MB.`;
  return '';
};
