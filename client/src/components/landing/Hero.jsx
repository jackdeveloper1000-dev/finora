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
      <svg className="lp-flow__lines" viewBox="0 0 120 300" preserveAspectRatio="none">
        {[38, 112, 188, 262].map((y) => <path key={y} d={`M0 ${y} C 60 ${y}, 60 150, 120 150`} />)}
      </svg>
      <div className="lp-flow__core"><Sparkles size={30} /><strong>Finora</strong><span>Engine</span></div>
      <div className="lp-flow__result">
        <span className="lp-flow__tick"><CheckCircle2 size={26} /></span>
        <strong>ITR ready</strong>
        <ul>
          <li><CheckCircle2 size={15} />Income analysed</li>
          <li><CheckCircle2 size={15} />Taxes reconciled</li>
          <li><CheckCircle2 size={15} />Return prepared</li>
        </ul>
        <span className="lp-flow__file"><Send size={15} />Approve and download</span>
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="lp-hero" id="home">
      <div className="lp-wrap lp-hero__grid">
        <div className="lp-hero__copy">
          <span className="lp-pill"><Sparkles size={14} />AY 2026-27 · ITR-1 for salaried income</span>
          <h1>Turn your financial documents into a tax-ready ITR <em>with Finora.</em></h1>
          <p>Upload your bank statements. Finora reads them, sorts your income, compares the tax regimes and prepares your ITR, accurately, securely and in minutes.</p>
          <div className="lp-hero__actions">
            <Link to="/register" className="lp-btn lp-btn--solid lp-btn--lg">Start your ITR<ArrowRight size={18} /></Link>
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
