import { query, queryOne } from '../../config/db.js';
import { AppError } from '../../utils/AppError.js';
import { errorFields, logger } from '../../utils/logger.js';

// Which preference switch controls which notification type.
const PREFERENCE_FOR = {
  document_processed: 'notify_processed',
  return_approved: 'notify_returns',
  approval_withdrawn: 'notify_returns',
  return_filed: 'notify_returns',
};

const toDto = (r) => ({
  id: r.id,
  type: r.type,
  title: r.title,
  body: r.body,
  link: r.link,
  read: r.read_at !== null,
  createdAt: r.created_at,
});

// Notifications are a convenience: a failure here must never break the action that triggered it.
export const notify = async (userId, { type, title, body = null, link = null, caseId = null }) => {
  try {
    const column = PREFERENCE_FOR[type];
    if (column) {
      const prefs = await queryOne(`SELECT ${column} AS enabled FROM user_settings WHERE user_id = :userId`, { userId });
      if (prefs && !prefs.enabled) return;
    }
    await query(
      'INSERT INTO notifications (user_id, case_id, type, title, body, link) VALUES (:userId, :caseId, :type, :title, :body, :link)',
      { userId, caseId, type, title: title.slice(0, 150), body: body && body.slice(0, 300), link },
    );
  } catch (err) {
    logger.error('failed to create notification', { type, ...errorFields(err) });
  }
};

export const listNotifications = async (userId, limit = 50) => {
  const rows = await query(`SELECT * FROM notifications WHERE user_id = :userId ORDER BY id DESC LIMIT ${Number(limit)}`, { userId });
  const { total } = await queryOne('SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId AND read_at IS NULL', { userId });
  return { notifications: rows.map(toDto), unread: Number(total) };
};

export const unreadCount = async (userId) => {
  const { total } = await queryOne('SELECT COUNT(*) AS total FROM notifications WHERE user_id = :userId AND read_at IS NULL', { userId });
  return { unread: Number(total) };
};

export const markRead = async (userId, id) => {
  const result = await query('UPDATE notifications SET read_at = COALESCE(read_at, UTC_TIMESTAMP()) WHERE id = :id AND user_id = :userId', { id, userId });
  if (!result.affectedRows) throw AppError.notFound('Notification not found');
};

export const markAllRead = (userId) =>
  query('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE user_id = :userId AND read_at IS NULL', { userId });
