import { History, LogOut, Settings, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';

export default function UserMenu() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="usermenu" ref={ref}>
      <button type="button" className="usermenu__btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Account menu">
        <span className="avatar">{initials(user.name)}</span>
      </button>
      {open && (
        <div className="usermenu__panel" role="menu">
          <div className="usermenu__head">
            <strong>{user.name}</strong>
            <span>{user.email || user.mobile}</span>
          </div>
          <Link to="/settings" className="usermenu__item" role="menuitem"><UserRound size={18} />My profile</Link>
          {user.role === 'customer' && <Link to="/history" className="usermenu__item" role="menuitem"><History size={18} />History</Link>}
          <Link to="/settings?tab=security" className="usermenu__item" role="menuitem"><Settings size={18} />Settings &amp; security</Link>
          <button type="button" className="usermenu__item usermenu__item--danger" role="menuitem" onClick={logout}><LogOut size={18} />Sign out</button>
        </div>
      )}
    </div>
  );
}
