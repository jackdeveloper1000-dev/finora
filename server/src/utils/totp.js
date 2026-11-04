import crypto from 'node:crypto';

// RFC 6238 time-based one-time passwords (HMAC-SHA1, 30-second steps), as used by Google Authenticator and similar apps.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export const base32Encode = (buffer) => {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  return (bits.match(/.{1,5}/g) ?? []).map((chunk) => ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)]).join('');
};

export const base32Decode = (text) => {
  const bits = [...text.replace(/=+$/, '').toUpperCase()].map((c) => ALPHABET.indexOf(c).toString(2).padStart(5, '0')).join('');
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
};

export const generateSecret = () => base32Encode(crypto.randomBytes(20));

export const totpCode = (secret, timeMs = Date.now(), digits = 6) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / 1000 / STEP_SECONDS)));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const value = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(value % 10 ** digits).padStart(digits, '0');
};

// Accepts the neighbouring steps too, to tolerate small clock differences.
export const verifyTotp = (secret, code, timeMs = Date.now(), window = 1) => {
  if (!/^\d{6}$/.test(String(code))) return false;
  for (let drift = -window; drift <= window; drift++) {
    const candidate = totpCode(secret, timeMs + drift * STEP_SECONDS * 1000);
    if (crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(String(code)))) return true;
  }
  return false;
};

export const otpauthUrl = ({ secret, account, issuer = 'Finora' }) =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&digits=6&period=${STEP_SECONDS}`;
