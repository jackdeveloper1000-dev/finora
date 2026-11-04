import bcrypt from 'bcryptjs';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { decrypt } from '../../utils/crypto.js';

const DEFAULT_PREFS = { notifyProcessed: true, notifyReturns: true };

export const verifyPassword = async (userId, password) => {
  const user = await queryOne('SELECT password_hash FROM users WHERE id = :userId', { userId });
  const ok = user?.password_hash && (await bcrypt.compare(password, user.password_hash));
  if (!ok) throw new AppError(403, 'INVALID_PASSWORD', 'That password is not correct.');
};

export const getAccount = async (userId) => {
  const user = await queryOne('SELECT id, name, email, mobile, mfa_enabled, created_at FROM users WHERE id = :userId', { userId });
  if (!user) throw AppError.notFound('Account not found');
  return { id: user.id, name: user.name, email: user.email, mobile: user.mobile, mfaEnabled: Boolean(user.mfa_enabled), createdAt: user.created_at };
};

export const updateAccount = async (userId, { name }) => {
  await query('UPDATE users SET name = :name WHERE id = :userId', { userId, name });
  return getAccount(userId);
};

export const getPreferences = async (userId) => {
  const row = await queryOne('SELECT notify_processed, notify_returns FROM user_settings WHERE user_id = :userId', { userId });
  return row ? { notifyProcessed: Boolean(row.notify_processed), notifyReturns: Boolean(row.notify_returns) } : DEFAULT_PREFS;
};

export const updatePreferences = async (userId, prefs) => {
  const next = { ...(await getPreferences(userId)), ...prefs };
  await query(
    `INSERT INTO user_settings (user_id, notify_processed, notify_returns) VALUES (:userId, :processed, :returns)
     ON DUPLICATE KEY UPDATE notify_processed = VALUES(notify_processed), notify_returns = VALUES(notify_returns)`,
    { userId, processed: next.notifyProcessed ? 1 : 0, returns: next.notifyReturns ? 1 : 0 },
  );
  return next;
};

const userFolder = (userId) => path.join(env.uploadDir, String(userId));

// Everything we hold about the user, in one portable file (DPDP-style "right to access").
export const exportData = async (userId, ip) => {
  const account = await getAccount(userId);
  const profile = await queryOne('SELECT * FROM taxpayer_profiles WHERE user_id = :userId', { userId });
  const cases = await query('SELECT * FROM itr_cases WHERE user_id = :userId ORDER BY id', { userId });

  const perCase = [];
  for (const c of cases) {
    const caseId = c.id;
    const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v);
    perCase.push({
      assessmentYear: c.assessment_year,
      itrForm: c.itr_form,
      taxRegime: c.tax_regime,
      status: c.status,
      approvedAt: c.approved_at,
      documents: (await query('SELECT id, doc_type, original_name, mime_type, size_bytes, file_hash, status, uploaded_at FROM documents WHERE case_id = :caseId', { caseId })),
      transactions: await query(
        `SELECT t.txn_date, t.description, t.debit, t.credit, t.balance, c.code AS category, t.user_status, t.source_row
           FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId ORDER BY t.txn_date, t.id`,
        { caseId },
      ),
      taxFacts: await query('SELECT fact_key, amount, source FROM tax_facts WHERE case_id = :caseId', { caseId }),
      eligibilityAnswers: await query('SELECT question_key, answer FROM questions WHERE case_id = :caseId', { caseId }),
      reconciliation: await query('SELECT rule_key, title, value_a, value_b, status, message, resolution_note FROM reconciliation_items WHERE case_id = :caseId', { caseId }),
      calculations: (await query('SELECT regime, gross_income, deductions, taxable_income, tax_payable, tds_credit, net_payable, trace_json, created_at FROM tax_calculations WHERE case_id = :caseId', { caseId })).map((r) => ({ ...r, trace_json: parse(r.trace_json) })),
      returnFields: await query('SELECT section, field_code, label, field_value, evidence FROM itr_fields WHERE case_id = :caseId', { caseId }),
    });
  }

  await recordAudit({ userId, action: 'account_export', ip }); // recorded first so the export lists itself
  const audit = await query('SELECT action, detail, ip_address, created_at FROM audit_events WHERE user_id = :userId ORDER BY id', { userId });

  return {
    meta: { generator: 'Finora', exportedAt: new Date().toISOString(), note: 'Uploaded files are not included; their details are listed under documents.' },
    account,
    preferences: await getPreferences(userId),
    taxpayerProfile: profile && { fullName: profile.full_name, pan: decrypt(profile.pan_encrypted), dateOfBirth: profile.dob, residentialStatus: profile.residential_status, occupation: profile.occupation, address: profile.address },
    returns: perCase,
    activity: audit.map((a) => ({ ...a, detail: typeof a.detail === 'string' ? JSON.parse(a.detail) : a.detail })),
  };
};

// Removes every return and uploaded file but keeps the account and taxpayer profile.
export const clearData = async (userId, password, ip) => {
  await verifyPassword(userId, password);
  await query('DELETE FROM itr_cases WHERE user_id = :userId', { userId });
  await query('DELETE FROM notifications WHERE user_id = :userId', { userId });
  await rm(userFolder(userId), { recursive: true, force: true });
  await recordAudit({ userId, action: 'data_cleared', ip });
};

export const deleteAccount = async (userId, password) => {
  await verifyPassword(userId, password);
  await rm(userFolder(userId), { recursive: true, force: true });
  await query('DELETE FROM audit_events WHERE user_id = :userId', { userId });
  await query('DELETE FROM users WHERE id = :userId', { userId });
};
