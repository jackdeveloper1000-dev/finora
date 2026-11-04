import { formatDate, formatINR, monthLabel } from '../../utils/format';
import Card from '../ui/Card';

const maxOf = (coverage) => Math.max(1, ...coverage.map((c) => c.count));

export default function LedgerSummary({ ledger }) {
  const covered = ledger.coverage.filter((c) => c.count > 0).length;
  const peak = maxOf(ledger.coverage);

  const tiles = [
    { label: 'Transactions', value: ledger.count.toLocaleString('en-IN') },
    { label: 'Total credits', value: formatINR(ledger.credits) },
    { label: 'Total debits', value: formatINR(ledger.debits) },
  ];

  return (
    <Card className="ledger-summary" title="Ledger overview" subtitle={ledger.period ? `${formatDate(ledger.period.from)} – ${formatDate(ledger.period.to)}` : 'No transactions yet'}>
      <div className="form">
        <div className="stats">
          {tiles.map((t) => (
            <div className="stat" key={t.label}>
              <div className="stat__value stat__value--sm">{t.value}</div>
              <div className="stat__label">{t.label}</div>
            </div>
          ))}
        </div>

        <div>
          <div className="coverage__head">
            <h3>Month coverage</h3>
            <span className="muted">{covered} of 12 months have transactions</span>
          </div>
          <ol className="coverage" aria-label="Transactions per month">
            {ledger.coverage.map(({ month, count }) => (
              <li key={month} className={`coverage__month${count ? ' has-data' : ''}`} title={`${count} transaction(s)`}>
                <span className="coverage__bar"><span style={{ height: `${Math.max(count ? 12 : 0, (count / peak) * 100)}%` }} /></span>
                <span className="coverage__label">{monthLabel(month)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </Card>
  );
}
