import { asyncHandler } from '../../utils/asyncHandler.js';
import * as ledger from './ledger.service.js';

export const processStatement = asyncHandler(async (req, res) => {
  res.json({ result: await ledger.processDocument(req.user.id, req.params.id, req.ip) });
});

export const transactions = asyncHandler(async (req, res) => {
  res.json(await ledger.listTransactions(req.user.id, req.params.caseId, req.query));
});

export const summary = asyncHandler(async (req, res) => {
  res.json({ ledger: await ledger.getLedgerSummary(req.user.id, req.params.caseId) });
});
