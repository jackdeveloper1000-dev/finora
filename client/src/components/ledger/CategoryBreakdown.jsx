import { formatINR } from '../../utils/format';
import Card from '../ui/Card';

function Row({ item, active, onSelect }) {
  const total = item.credits > 0 ? item.credits : item.debits;
  const tone = item.credits > 0 ? 'credit' : 'debit';
  return (
    <li>
      <button type="button" className={`breakdown__row${active ? ' is-active' : ''}`} onClick={() => onSelect(active ? null : item.code)} aria-pressed={active}>
        <span className="breakdown__label">{item.label}<span className="muted"> · {item.count}</span></span>
        <span className={`amount amount--${tone}`}>{formatINR(total)}</span>
      </button>
    </li>
  );
}

export default function CategoryBreakdown({ byCategory, selected, onSelect }) {
  const relevant = byCategory.filter((c) => c.taxHead !== 'not_taxable' || c.code === 'unknown');
  const other = byCategory.filter((c) => c.taxHead === 'not_taxable' && c.code !== 'unknown');
  if (!byCategory.length) return null;

  return (
    <Card title="By category" subtitle="Ignored transactions are excluded. Select a category to filter the list.">
      <div className="breakdown">
        {relevant.length > 0 && (
          <div>
            <h3>Tax-relevant</h3>
            <ul>{relevant.map((c) => <Row key={c.code} item={c} active={selected === c.code} onSelect={onSelect} />)}</ul>
          </div>
        )}
        {other.length > 0 && (
          <div>
            <h3>Everything else</h3>
            <ul>{other.map((c) => <Row key={c.code} item={c} active={selected === c.code} onSelect={onSelect} />)}</ul>
          </div>
        )}
      </div>
    </Card>
  );
}
