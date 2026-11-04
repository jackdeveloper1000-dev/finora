import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { decryptBytes, encryptBytes, sha256 } from '../../utils/crypto.js';
import { scanBuffer } from '../../utils/malwareScan.js';
import { ALLOWED_EXTENSIONS, INLINE_MIME_TYPES, detectFileType } from '../../utils/fileType.js';

const LINK_PURPOSE = 'document';

const toDto = (row) => ({
  id: row.id,
  caseId: row.case_id,
  docType: row.doc_type,
  name: row.original_name,
  mimeType: row.mime_type,
  size: row.size_bytes,
  status: row.status,
  errorMessage: row.error_message,
  uploadedAt: row.uploaded_at,
});

// Resolves a stored relative path and refuses anything that escapes the upload root.
const absolutePath = (relative) => {
  const full = path.resolve(env.uploadDir, relative);
  if (!full.startsWith(env.uploadDir + path.sep)) throw AppError.forbidden();
  return full;
};

const cleanName = (name) => path.basename(name).replace(/[\u0000-\u001f<>:"/\\|?*]/g, '_').slice(0, 255) || 'document';

const assertCaseOwner = async (userId, caseId) => {
  const row = await queryOne('SELECT id FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!row) throw AppError.notFound('Return not found');
};

export const findOwnedDocument = async (userId, id) => {
  const row = await queryOne(
    `SELECT d.* FROM documents d JOIN itr_cases c ON c.id = d.case_id WHERE d.id = :id AND c.user_id = :userId`,
    { id, userId },
  );
  if (!row) throw AppError.notFound('Document not found');
  return row;
};

const removeFile = (relative) => unlink(absolutePath(relative)).catch((err) => err.code !== 'ENOENT' && console.error(err));

export const readStoredFile = async (doc) => decryptBytes(await readFile(absolutePath(doc.storage_path)));

export const listDocuments = async (userId, caseId) => {
  await assertCaseOwner(userId, caseId);
  const rows = await query('SELECT * FROM documents WHERE case_id = :caseId ORDER BY uploaded_at DESC, id DESC', { caseId });
  return rows.map(toDto);
};

export const uploadDocument = async (userId, caseId, { file, docType }, ip) => {
  await assertCaseOwner(userId, caseId);
  if (!file) throw AppError.badRequest('Choose a file to upload', 'FILE_REQUIRED');

  const type = detectFileType(file.buffer, file.originalname);
  if (!type) {
    throw AppError.badRequest(
      `Unsupported or unreadable file. Upload ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} files only.`,
      'UNSUPPORTED_FILE',
    );
  }

  const hash = sha256(file.buffer);
  const duplicate = await queryOne('SELECT original_name FROM documents WHERE case_id = :caseId AND file_hash = :hash', { caseId, hash });
  if (duplicate) throw AppError.conflict(`This file was already uploaded as "${duplicate.original_name}"`, 'DUPLICATE_DOCUMENT');

  const scan = await scanBuffer(file.buffer);
  if (!scan.clean) {
    await recordAudit({ caseId, userId, action: 'document_blocked', detail: { signature: scan.signature, hash }, ip });
    throw new AppError(422, 'MALWARE_DETECTED', 'This file was blocked because it appears to contain malware.');
  }

  const relative = path.join(String(userId), String(caseId), `${randomUUID()}.${type.ext}`);
  const target = absolutePath(relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, encryptBytes(file.buffer), { flag: 'wx' });

  try {
    const result = await query(
      `INSERT INTO documents (case_id, doc_type, original_name, mime_type, size_bytes, storage_path, file_hash)
       VALUES (:caseId, :docType, :name, :mime, :size, :relative, :hash)`,
      { caseId, docType, name: cleanName(file.originalname), mime: type.mime, size: file.size, relative, hash },
    );
    await recordAudit({ caseId, userId, action: 'document_upload', detail: { documentId: result.insertId, docType, hash }, ip });
    return toDto(await queryOne('SELECT * FROM documents WHERE id = :id', { id: result.insertId }));
  } catch (err) {
    await removeFile(relative);
    if (err.code === 'ER_DUP_ENTRY') throw AppError.conflict('This file was already uploaded', 'DUPLICATE_DOCUMENT');
    throw err;
  }
};

export const deleteDocument = async (userId, id, ip) => {
  const doc = await findOwnedDocument(userId, id);
  await query('DELETE FROM documents WHERE id = :id', { id });
  await removeFile(doc.storage_path);
  await recordAudit({ caseId: doc.case_id, userId, action: 'document_delete', detail: { documentId: id, hash: doc.file_hash }, ip });
};

export const createAccessLink = async (userId, id) => {
  await findOwnedDocument(userId, id);
  const token = jwt.sign({ typ: LINK_PURPOSE, docId: id }, env.jwtSecret, {
    subject: String(userId),
    expiresIn: env.documentLinkTtl,
  });
  return { url: `/api/documents/file?t=${token}` };
};

export const resolveAccessLink = async (token) => {
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw AppError.unauthorized('This link has expired. Please open the document again.', 'LINK_EXPIRED');
  }
  if (payload.typ !== LINK_PURPOSE) throw AppError.unauthorized('Invalid link', 'INVALID_LINK');

  const doc = await findOwnedDocument(Number(payload.sub), payload.docId);
  return {
    read: () => readStoredFile(doc),
    name: doc.original_name,
    mime: doc.mime_type,
    disposition: INLINE_MIME_TYPES.has(doc.mime_type) ? 'inline' : 'attachment',
  };
};
