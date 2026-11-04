import { asyncHandler } from '../../utils/asyncHandler.js';
import * as cases from './cases.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ cases: await cases.listCases(req.user.id), supportedYears: cases.listAssessmentYears() });
});

export const years = asyncHandler(async (req, res) => {
  res.json({ cases: await cases.listCaseYears(req.user.id) });
});

export const get = asyncHandler(async (req, res) => {
  res.json({ case: await cases.getCase(req.user.id, req.params.id) });
});

export const remove = asyncHandler(async (req, res) => {
  await cases.deleteCase(req.user.id, req.params.id, req.ip);
  res.status(204).end();
});

export const create = asyncHandler(async (req, res) => {
  res.status(201).json({ case: await cases.createCase(req.user.id, req.body) });
});
