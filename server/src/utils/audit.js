import { query } from '../config/db.js';
import { errorFields, logger } from './logger.js';

export const recordAudit = async ({ caseId = null, userId = null, action, detail = null, ip = null }) => {
  try {
    await query(
      'INSERT INTO audit_events (case_id, user_id, action, detail, ip_address) VALUES (:caseId, :userId, :action, :detail, :ip)',
      { caseId, userId, action, detail: detail && JSON.stringify(detail), ip },
    );
  } catch (err) {
    logger.error('failed to record audit event', { action, ...errorFields(err) });
  }
};
