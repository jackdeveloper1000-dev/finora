import { formatINR } from '../../utils/format';

const TOTAL_KEYS = new Set(['gross_total_income', 'taxable_income', 'total_tax', 'net_payable']);

const display = (step) => {
  if (step.key === 'net_payable') return formatINR(Math.abs(step.amount));
  return step.amount < 0 ? `−${formatINR(-step.amount)}` : formatINR(step.amount);
};

export default function TraceTable({ steps }) {
  return (
    <ul className="trace">
      {steps.map((step) => (
        <li key={step.key} className={`trace__row${TOTAL_KEYS.has(step.key) ? ' is-total' : ''}${step.amount === 0 && step.note && !TOTAL_KEYS.has(step.key) ? ' is-muted' : ''}`}>
          <div className="trace__label">
            <span>{step.label}</span>
            {(step.source || step.note) && <span className="trace__meta">{[step.source, step.note].filter(Boolean).join(' · ')}</span>}
          </div>
          <span className="trace__amount">{display(step)}</span>
        </li>
      ))}
    </ul>
  );
}
