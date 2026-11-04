const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);
const ascii = (text) => [...text].map((c) => c.charCodeAt(0));
const looksLikeText = (buf) => !buf.subarray(0, 4096).includes(0);

const TYPES = [
  { ext: 'pdf', mime: 'application/pdf', matches: (b) => startsWith(b, ascii('%PDF-')) },
  { ext: 'png', mime: 'image/png', matches: (b) => startsWith(b, [0x89, 0x50, 0x4e, 0x47]) },
  { ext: 'jpg', mime: 'image/jpeg', matches: (b) => startsWith(b, [0xff, 0xd8, 0xff]) },
  {
    ext: 'xlsx',
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    matches: (b) => startsWith(b, [0x50, 0x4b, 0x03, 0x04]),
  },
  { ext: 'xls', mime: 'application/vnd.ms-excel', matches: (b) => startsWith(b, [0xd0, 0xcf, 0x11, 0xe0]) },
  { ext: 'csv', mime: 'text/csv', matches: looksLikeText },
];

export const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'xls', 'csv'];
export const INLINE_MIME_TYPES = new Set(['application/pdf', 'image/png', 'image/jpeg']);

// Trusts file content over the client-supplied name/mime: the extension must agree with the bytes.
export const detectFileType = (buffer, filename) => {
  const raw = filename.split('.').pop().toLowerCase();
  const ext = raw === 'jpeg' ? 'jpg' : raw;
  const type = TYPES.find((t) => t.ext === ext);
  return type && buffer.length > 0 && type.matches(buffer) ? { ext, mime: type.mime } : null;
};
