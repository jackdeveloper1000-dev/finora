import { Bell, Database, ShieldCheck, UserRound } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccountCard from '../components/settings/AccountCard';
import MfaCard from '../components/settings/MfaCard';
import NotificationPrefs from '../components/settings/NotificationPrefs';
import PasswordCard from '../components/settings/PasswordCard';
import PrivacyCard from '../components/settings/PrivacyCard';
import SessionsCard from '../components/settings/SessionsCard';
import TaxpayerProfileCard from '../components/settings/TaxpayerProfileCard';

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserRound, render: () => <><AccountCard /><TaxpayerProfileCard /></> },
  { key: 'notifications', label: 'Notifications', icon: Bell, render: () => <NotificationPrefs /> },
  { key: 'security', label: 'Security', icon: ShieldCheck, render: () => <><PasswordCard /><MfaCard /><SessionsCard /></> },
  { key: 'privacy', label: 'Data & privacy', icon: Database, render: () => <PrivacyCard /> },
];

const STAFF_TABS = [
  { ...TABS[0], render: () => <AccountCard /> },
  TABS[2],
];

export default function Settings() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tabs = user.role === 'customer' ? TABS : STAFF_TABS;
  const active = tabs.find((t) => t.key === params.get('tab')) ?? tabs[0];

  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Manage your account, security and privacy.</p>
      </div>

      <div className="tabs settings-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={active.key === t.key} className={`tab${active.key === t.key ? ' is-active' : ''}`} onClick={() => setParams(t.key === 'profile' ? {} : { tab: t.key })}>
            <t.icon size={17} />{t.label}
          </button>
        ))}
      </div>

      <div className="settings-panel" key={active.key}>{active.render()}</div>
    </>
  );
}
