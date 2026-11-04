import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { recordAudit } from '../../utils/audit.js';
import { assemble, toReturnDto } from '../itr/itr.service.js';
import { notify } from '../notifications/notifications.service.js';
import { getCalculation } from '../tax/tax.service.js';

const ACTIVE = ['requested', 'in_review', 'changes_needed'];
const QUEUE_LIMIT = 100;

const messageDto = (m) => ({ id: m.id, role: m.author_role, author: m.author_name, body: m.body, createdAt: m.created_at });

const reviewDto = (r) => ({
  id: r.id,
  caseId: r.case_id,
  status: r.status,
  requestNote: r.request_note,
  expert: r.expert_name ?? null,
  requestedAt: r.requested_at,
  decidedAt: r.decided_at,
});

const REVIEW_SELECT = `SELECT r.*, e.name AS expert_name FROM expert_reviews r LEFT JOIN users e ON e.id = r.expert_id`;

const loadMessages = async (reviewId) =>
  (await query(
    `SELECT m.*, u.name AS author_name FROM review_messages m LEFT JOIN users u ON u.id = m.author_id WHERE m.review_id = :reviewId ORDER BY m.id`,
    { reviewId },
  )).map(messageDto);

const addMessage = (reviewId, user, body) =>
  query('INSERT INTO review_messages (review_id, author_id, author_role, body) VALUES (:reviewId, :authorId, :role, :body)', { reviewId, authorId: user.id, role: user.role, body });

const latestForCase = (caseId) => queryOne(`${REVIEW_SELECT} WHERE r.case_id = :caseId ORDER BY r.id DESC LIMIT 1`, { caseId });

const ownedCase = async (userId, caseId) => {
  const kase = await queryOne('SELECT id, user_id, assessment_year, status FROM itr_cases WHERE id = :caseId AND user_id = :userId', { caseId, userId });
  if (!kase) throw AppError.notFound('Return not found');
  return kase;
};

// An expert approval only counts while the return still matches what the expert looked at.
const isCurrent = async (review, caseOwnerId) => {
  if (review.status !== 'approved' || !review.reviewed_hash) return false;
  const { hash } = await assemble(caseOwnerId, review.case_id);
  return hash === review.reviewed_hash;
};

export const hasOpenReview = async (caseId) =>
  Boolean(await queryOne("SELECT id FROM expert_reviews WHERE case_id = :caseId AND status IN ('requested','in_review') LIMIT 1", { caseId }));

/* ---------- customer ---------- */

export const getCaseReview = async (userId, caseId) => {
  const kase = await ownedCase(userId, caseId);
  const review = await latestForCase(caseId);
  if (!review) return { review: null, messages: [], current: false };
  return { review: reviewDto(review), messages: await loadMessages(review.id), current: await isCurrent(review, kase.user_id) };
};

export const requestReview = async (userId, caseId, note, ip) => {
  await ownedCase(userId, caseId);
  const existing = await latestForCase(caseId);
  if (existing && ACTIVE.includes(existing.status)) throw AppError.conflict('This return already has an open expert review.', 'REVIEW_EXISTS');

  const state = await assemble(userId, caseId);
  if (!state.sections) throw AppError.badRequest('Calculate your tax and choose a regime before asking an expert to review.', 'NOT_READY');

  const result = await query('INSERT INTO expert_reviews (case_id, request_note) VALUES (:caseId, :note)', { caseId, note: note || null });
  await recordAudit({ caseId, userId, action: 'review_request', detail: { reviewId: result.insertId }, ip });
  return getCaseReview(userId, caseId);
};

const activeReviewOf = async (userId, caseId) => {
  await ownedCase(userId, caseId);
  const review = await latestForCase(caseId);
  if (!review || !ACTIVE.includes(review.status)) throw AppError.notFound('There is no open expert review for this return.');
  return review;
};

export const customerReply = async (user, caseId, body) => {
  const review = await activeReviewOf(user.id, caseId);
  await addMessage(review.id, user, body);
  // Replying after "changes needed" hands the review back to the expert.
  if (review.status === 'changes_needed') await query("UPDATE expert_reviews SET status = 'in_review', decided_at = NULL WHERE id = :id", { id: review.id });
  if (review.expert_id) {
    await notify(review.expert_id, { type: 'review_message', title: 'Customer replied on a review', body, link: `/expert/reviews/${review.id}`, caseId });
  }
  return getCaseReview(user.id, caseId);
};

export const cancelReview = async (userId, caseId, ip) => {
  const review = await activeReviewOf(userId, caseId);
  await query("UPDATE expert_reviews SET status = 'cancelled', decided_at = NOW() WHERE id = :id", { id: review.id });
  await recordAudit({ caseId, userId, action: 'review_cancel', detail: { reviewId: review.id }, ip });
  return getCaseReview(userId, caseId);
};

/* ---------- expert ---------- */

