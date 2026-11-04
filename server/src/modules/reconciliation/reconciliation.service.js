import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { loadBankTotals, loadTaxFacts } from '../ledger/aggregates.js';
import { isOpen, reconcile } from './rules.js';

const toPaise = (value) => Math.round(Number(value) * 100);
const MIN_NOTE_LENGTH = 3;

const toRupees = (paise) => (paise === null ? null : (paise / 100).toFixed(2));
const sameAmount = (stored, next) => (stored === null ? next === null : next !== null && Number(stored) === Number(next));

// Recomputes from current ledger + facts, but keeps a person's resolution while the numbers are unchanged.
const syncItems = async (caseId) => {
  const computed = reconcile({ bank: await loadBankTotals(caseId), facts: await loadTaxFacts(caseId) });
  const existing = new Map((await query('SELECT * FROM reconciliation_items WHERE case_id = :caseId', { caseId })).map((r) => [r.rule_key, r]));

  for (const item of computed) {
    const prev = existing.get(item.ruleKey);
    const a = toRupees(item.valueA);
    const b = toRupees(item.valueB);
    const keepDecision = prev && ['resolved', 'escalated'].includes(prev.status) && sameAmount(prev.value_a, a) && sameAmount(prev.value_b, b);

    await query(
      `INSERT INTO reconciliation_items (case_id, rule_key, title, source_a, source_b, message, value_a, value_b, status)
       VALUES (:caseId, :ruleKey, :title, :sourceA, :sourceB, :message, :a, :b, :status)
       ON DUPLICATE KEY UPDATE title = VALUES(title), source_a = VALUES(source_a), source_b = VALUES(source_b), message = VALUES(message),
         value_a = VALUES(value_a), value_b = VALUES(value_b),
         status = ${keepDecision ? 'status' : 'VALUES(status)'},
         resolution_note = ${keepDecision ? 'resolution_note' : 'NULL'}`,
      { caseId, ruleKey: item.ruleKey, title: item.title, sourceA: item.sourceA, sourceB: item.sourceB, message: item.message.slice(0, 300), a, b, status: item.status },
    );
  }

  const live = computed.map((i) => `'${i.ruleKey}'`);
  await query(`DELETE FROM reconciliation_items WHERE case_id = :caseId${live.length ? ` AND rule_key NOT IN (${live.join(',')})` : ''}`, { caseId });
};

const toDto = (r) => ({
  id: r.id,
  ruleKey: r.rule_key,
  title: r.title,
  sourceA: r.source_a,
  sourceB: r.source_b,
  valueA: r.value_a === null ? null : Number(r.value_a),
  valueB: r.value_b === null ? null : Number(r.value_b),
  status: r.status,
  message: r.message,
  note: r.resolution_note,
});

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
};

export const getReconciliation = async (userId, caseId) => {
  await assertCaseOwner(userId, caseId);
  await syncItems(caseId);
  const rows = await query('SELECT * FROM reconciliation_items WHERE case_id = :caseId ORDER BY id', { caseId });
  const items = rows.map(toDto);
  return { items, open: items.filter((i) => isOpen(i.status)).length, escalated: items.filter((i) => i.status === 'escalated').length };
};

// Used by the dashboard readiness check.
export const countOpenItems = async (caseId) => {
  await syncItems(caseId);
  const { total } = await queryOne("SELECT COUNT(*) AS total FROM reconciliation_items WHERE case_id = :caseId AND status IN ('mismatch','missing','escalated')", { caseId });
  const { facts } = await queryOne('SELECT COUNT(*) AS facts FROM tax_facts WHERE case_id = :caseId', { caseId });
  return { open: Number(total), hasFacts: Number(facts) > 0 };
};

export const resolveItem = async (userId, id, { action, note }, ip) => {
  const item = await queryOne(
    'SELECT r.* FROM reconciliation_items r JOIN itr_cases c ON c.id = r.case_id WHERE r.id = :id AND c.user_id = :userId',
    { id, userId },
  );
  if (!item) throw AppError.notFound('Item not found');

  if (action === 'reopen') {
    await query("UPDATE reconciliation_items SET status = 'mismatch', resolution_note = NULL WHERE id = :id", { id });
  } else {
    if (item.status === 'matched') throw AppError.badRequest('This item already matches.', 'ALREADY_MATCHED');
    if (!note || note.trim().length < MIN_NOTE_LENGTH) {
      throw AppError.badRequest('Add a short explanation for your decision.', 'VALIDATION_ERROR', [{ field: 'note', message: 'Add a short explanation' }]);
    }
    await query('UPDATE reconciliation_items SET status = :status, resolution_note = :note WHERE id = :id', {
      id,
      status: action === 'escalate' ? 'escalated' : 'resolved',
      note: note.trim().slice(0, 255),
    });
  }
  await recordAudit({ caseId: item.case_id, userId, action: `reconciliation_${action}`, detail: { itemId: id, ruleKey: item.rule_key, note: note ?? null }, ip });
};
