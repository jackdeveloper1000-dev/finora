import { query, queryOne, transaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { getReturn } from '../itr/itr.service.js';
import { notify } from '../notifications/notifications.service.js';
import { activeProvider } from './providers.js';

const toDto = (row) => row && {
  provider: row.provider,
  ackNumber: row.ack_number,
  filedOn: row.filed_on,
  eVerified: Boolean(row.e_verified),
  recordedAt: row.created_at,
};

const loadCase = async (userId, caseId) => {
  const row = await queryOne('SELECT id, user_id, assessment_year, status, approved_hash FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
  return row;
};

export const getSubmission = async (userId, caseId) => {
  const kase = await loadCase(userId, caseId);
  const itr = await getReturn(userId, caseId);
  const submission = await queryOne('SELECT * FROM filing_submissions WHERE case_id = :caseId', { caseId });
  const provider = activeProvider();
  return {
    assessmentYear: kase.assessment_year,
    provider: { key: provider.key, name: provider.name, directFiling: provider.directFiling, notice: provider.notice, portalUrl: provider.portalUrl },
    status: itr.status,
    canFile: itr.canExport && !submission,
    submission: toDto(submission),
  };
};

// The portal gives the taxpayer an acknowledgement number once the return is submitted; recording it closes the return.
export const recordFiling = async (userId, caseId, { ackNumber, filedOn, eVerified }, ip) => {
  const kase = await loadCase(userId, caseId);
  const itr = await getReturn(userId, caseId);
  if (!itr.canExport) throw new AppError(409, 'NOT_APPROVED', 'Approve the return before recording that you filed it.');
  if (await queryOne('SELECT id FROM filing_submissions WHERE case_id = :caseId', { caseId })) {
    throw AppError.conflict('This return is already marked as filed.', 'ALREADY_FILED');
  }

  const provider = activeProvider();
  await transaction(async (run) => {
    await run(
      'INSERT INTO filing_submissions (case_id, provider, ack_number, filed_on, e_verified, return_hash) VALUES (:caseId, :provider, :ackNumber, :filedOn, :eVerified, :hash)',
      { caseId, provider: provider.key, ackNumber, filedOn, eVerified: eVerified ? 1 : 0, hash: kase.approved_hash },
    );
    await run("UPDATE itr_cases SET status = 'filed' WHERE id = :caseId", { caseId });
  });
  await recordAudit({ caseId, userId, action: 'itr_filed', detail: { provider: provider.key, ackNumber, filedOn, eVerified: Boolean(eVerified) }, ip });
  await notify(userId, { type: 'return_filed', title: `Your AY ${kase.assessment_year} return is marked as filed`, body: `Acknowledgement ${ackNumber}`, link: `/cases/${caseId}/file-itr`, caseId });
  return getSubmission(userId, caseId);
};

export const submissionOf = (caseId) => query('SELECT * FROM filing_submissions WHERE case_id = :caseId', { caseId });
