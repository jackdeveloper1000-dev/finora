import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { notificationsApi } from '../api/services';

export const NOTIFICATIONS_CHANGED = 'finora:notifications-changed';

// Tells the bell to re-check right away (e.g. after "mark all read").
export const announceNotificationChange = () => window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED));

// Refreshes on every page change and whenever something announces a change, so no polling is needed.
export default function useUnreadCount() {
  const { pathname } = useLocation();
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => notificationsApi.unread().then((d) => setUnread(d.unread)).catch(() => {}), []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useEffect(() => {
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
  }, [refresh]);

  return unread;
}
