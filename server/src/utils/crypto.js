import crypto from 'node:crypto';
import { env } from '../config/env.js';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = (bytes = 48) => crypto.randomBytes(bytes).toString('hex');

export const encrypt = (plain) => {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', env.dataKey, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]);
};

const decryptToBuffer = (payload) => {
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', env.dataKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload.subarray(IV_LENGTH + TAG_LENGTH)), decipher.final()]);
};

export const decrypt = (payload) => decryptToBuffer(payload).toString('utf8');

// Stored files carry a magic prefix so files written before encryption was added still open.
const FILE_MAGIC = Buffer.from('FNR1');

export const encryptBytes = (bytes) => Buffer.concat([FILE_MAGIC, encrypt(bytes)]);

export const decryptBytes = (stored) =>
  stored.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC) ? decryptToBuffer(stored.subarray(FILE_MAGIC.length)) : stored;
