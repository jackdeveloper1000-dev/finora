import { asyncHandler } from '../../utils/asyncHandler.js';
import * as documents from './documents.service.js';

export const list = asyncHandler(async (req, res) => {
  res.json({ documents: await documents.listDocuments(req.user.id, req.params.caseId) });
});

export const upload = asyncHandler(async (req, res) => {
  const document = await documents.uploadDocument(
    req.user.id,
    req.params.caseId,
    { file: req.file, docType: req.body.docType },
    req.ip,
  );
  res.status(201).json({ document });
});

export const remove = asyncHandler(async (req, res) => {
  await documents.deleteDocument(req.user.id, req.params.id, req.ip);
  res.status(204).end();
});

export const link = asyncHandler(async (req, res) => {
  res.json(await documents.createAccessLink(req.user.id, req.params.id));
});

export const file = asyncHandler(async (req, res) => {
  const { read, name, mime, disposition } = await documents.resolveAccessLink(req.query.t);
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.send(await read());
});
