import 'dotenv/config';
import path from 'node:path';

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

const nodeEnv = process.env.NODE_ENV || 'development';

export const env = {
  nodeEnv,
  isProd: nodeEnv === 'production',
  port: Number(process.env.PORT) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'finora_db',
  },
  jwtSecret: required('JWT_SECRET'),
  dataKey: Buffer.from(required('DATA_ENCRYPTION_KEY'), 'hex'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR || 'uploads'),
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 10,
  scan: {
    provider: process.env.SCAN_PROVIDER || 'none', // 'none' | 'clamav'
    host: process.env.CLAMAV_HOST || '127.0.0.1',
    port: Number(process.env.CLAMAV_PORT) || 3310,
    failClosed: process.env.SCAN_FAIL_CLOSED !== 'false',
  },
  google: { clientId: process.env.GOOGLE_CLIENT_ID || '' },
  mail: {
    // Sends for real only when MAIL_MAILER=smtp and a password is set; otherwise messages are printed to the server log.
    transport: process.env.MAIL_MAILER === 'smtp' && process.env.MAIL_PASSWORD ? 'smtp' : 'log',
    host: process.env.MAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT) || 465,
    secure: process.env.MAIL_ENCRYPTION === 'ssl' || Number(process.env.MAIL_PORT) === 465,
    user: process.env.MAIL_USERNAME || '',
    password: process.env.MAIL_PASSWORD || '',
    from: `${process.env.MAIL_FROM_NAME || 'Finora'} <${process.env.MAIL_FROM_ADDRESS || process.env.MAIL_USERNAME || 'no-reply@finora.local'}>`,
  },
  documentLinkTtl: '2m',
  accessTokenTtl: '15m',
  refreshTokenTtlDays: 30,
  maxFailedLogins: 5,
  lockMinutes: 15,
  refreshGraceSeconds: 10,
  supportedAssessmentYears: ['2026-27', '2025-26'],
};

if (env.dataKey.length !== 32) {
  throw new Error('DATA_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
}
if (env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters');
}
if (env.isProd && !env.clientUrl.startsWith('https://')) {
  throw new Error('CLIENT_URL must use https in production');
}
