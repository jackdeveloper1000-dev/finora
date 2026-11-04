import { Bell, Calculator, ClipboardCheck, FileCheck2, FileText, House, PanelLeft, Send, Settings, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import useLatestCaseId from '../../hooks/useLatestCaseId';
import useUnreadCount from '../../hooks/useUnreadCount';
import Logo, { LogoMark } from '../ui/Logo';
import Breadcrumbs from './Breadcrumbs';
import UserMenu from './UserMenu';

const STORAGE_KEY = 'finora.sidebar.collapsed';
const readCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
};

// The sections of the product: Home, Documents, Analysis, Tax summary and the ITR itself.
// `matches` keeps an entry highlighted on the deeper pages it leads to; `short` is the phone label.
const customerItems = (caseId) => {
  const inCase = (path) => (caseId ? `/cases/${caseId}/${path}` : '/quick');
  return [
    { key: 'home', to: '/dashboard', label: 'Home', icon: House, matches: (p) => p === '/dashboard' },
    { key: 'documents', to: inCase('documents'), label: 'Documents', short: 'Docs', icon: FileText, matches: (p) => p.endsWith('/documents') },
    { key: 'analysis', to: inCase('transactions'), label: 'Analysis', icon: Sparkles, matches: (p) => /\/(transactions|reconcile)$/.test(p) },
    { key: 'tax', to: inCase('tax'), label: 'Tax summary', short: 'Tax', icon: Calculator, matches: (p) => p.endsWith('/tax') },
    { key: 'itr', to: inCase('itr'), label: 'ITR', icon: FileCheck2, matches: (p) => /\/(itr|file-itr)$/.test(p) },
  ];
};

const STAFF_ITEMS = [
  { key: 'queue', to: '/expert', label: 'Review queue', short: 'Queue', icon: ClipboardCheck, matches: (p) => p.startsWith('/expert') },
  { key: 'settings', to: '/settings', label: 'Settings', icon: Settings, matches: (p) => p === '/settings' },
];

export default function AppShell() {
  const { user } = useAuth();
  const isCustomer = user.role === 'customer';
  const caseId = useLatestCaseId(isCustomer);
  const items = isCustomer ? customerItems(caseId) : STAFF_ITEMS;
  const home = isCustomer ? '/dashboard' : '/expert';
  const { pathname } = useLocation();
  const unread = useUnreadCount();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem(STORAGE_KEY, current ? '0' : '1');
      } catch {
        // the choice still applies for this visit
      }
      return !current;
    });
  }, []);

  // Ctrl or Cmd + B, the same shortcut other assistants use.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle]);

  const cls = (base, item) => `${base}${item.matches(pathname) ? ' is-active' : ''}`;

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <aside className="side" aria-label="Sidebar">
        {collapsed ? (
          // In the slim rail the logo is the control: hovering it turns into the panel icon.
          <button type="button" className="side__expand" onClick={toggle} aria-label="Expand sidebar" aria-expanded="false">
            <LogoMark className="side__expand-logo" />
            <PanelLeft size={20} className="side__expand-icon" />
          </button>
        ) : (
          <div className="side__top">
            <Logo to={home} />
            <button type="button" className="side__toggle" onClick={toggle} aria-label="Collapse sidebar" aria-expanded="true">
              <PanelLeft size={20} />
            </button>
          </div>
        )}

        <nav className="side__nav" aria-label="Main">
          {items.map((item) => (
            <Link key={item.key} to={item.to} className={cls('side__link', item)} aria-label={collapsed ? item.label : undefined} aria-current={item.matches(pathname) ? 'page' : undefined}>
              <item.icon size={20} /><span className="side__text">{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <span className="topbar__logo"><Logo to={home} /></span>
          <div className="topbar__right">
            {isCustomer && (
              <Link to="/quick" className="btn btn--primary btn--sm topbar__file" aria-label="File ITR"><Send size={16} /><span>File ITR</span></Link>
            )}
            <Link to="/notifications" className={`bell${pathname === '/notifications' ? ' is-active' : ''}`} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}>
              <Bell size={20} />
              {unread > 0 && <span className="bell__count">{unread > 9 ? '9+' : unread}</span>}
            </Link>
            <UserMenu />
          </div>
        </header>

        <main className="content">
          <Breadcrumbs isCustomer={isCustomer} />
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {items.map((item) => (
          <Link key={item.key} to={item.to} className={cls('bottom-nav__link', item)}>
            <item.icon size={21} />{item.short ?? item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
