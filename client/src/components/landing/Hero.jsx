import { ArrowRight, CheckCircle2, Play, Send, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SOURCES, TRUST_POINTS } from './content';

function FlowDiagram() {
  return (
    <div className="lp-flow" aria-hidden="true">
      <ul className="lp-flow__sources">
        {SOURCES.map(({ icon: Icon, label }) => (
          <li key={label}><Icon size={22} />{label}</li>
        ))}
      </ul>
      <svg className="lp-flow__lines" viewBox="0 0 120 280" preserveAspectRatio="none">
        {[41, 115, 181, 247].map((y) => <path key={y} d={`M0 ${y} C 48 ${y}, 72 140, 120 140`} />)}
      </svg>
      <div className="lp-flow__engine">
        <div className="lp-flow__core"><Sparkles size={30} /><strong>Finora AI</strong></div>
        <svg className="lp-flow__arrow" viewBox="0 0 36 16" aria-hidden="true">
          <path d="M1 8h32m-6-6 6 6-6 6" />
        </svg>
      </div>
      <div className="lp-flow__result">
        <span className="lp-flow__tick"><CheckCircle2 size={26} /></span>
        <strong>ITR ready</strong>
        <ul>
          <li><CheckCircle2 size={15} />Income analysed</li>
          <li><CheckCircle2 size={15} />Taxes reconciled</li>
          <li><CheckCircle2 size={15} />ITR prepared</li>
        </ul>
        <span className="lp-flow__file"><Send size={15} />File ITR</span>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="lp-hero" id="home">
      <div className="lp-wrap lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="lp-pill"><Sparkles size={14} />Your AI-powered tax &amp; financial assistant for India.</span>
          <h1>Turn your financial documents into a tax-ready ITR <em>with AI.</em></h1>
          <p>Upload your bank statements, Form 16, AIS, 26AS and investment documents. Finora organizes your finances, reconciles the data and prepares your ITR for review—securely and in minutes.</p>
          <div className="lp-hero__actions">
            <Link to="/register" className="lp-btn lp-btn--solid lp-btn--lg">Start your ITR with AI<ArrowRight size={18} /></Link>
            <a href="#how" className="lp-btn lp-btn--outline lp-btn--lg"><Play size={16} />See how it works</a>
          </div>
          <ul className="lp-hero__trust">
            {TRUST_POINTS.map(({ icon: Icon, label }) => <li key={label}><Icon size={18} />{label}</li>)}
          </ul>
        </div>
        <FlowDiagram />
      </div>
    </section>
  );
}
