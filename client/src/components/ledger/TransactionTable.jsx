import { formatDate, formatINR } from '../../utils/format';
import CategoryBadge from './CategoryBadge';
import TransactionActions from './TransactionActions';

function Amount({ debit, credit }) {
  if (credit > 0) return <span className="amount amount--credit">+{formatINR(credit)}</span>;
  return <span className="amount amount--debit">−{formatINR(debit)}</span>;
}

const source = (t) => `${t.source.name} · row ${t.source.row}`;

export default function TransactionTable({ items, onEdit, onChanged, onError }) {
  const actions = (t) => <TransactionActions txn={t} onEdit={onEdit} onChanged={onChanged} onError={onError} />;

  return (
    <>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th className="num">Amount</th>
              <th className="num">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id} className={t.status === 'ignored' ? 'is-ignored' : ''}>
                <td className="nowrap">{formatDate(t.date)}</td>
                <td className="table__desc">
                  {t.description}
                  <div className="table__source" title={source(t)}>{source(t)}</div>
                </td>
                <td><CategoryBadge txn={t} /></td>
                <td className="num nowrap"><Amount {...t} /></td>
                <td className="num">{actions(t)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="txn-cards">
        {items.map((t) => (
          <li key={t.id} className={`txn-card${t.status === 'ignored' ? ' is-ignored' : ''}`}>
            <div className="txn-card__top">
              <span className="txn-card__desc">{t.description}</span>
              <Amount {...t} />
            </div>
            <div className="txn-card__meta">
              <span>{formatDate(t.date)}</span>
              <span>{source(t)}</span>
            </div>
            <div className="txn-card__foot">
              <CategoryBadge txn={t} />
              {actions(t)}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
