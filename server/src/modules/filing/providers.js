// Filing is the last step and sits behind this small boundary, so a certified adapter can replace "manual" later
// without touching the ledger, tax engine or return mapping.
const PORTAL_URL = 'https://www.incometax.gov.in/iec/foportal/';

const manual = {
  key: 'manual',
  name: 'File on the e-Filing portal',
  directFiling: false,
  portalUrl: PORTAL_URL,
  notice: 'Finora prepares and checks your return; you submit it on the Income Tax e-Filing portal and record the acknowledgement here.',
};

// Not enabled: the Income Tax Department only lets registered e-Return Intermediaries submit returns through its APIs.
export const eriProvider = {
  key: 'eri',
  name: 'Direct e-filing (ERI)',
  directFiling: true,
  available: false,
  notice: 'Requires registration as an e-Return Intermediary, a digital signature certificate and the Department\'s API credentials.',
};

export const activeProvider = () => manual;
