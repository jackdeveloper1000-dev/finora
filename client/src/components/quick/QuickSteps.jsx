import { Check } from 'lucide-react';

const STEPS = [
  { label: 'Your details', short: 'Details' },
  { label: 'Upload', short: 'Upload' },
  { label: 'Review and approve', short: 'Approve' },
];

export default function QuickSteps({ current, done }) {
  return (
    <ol className="qsteps" aria-label="Progress">
      {STEPS.map(({ label, short }, i) => {
        const n = i + 1;
        const complete = n < current || (done && n === current);
        return (
          <li key={label} className={`qsteps__item${n === current ? ' is-current' : ''}${complete ? ' is-done' : ''}`} aria-current={n === current ? 'step' : undefined}>
            <span className="qsteps__dot">{complete ? <Check size={15} /> : n}</span>
            <span className="qsteps__label"><span className="qsteps__full">{label}</span><span className="qsteps__short">{short}</span></span>
          </li>
        );
      })}
    </ol>
  );
}
