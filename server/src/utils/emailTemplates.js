import { env } from '../config/env.js';

const escapeHtml = (value) =>
  String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Inline styles only: most mail clients ignore <style> blocks.
const layout = ({ preheader, heading, body }) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:0;background:#fbfaff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fbfaff;padding:32px 12px;"><tr><td align="center">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e0f7;border-radius:18px;overflow:hidden;">
    <tr><td style="background:#5427d6;padding:22px 28px;"><span style="display:inline-block;width:30px;height:30px;line-height:30px;text-align:center;border-radius:8px;background:#ffffff;color:#5427d6;font-weight:800;vertical-align:middle;">F</span><span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.02em;vertical-align:middle;margin-left:10px;">Finora</span></td></tr>
    <tr><td style="padding:30px 28px 8px;"><h1 style="margin:0;font-size:22px;letter-spacing:-0.02em;color:#1a1240;">${escapeHtml(heading)}</h1></td></tr>
    <tr><td style="padding:8px 28px 28px;font-size:15px;line-height:1.6;color:#334155;">${body}</td></tr>
    <tr><td style="padding:18px 28px;background:#faf8ff;border-top:1px solid #e6e0f7;font-size:12px;line-height:1.5;color:#8b95ad;"><strong style="color:#5b587a;">Finora</strong> — Your AI-powered tax &amp; financial assistant for India.<br>You received this email because of activity on your Finora account. Finora prepares returns for your review and is not tax or legal advice.</td></tr>
  </table>
</td></tr></table></body></html>`;

export const verificationEmail = ({ name, code, minutes }) => ({
  subject: `${code} is your Finora verification code`,
  text: `Hi ${name},\n\nYour Finora verification code is ${code}. It expires in ${minutes} minutes.\n\nIf you did not create a Finora account, you can ignore this email.`,
  html: layout({
    preheader: `Your verification code is ${code}`,
    heading: 'Verify your email address',
    body: `<p style="margin:0 0 16px;">Hi ${escapeHtml(name)}, welcome to Finora. Enter this code to confirm your email and finish creating your account.</p>
<div style="margin:20px 0;padding:18px;text-align:center;background:#f5f1ff;border:1px solid #e6e0f7;border-radius:14px;"><span style="font-family:Consolas,Menlo,monospace;font-size:34px;font-weight:800;letter-spacing:0.35em;color:#5427d6;padding-left:0.35em;">${escapeHtml(code)}</span></div>
<p style="margin:0 0 8px;">This code expires in <strong>${minutes} minutes</strong> and can only be used once.</p>
<p style="margin:0;color:#64748b;font-size:13px;">Never share this code with anyone. Finora will never ask for it by phone or chat. If you did not sign up, you can safely ignore this email.</p>`,
  }),
});

export const resetEmail = ({ name, token, minutes }) => {
  const link = `${env.clientUrl}/reset-password?token=${token}`;
  return {
    subject: 'Reset your Finora password',
    text: `Hi ${name},\n\nUse this link to choose a new password. It works once and expires in ${minutes} minutes:\n\n${link}\n\nIf you did not ask for this, you can ignore this email; your password has not changed.`,
    html: layout({
      preheader: 'Choose a new password for your Finora account',
      heading: 'Reset your password',
      body: `<p style="margin:0 0 20px;">Hi ${escapeHtml(name)}, we received a request to reset your Finora password. The link below works once and expires in <strong>${minutes} minutes</strong>.</p>
<p style="margin:0 0 24px;"><a href="${link}" style="display:inline-block;padding:13px 28px;border-radius:999px;background:#5427d6;color:#ffffff;font-weight:700;text-decoration:none;">Choose a new password</a></p>
<p style="margin:0 0 8px;color:#64748b;font-size:13px;">Button not working? Paste this link into your browser:<br><span style="word-break:break-all;color:#6d3df2;">${link}</span></p>
<p style="margin:0;color:#64748b;font-size:13px;">If you did not ask for this, ignore this email. Your password has not changed.</p>`,
    }),
  };
};
