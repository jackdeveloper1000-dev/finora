export const RESIDENTIAL_STATUS = [
  { value: 'resident', label: 'Resident' },
  { value: 'nri', label: 'Non-resident (NRI)' },
  { value: 'rnor', label: 'Resident but not ordinarily resident' },
];

export const OCCUPATION = [
  { value: 'salaried', label: 'Salaried employee' },
  { value: 'freelancer', label: 'Freelancer / professional' },
  { value: 'business', label: 'Business owner' },
  { value: 'investor', label: 'Investor' },
  { value: 'other', label: 'Other' },
];

export const CASE_STATUS = {
  draft: { label: 'Draft', tone: 'neutral' },
  processing: { label: 'Processing', tone: 'info' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  needs_expert: { label: 'Expert review', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  approved: { label: 'Approved', tone: 'success' },
  filed: { label: 'Filed', tone: 'success' },
};

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || 'there';

export const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';

export const DOC_TYPES = [
  { value: 'bank_statement', label: 'Bank statement' },
  { value: 'form16', label: 'Form 16' },
  { value: 'ais', label: 'AIS / TIS' },
  { value: 'form26as', label: 'Form 26AS' },
  { value: 'interest_cert', label: 'Interest certificate' },
  { value: 'investment_proof', label: 'Investment proof' },
  { value: 'other', label: 'Other' },
];

export const DOC_STATUS = {
  uploaded: { label: 'Uploaded', tone: 'info' },
  processing: { label: 'Processing', tone: 'info' },
  extracted: { label: 'Extracted', tone: 'success' },
  needs_review: { label: 'Needs review', tone: 'warning' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'warning' },
};

export const labelOf = (items, value) => items.find((i) => i.value === value)?.label ?? value;

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const formatDateTime = (value) =>
  new Date(value.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const formatINR = (amount) => inr.format(amount);

const DATE_ONLY = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const formatDate = (iso) => DATE_ONLY.format(new Date(`${iso}T00:00:00Z`));

export const monthLabel = (ym) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' });

export const RECON_STATUS = {
  matched: { label: 'Matched', tone: 'success' },
  mismatch: { label: 'Mismatch', tone: 'warning' },
  missing: { label: 'Missing data', tone: 'warning' },
  resolved: { label: 'Resolved', tone: 'info' },
  escalated: { label: 'Expert review', tone: 'info' },
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

// "Mozilla/5.0 (Windows NT 10.0; Win64) ... Edg/120" -> "Edge on Windows"
export const describeDevice = (userAgent) => {
  if (!userAgent) return 'Unknown device';
  const browser = /Edg\//.test(userAgent) ? 'Edge' : /OPR\//.test(userAgent) ? 'Opera' : /Chrome\//.test(userAgent) ? 'Chrome' : /Firefox\//.test(userAgent) ? 'Firefox' : /Safari\//.test(userAgent) ? 'Safari' : 'Browser';
  const system = /Windows/.test(userAgent) ? 'Windows' : /Android/.test(userAgent) ? 'Android' : /iPhone|iPad/.test(userAgent) ? 'iOS' : /Mac OS/.test(userAgent) ? 'macOS' : /Linux/.test(userAgent) ? 'Linux' : '';
  return system ? `${browser} on ${system}` : browser;
};
