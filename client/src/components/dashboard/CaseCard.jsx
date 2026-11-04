import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ProgressRing from '../ui/ProgressRing';
import { CASE_STATUS } from '../../utils/format';

const STATS = [
  { key: 'documents', label: 'Documents' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'unreviewed', label: 'Transactions to review' },
];

export default function CaseCard({ item }) {
  const { assessmentYear, status, itrForm, readiness } = item;
  const state = CASE_STATUS[status] ?? CASE_STATUS.draft;

  return (
    <Card className="case">
      <div className="case__top">
        <ProgressRing value={readiness.progress} />
        <div className="case__title">
          <h2>Assessment Year {assessmentYear}</h2>
          <div className="case__meta">
            <Badge tone={state.tone}>{state.label}</Badge>
            <Badge>{itrForm === 'UNDECIDED' ? 'ITR form not decided yet' : itrForm}</Badge>
          </div>
        </div>
        <div className="case__actions">
          <Button to={`/cases/${item.id}/start`}>{readiness.progress > 0 ? 'Continue filing' : 'Start filing'}<ArrowRight size={18} /></Button>
        </div>
      </div>

      <div className="case__grid">
        <ul className="steps">
          {readiness.steps.map((step) => (
            <li key={step.key} className={`step${step.done ? ' is-done' : ''}`}>
              {step.done ? <CheckCircle2 size={20} /> : <Circle size={20} />}
              {step.label}
            </li>
          ))}
        </ul>
        <div className="stats">
          {STATS.map(({ key, label }) => (
            <div className="stat" key={key}>
              <div className="stat__value">{readiness.stats[key]}</div>
              <div className="stat__label">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
