import { BadgeCheck, Bell, FileCheck2, FileText, MessageSquare, UserCheck } from 'lucide-react';
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi } from '../api/services';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { announceNotificationChange } from '../hooks/useUnreadCount';
import { formatDateTime } from '../utils/format';

const ICONS = { document_processed: FileText, return_approved: BadgeCheck, approval_withdrawn: FileCheck2, review_update: UserCheck, review_message: MessageSquare };

export default function Notifications() {
  const navigate = useNavigate();
  const loader = useCallback(() => notificationsApi.list(), []);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const open = async (n) => {
    if (!n.read) {
      await notificationsApi.markRead(n.id).catch(() => {});
      announceNotificationChange();
    }
    if (n.link) navigate(n.link);
    else reload();
  };

  const markAll = async () => {
    await notificationsApi.markAllRead();
    announceNotificationChange();
    reload();
  };

  return (
    <>
      <div className="page-head">
        <h1>Notifications</h1>
        <p>Alerts about your documents and returns.</p>
      </div>

      <Card
        action={data.unread > 0 && <Button variant="secondary" size="sm" onClick={markAll}>Mark all read</Button>}
        title={data.unread > 0 ? `${data.unread} unread` : 'All caught up'}
      >
        {data.notifications.length === 0 ? (
          <div className="state">
            <div className="state__icon"><Bell /></div>
            <h3>No notifications yet</h3>
            <p>They appear as you upload documents and update your returns.</p>
          </div>
        ) : (
          <ul className="notes">
            {data.notifications.map((n) => {
              const Icon = ICONS[n.type] ?? Bell;
              return (
                <li key={n.id}>
                  <button type="button" className={`note${n.read ? '' : ' is-unread'}`} onClick={() => open(n)}>
                    <span className="note__icon"><Icon size={18} /></span>
                    <span className="note__body">
                      <strong>{n.title}</strong>
                      {n.body && <span>{n.body}</span>}
                      <em>{formatDateTime(n.createdAt)}</em>
                    </span>
                    {!n.read && <span className="note__dot" aria-label="Unread" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
