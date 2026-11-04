import { CheckCircle2, ChevronDown, Clock, FileUp, Lock, Scale, ShieldCheck, Sparkles, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import useMediaQuery from '../../hooks/useMediaQuery';
import Logo from '../ui/Logo';

const STEPS = [
  { icon: FileUp, title: 'Upload your documents', text: 'Bank statements today; Form 16, AIS and 26AS details alongside.' },
  { icon: Sparkles, title: 'We read and organise them', text: 'Transactions are categorised, with a clear reason for every call.' },
  { icon: UserCheck, title: 'You review and approve', text: 'Check each figure against its source, then approve when it looks right.' },
];

const ASSURANCES = [
  'Differences between your documents are flagged before you file',
  'Old and new regime compared with the working shown',
  'An expert can look over the return before you approve',
];

const TRUST = [
  { icon: Clock, label: 'Takes under 5 minutes to start' },
  { icon: Lock, label: 'Encrypted at rest' },
  { icon: Scale, label: 'Rule-based calculations' },
  { icon: ShieldCheck, label: 'Your data, your control' },
];

export function TrustChips() {
  return (
    <ul className="auth__trust">
      {TRUST.map(({ icon: Icon, label }) => (
        <li key={label}><Icon size={14} />{label}</li>
      ))}
    </ul>
  );
}

export default function AuthLayout({ title, subtitle, children, footer, accountMode }) {
  const narrow = useMediaQuery('(max-width: 960px)');
  const [open, setOpen] = useState(false);
  const showStory = !narrow || open;

  return (
    <div className="auth">
      <header className="auth__top">
        <div className="auth__top-inner">
          <div className="auth__brand">
            <Logo />
            <span className="auth__tag">Your AI-powered tax &amp; financial assistant for India.</span>
          </div>
          <span className="auth__season"><Clock size={15} />Returns for AY 2026-27 and 2025-26 are open</span>
        </div>
      </header>

      <div className="auth__grid">
        <section className={`auth__why${narrow ? ' is-collapsible' : ''}`} aria-labelledby="how-finora">
          {narrow && (
            <button type="button" className="auth__why-toggle" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              How Finora works<ChevronDown size={18} />
            </button>
          )}
          <div className="auth__why-body" hidden={!showStory}>
          <span className="auth__eyebrow"><i />AY 2026-27 · salaried returns</span>
          <h2 id="how-finora">From bank statement to a return you can trust</h2>
          <p>Finora does the data entry and the arithmetic. You stay in charge of every figure.</p>
          <ol className="steps">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title}>
                <span className="steps__icon"><Icon size={20} /></span>
                <div><strong>{i + 1}. {title}</strong><span>{text}</span></div>
              </li>
            ))}
          </ol>
          <ul className="auth__assure">
            {ASSURANCES.map((a) => <li key={a}><CheckCircle2 size={18} />{a}</li>)}
          </ul>
          <p className="auth__foot">Finora prepares returns for your review. It is not tax or legal advice.</p>
          </div>
        </section>

        <main className="auth__panel">
          {accountMode && (
            <nav className="auth__modes" aria-label="Account">
              <Link to="/login" aria-current={accountMode === 'login' ? 'page' : undefined} className={accountMode === 'login' ? 'is-active' : ''}>Sign in</Link>
              <Link to="/register" aria-current={accountMode === 'register' ? 'page' : undefined} className={accountMode === 'register' ? 'is-active' : ''}>Create account</Link>
            </nav>
          )}
          <div className="auth__card">
            <div className="auth__title">
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
            {children}
            <p className="auth__switch">{footer}</p>
          </div>
        </main>
      </div>
    </div>
  );
}
