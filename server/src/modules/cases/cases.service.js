import { rm } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { recordAudit } from '../../utils/audit.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { NEEDS_REVIEW_SQL } from '../classification/classification.service.js';
import { countOpenItems } from '../reconciliation/reconciliation.service.js';

const STEPS = [
  { key: 'documents', label: 'Upload documents' },
  { key: 'transactions', label: 'Extract transactions' },
  { key: 'review', label: 'Review classifications' },
  { key: 'reconcile', label: 'Reconcile with tax documents' },
  { key: 'tax', label: 'Compute tax' },
  { key: 'itr', label: 'Prepare ITR' },
];

const countOf = async (sql, caseId) => Number((await queryOne(sql, { caseId })).total);

const buildReadiness = async (row) => {
  const [documents, transactions, unreviewed, calculations, reconciliation] = await Promise.all([
    countOf('SELECT COUNT(*) AS total FROM documents WHERE case_id = :caseId', row.id),
    countOf('SELECT COUNT(*) AS total FROM bank_transactions WHERE case_id = :caseId', row.id),
    countOf(`SELECT COUNT(*) AS total FROM bank_transactions t LEFT JOIN categories c ON c.id = t.category_id WHERE t.case_id = :caseId AND ${NEEDS_REVIEW_SQL}`, row.id),
    countOf('SELECT COUNT(*) AS total FROM tax_calculations WHERE case_id = :caseId', row.id),
    countOpenItems(row.id),
  ]);

  const done = {
    documents: documents > 0,
    transactions: transactions > 0,
    review: transactions > 0 && unreviewed === 0,
    reconcile: (reconciliation.hasFacts || calculations > 0) && reconciliation.open === 0,
    tax: calculations > 0,
    itr: ['ready', 'approved', 'filed'].includes(row.status),
  };
  const steps = STEPS.map((s) => ({ ...s, done: done[s.key] }));
  return {
    steps,
    progress: Math.round((steps.filter((s) => s.done).length / steps.length) * 100),
    stats: { documents, transactions, unreviewed },
  };
};

const toDto = async (row) => ({
  id: row.id,
  assessmentYear: row.assessment_year,
  itrForm: row.itr_form,
  taxRegime: row.tax_regime,
  status: row.status,
  createdAt: row.created_at,
  readiness: await buildReadiness(row),
});

export const listCases = async (userId) => {
  const rows = await query('SELECT * FROM itr_cases WHERE user_id = :userId ORDER BY assessment_year DESC', { userId });
  return Promise.all(rows.map(toDto));
};

// Cheap listing (no progress calculation) for pickers and navigation.
export const listCaseYears = async (userId) => {
  const rows = await query('SELECT id, assessment_year FROM itr_cases WHERE user_id = :userId ORDER BY assessment_year DESC', { userId });
  return rows.map((r) => ({ id: r.id, assessmentYear: r.assessment_year }));
};

export const getCase = async (userId, id) => {
  const row = await queryOne('SELECT * FROM itr_cases WHERE id = :id AND user_id = :userId', { id, userId });
  if (!row) throw AppError.notFound('Return not found');
  return toDto(row);
};

export const createCase = async (userId, { assessmentYear }) => {
  const profile = await queryOne('SELECT id FROM taxpayer_profiles WHERE user_id = :userId', { userId });
  if (!profile) throw AppError.badRequest('Complete your taxpayer profile first', 'PROFILE_REQUIRED');

  try {
    const result = await query('INSERT INTO itr_cases (user_id, assessment_year) VALUES (:userId, :assessmentYear)', {
      userId,
      assessmentYear,
    });
    return getCase(userId, result.insertId);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw AppError.conflict(`You already have a return for AY ${assessmentYear}`, 'CASE_EXISTS');
    throw err;
  }
};

export const deleteCase = async (userId, id, ip) => {
  const row = await queryOne('SELECT id, assessment_year FROM itr_cases WHERE id = :id AND user_id = :userId', { id, userId });
  if (!row) throw AppError.notFound('Return not found');
  await query('DELETE FROM notifications WHERE case_id = :id', { id });
  await query('DELETE FROM itr_cases WHERE id = :id', { id });
  await rm(path.join(env.uploadDir, String(userId), String(id)), { recursive: true, force: true });
  await recordAudit({ userId, action: 'case_delete', detail: { assessmentYear: row.assessment_year }, ip });
};

export const listAssessmentYears = () => env.supportedAssessmentYears;
