import { ArrowRight, Check, CheckCircle2, ChevronRight, Sparkles, Star, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import { FEATURES, PLANS, SAMPLE_INSIGHTS, SAMPLE_SUMMARY, STEPS, TESTIMONIALS } from './content';

export function HowItWorks() {
  return (
    <section className="lp-section" id="how">
      <div className="lp-wrap">
        <header className="lp-head">
          <h2>How it works</h2>
          <p>From your bank statements to a ready-to-review ITR in four simple steps.</p>
        </header>
        <ol className="lp-steps">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title}>
              <span className="lp-steps__icon"><Icon size={26} /></span>
              <h3>{i + 1}. {title}</h3>
              <p>{text}</p>
              {i < STEPS.length - 1 && <ChevronRight className="lp-steps__arrow" size={22} aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function SummaryMock() {
  return (
    <div className="lp-mock" aria-label="Sample dashboard">
      <div className="lp-mock__side" aria-hidden="true">
        <Logo to="/" />
        {['Home', 'Documents', 'Analysis', 'Tax summary', 'ITR'].map((l, i) => <span key={l} className={i === 0 ? 'is-active' : ''}>{l}</span>)}
      </div>
      <div className="lp-mock__main">
        <div className="lp-mock__top"><strong>Your financial summary</strong><span>AY 2026-27 · sample data</span></div>
        <div className="lp-mock__cards">
          {SAMPLE_SUMMARY.map((s) => (
            <div key={s.label} className={`lp-mock__card lp-mock__card--${s.tone}`}><Wallet size={16} /><strong>{s.value}</strong><span>{s.label}</span></div>
          ))}
        </div>
        <div className="lp-mock__insights">
          <strong><Sparkles size={15} />AI insights</strong>
          <ul>{SAMPLE_INSIGHTS.map((t) => <li key={t}><CheckCircle2 size={15} />{t}</li>)}</ul>
          <span className="lp-mock__badge">ITR<br />ready</span>
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section className="lp-section lp-section--tint" id="features">
      <div className="lp-wrap lp-features">
        <div>
          <h2>More than ITR filing —<br />Your <em>AI Financial Assistant</em></h2>
          <p className="lp-features__lead">A smart, simple and secure way to understand, organise and file your taxes.</p>
          <ul className="lp-features__list">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <span className="lp-features__icon"><Icon size={20} /></span>
                <div><strong>{title}</strong><span>{text}</span></div>
              </li>
            ))}
          </ul>
        </div>
        <SummaryMock />
      </div>
    </section>
  );
}

export function Testimonials() {
  return (
    <section className="lp-testimonials" aria-labelledby="lp-testimonials-title">
      <div className="lp-wrap">
        <h2 id="lp-testimonials-title">Loved by taxpayers like you</h2>
        <div className="lp-testimonials__grid">
          {TESTIMONIALS.map(({ quote, name, role }) => (
            <article key={name} className="lp-testimonial">
              <p>“{quote}”</p>
              <div className="lp-testimonial__footer">
                <span className="lp-testimonial__avatar" aria-hidden="true">{name.split(' ').map((part) => part[0]).join('')}</span>
                <span className="lp-testimonial__person"><strong>{name}</strong><span>{role}</span></span>
                <span className="lp-testimonial__stars" aria-label="5 out of 5 stars">
                  {Array.from({ length: 5 }, (_, i) => <Star key={i} size={14} fill="currentColor" />)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Pricing() {
  return (
    <section className="lp-section" id="pricing">
      <div className="lp-wrap">
        <header className="lp-head">
          <span className="lp-pill lp-pill--soft">Simple &amp; transparent pricing</span>
          <h2>Choose the right plan for you</h2>
          <p>Clear options for every stage of your return.</p>
        </header>
        <div className="lp-plans">
          {PLANS.map((p) => (
            <article key={p.name} className={`lp-plan${p.highlight ? ' is-highlight' : ''}${p.muted ? ' is-muted' : ''}`}>
              {p.badge && <span className="lp-plan__badge">{p.badge}</span>}
              <h3>{p.name}</h3>
              <p className="lp-plan__price"><strong>{p.price}</strong><span>{p.unit}</span></p>
              <ul>{p.features.map((f) => <li key={f}><Check size={16} />{f}</li>)}</ul>
              <Link to="/register" className={`lp-btn ${p.highlight ? 'lp-btn--solid' : 'lp-btn--outline'} lp-btn--block`}>{p.cta}</Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="lp-wrap">
      <div className="lp-cta">
        <div className="lp-cta__brand"><Logo to="/" /><span>Your AI-powered tax &amp; financial assistant for India.</span></div>
        <div className="lp-cta__text">
          <h2>Ready to file your ITR the smarter way?</h2>
          <p>Upload your bank statements and let Finora do the heavy work.</p>
        </div>
        <Link to="/register" className="lp-btn lp-btn--white lp-btn--lg">Start your ITR with AI<ArrowRight size={18} /></Link>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="lp-footer">
      <div className="lp-wrap lp-footer__inner">
        <Logo to="/" />
        <p><strong>Finora</strong> — Your AI-powered tax &amp; financial assistant for India. Finora prepares returns for your review. It is not tax or legal advice, and it does not e-file on your behalf.</p>
        <nav aria-label="Account"><Link to="/login">Log in</Link><Link to="/register">Create account</Link></nav>
      </div>
    </footer>
  );
}
