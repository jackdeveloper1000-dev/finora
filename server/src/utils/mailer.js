import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { errorFields, logger } from './logger.js';

// Recent messages in log mode, so tests can read the emailed link.
export const outbox = [];

let transporter;
const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: { user: env.mail.user, pass: env.mail.password },
  });
  return transporter;
};

// With MAIL_TRANSPORT=log (the default) nothing leaves the machine; the message is printed for development.
export const sendMail = async ({ to, subject, text, html }) => {
  if (env.mail.transport !== 'smtp') {
    outbox.push({ to, subject, text, html });
    if (outbox.length > 20) outbox.shift();
    logger.info('mail (not sent, MAIL_TRANSPORT=log)', env.isProd ? { subject } : { to, subject, text });
    return;
  }
  try {
    await getTransporter().sendMail({ from: env.mail.from, to, subject, text, html });
  } catch (err) {
    logger.error('failed to send mail', { subject, ...errorFields(err) });
  }
};
