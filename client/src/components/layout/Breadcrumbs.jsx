import { ChevronRight } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import useCaseYear from '../../hooks/useCaseYears';

const SECTIONS = {
  start: 'Start',
  documents: 'Documents',
  transactions: 'Analysis',
  reconcile: 'Reconcile',
  tax: 'Tax summary',
  itr: 'ITR',
  'file-itr': 'File ITR',
};

const SETTINGS_TABS = { notifications: 'Notifications', security: 'Security', privacy: 'Data & privacy' };

// The trail is derived from the address, so every page gets one without having to build its own.
function trail({ pathname, search, isCustomer, year }) {
  const home = isCustomer ? { label: 'Home', to: '/dashboard' } : { label: 'Review queue', to: '/expert' };
  const parts = pathname.split('/').filter(Boolean);
  const [first, second, third] = parts;

  if (first === 'dashboard' || (first === 'expert' && !second)) return [home];
  if (first === 'expert') return [home, { label: 'Review' }];
  if (first === 'quick') return [home, { label: 'File ITR' }];
  if (first === 'history') return [home, { label: 'History' }];
  if (first === 'notifications') return [home, { label: 'Notifications' }];
  if (first === 'settings') {
    const tab = SETTINGS_TABS[new URLSearchParams(search).get('tab')] ?? 'Profile';
    return [home, { label: 'Settings', to: '/settings' }, { label: tab }];
  }
  if (first === 'cases' && second) {
    const caseTrail = [home, { label: year ? `AY ${year}` : 'Return', to: `/cases/${second}/start` }];
    if (third === 'start' || !third) return [...caseTrail.slice(0, 1), { label: caseTrail[1].label }];
    if (third === 'file-itr') return [...caseTrail, { label: 'ITR', to: `/cases/${second}/itr` }, { label: 'File ITR' }];
    return [...caseTrail, { label: SECTIONS[third] ?? 'Return' }];
  }
  return [home];
}

export default function Breadcrumbs({ isCustomer }) {
  const { pathname, search } = useLocation();
  const caseId = /^\/cases\/(\d+)/.exec(pathname)?.[1];
  const year = useCaseYear(caseId ? Number(caseId) : null);
  const items = trail({ pathname, search, isCustomer, year });

  if (items.length < 2) return null;

  return (
    <nav className="crumbs no-print" aria-label="Breadcrumb">
      <ol>
        {items.map((item, i) => {
          const last = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {last || !item.to ? <span aria-current={last ? 'page' : undefined}>{item.label}</span> : <Link to={item.to}>{item.label}</Link>}
              {!last && <ChevronRight size={14} aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
