import { bulkInsert, query, queryOne, transaction } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { FACT_SOURCES, factKeysOf } from './definitions.js';

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
};

export const getTaxFacts = async (userId, caseId) => {
  await assertCaseOwner(userId, caseId);
  const saved = await query('SELECT fact_key, source, amount, document_id FROM tax_facts WHERE case_id = :caseId', { caseId });
  const documents = await query(
    "SELECT id, original_name, doc_type FROM documents WHERE case_id = :caseId AND doc_type IN ('form16','ais','form26as') ORDER BY id DESC",
    { caseId },
  );

  return {
    sources: Object.entries(FACT_SOURCES).map(([key, def]) => {
      const rows = saved.filter((r) => r.source === key);
      return {
        key,
        label: def.label,
        hint: def.hint,
        documentId: rows.find((r) => r.document_id)?.document_id ?? null,
        facts: def.facts.map((f) => {
          const stored = rows.find((r) => r.fact_key === f.key);
          return { ...f, amount: stored ? Number(stored.amount) : null };
        }),
      };
    }),
    documents: documents.map((d) => ({ id: d.id, name: d.original_name, docType: d.doc_type })),
  };
};

export const saveTaxFacts = async (userId, caseId, source, { values, documentId }, ip) => {
  await assertCaseOwner(userId, caseId);
  const def = FACT_SOURCES[source];
  if (!def) throw AppError.notFound('Unknown tax document type');

  const allowed = new Set(factKeysOf(source));
  const unknown = Object.keys(values).filter((k) => !allowed.has(k));
  if (unknown.length) throw AppError.badRequest('Unknown field', 'VALIDATION_ERROR', unknown.map((field) => ({ field: `values.${field}`, message: 'Unknown field' })));

  if (documentId) {
    const doc = await queryOne('SELECT id FROM documents WHERE id = :documentId AND case_id = :caseId AND doc_type = :docType', { documentId, caseId, docType: def.docType });
    if (!doc) throw AppError.badRequest(`Select an uploaded ${def.label} document from this return.`, 'VALIDATION_ERROR', [{ field: 'documentId', message: `Not a ${def.label} document in this return` }]);
  }

  const entries = Object.entries(values);
  const toSave = entries.filter(([, amount]) => amount !== null);
  const toClear = entries.filter(([, amount]) => amount === null).map(([key]) => key);

  await transaction(async (run) => {
    for (const key of toClear) await run('DELETE FROM tax_facts WHERE case_id = :caseId AND source = :source AND fact_key = :key', { caseId, source, key });
    if (toSave.length) {
      const rows = toSave.map(([fact_key, amount]) => ({ case_id: caseId, fact_key, amount: amount.toFixed(2), source, document_id: documentId ?? null, confirmed: 1 }));
      // Keys were validated against the fixed definition list above, so inlining them is safe.
      await run(`DELETE FROM tax_facts WHERE case_id = :caseId AND source = :source AND fact_key IN (${toSave.map(([k]) => `'${k}'`).join(',')})`, { caseId, source });
      await bulkInsert(run, 'tax_facts', ['case_id', 'fact_key', 'amount', 'source', 'document_id', 'confirmed'], rows);
    }
  });

  await recordAudit({ caseId, userId, action: 'tax_facts_save', detail: { source, keys: entries.map(([k]) => k), documentId: documentId ?? null }, ip });
  return getTaxFacts(userId, caseId);
};