export const listQueue = async (expert, scope) => {
  const where = scope === 'mine'
    ? "r.expert_id = :expertId AND r.status IN ('in_review','changes_needed')"
    : scope === 'done'
      ? "r.expert_id = :expertId AND r.status IN ('approved','cancelled')"
      : "r.status = 'requested'";
  const rows = await query(
    `${REVIEW_SELECT.replace('e.name AS expert_name', 'e.name AS expert_name, c.assessment_year, u.name AS customer_name')}
       JOIN itr_cases c ON c.id = r.case_id JOIN users u ON u.id = c.user_id
      WHERE ${where} ORDER BY r.requested_at LIMIT ${QUEUE_LIMIT}`,
    { expertId: expert.id },
  );
  return rows.map((r) => ({ ...reviewDto(r), assessmentYear: r.assessment_year, customer: r.customer_name }));
};

const loadForExpert = async (reviewId) => {
  const review = await queryOne(
    `${REVIEW_SELECT.replace('e.name AS expert_name', 'e.name AS expert_name, c.user_id AS owner_id, c.assessment_year, u.name AS customer_name')}
       JOIN itr_cases c ON c.id = r.case_id JOIN users u ON u.id = c.user_id WHERE r.id = :reviewId`,
    { reviewId },
  );
  if (!review) throw AppError.notFound('Review not found');
  return review;
};

// An expert can open reviews that are waiting or assigned to them, never someone else's.
const assertAccess = (review, expert) => {
  if (review.expert_id === expert.id) return;
  if (review.status === 'requested') return;
  throw AppError.forbidden('This review is assigned to another expert.');
};

export const getExpertReview = async (expert, reviewId, ip) => {
  const review = await loadForExpert(reviewId);
  assertAccess(review, expert);

  const state = await assemble(review.owner_id, review.case_id);
  const { calculation } = await getCalculation(review.owner_id, review.case_id);
  await recordAudit({ caseId: review.case_id, userId: expert.id, action: 'expert_view', detail: { reviewId }, ip });

  return {
    review: { ...reviewDto(review), assessmentYear: review.assessment_year, customer: review.customer_name },
    messages: await loadMessages(reviewId),
    changedSinceApproval: review.status === 'approved' ? !(await isCurrent(review, review.owner_id)) : false,
    taxpayer: { name: state.profile.fullName, pan: state.profile.pan, residentialStatus: state.profile.residentialStatus },
    return: toReturnDto(state, { status: state.kase.status, approvalRevoked: false }),
    calculation,
  };
};

export const claimReview = async (expert, reviewId, ip) => {
  const result = await query(
    "UPDATE expert_reviews SET status = 'in_review', expert_id = :expertId WHERE id = :reviewId AND status = 'requested'",
    { expertId: expert.id, reviewId },
  );
  if (!result.affectedRows) throw AppError.conflict('This review was already picked up.', 'REVIEW_TAKEN');

  const review = await loadForExpert(reviewId);
  await notify(review.owner_id, { type: 'review_update', title: 'An expert is reviewing your return', body: `AY ${review.assessment_year}`, link: `/cases/${review.case_id}/itr`, caseId: review.case_id });
  await recordAudit({ caseId: review.case_id, userId: expert.id, action: 'review_claim', detail: { reviewId }, ip });
  return getExpertReview(expert, reviewId, ip);
};

const assertAssigned = async (expert, reviewId, statuses) => {
  const review = await loadForExpert(reviewId);
  if (review.expert_id !== expert.id) throw AppError.forbidden('Pick up this review before responding to it.');
  if (!statuses.includes(review.status)) throw AppError.conflict('This review is no longer open.', 'REVIEW_CLOSED');
  return review;
};

export const expertMessage = async (expert, reviewId, body, ip) => {
  const review = await assertAssigned(expert, reviewId, ['in_review', 'changes_needed']);
  await addMessage(reviewId, expert, body);
  await notify(review.owner_id, { type: 'review_update', title: 'New message from your expert', body, link: `/cases/${review.case_id}/itr`, caseId: review.case_id });
  return getExpertReview(expert, reviewId, ip);
};

export const decide = async (expert, reviewId, { decision, message }, ip) => {
  const review = await assertAssigned(expert, reviewId, ['in_review']);
  if (decision === 'changes_needed' && !message) {
    throw AppError.badRequest('Tell the customer what needs to change.', 'MESSAGE_REQUIRED', [{ field: 'message', message: 'Required' }]);
  }

  let reviewedHash = null;
  if (decision === 'approved') {
    const state = await assemble(review.owner_id, review.case_id);
    if (!state.sections || state.validation.blocking) {
      throw new AppError(422, 'VALIDATION_BLOCKING', 'This return still has blocking issues, so it cannot be approved. Ask for changes instead.');
    }
    reviewedHash = state.hash;
  }

  await query('UPDATE expert_reviews SET status = :decision, reviewed_hash = :reviewedHash, decided_at = NOW() WHERE id = :reviewId', { decision, reviewedHash, reviewId });
  if (message) await addMessage(reviewId, expert, message);

  const approved = decision === 'approved';
  await notify(review.owner_id, {
    type: 'review_update',
    title: approved ? 'An expert approved your return' : 'Your expert asked for changes',
    body: message || `AY ${review.assessment_year}`,
    link: `/cases/${review.case_id}/itr`,
    caseId: review.case_id,
  });
  await recordAudit({ caseId: review.case_id, userId: expert.id, action: `review_${decision}`, detail: { reviewId, hash: reviewedHash }, ip });
  return getExpertReview(expert, reviewId, ip);
};
