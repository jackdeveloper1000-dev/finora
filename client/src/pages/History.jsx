import { ArrowRight, History as HistoryIcon, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import { casesApi, historyApi } from '../api/services';
import ConfirmDeleteModal from '../components/history/ConfirmDeleteModal';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { getErrorMessage } from '../utils/errors';
import { CASE_STATUS, formatINR } from '../utils/format';

const money = (value) => (value === undefined ? '—' : formatINR(value));

function ReturnRow({ item, previous, onDelete }) {
  const state = CASE_STATUS[item.status] ?? CASE_STATUS.draft;
  const tax = item.tax;
  const change = tax && previous?.tax ? tax.totalTax - previous.tax.totalTax : null;

  return (
    <li className="hist">
      <div className="hist__head">
        <div>
          <h3>AY {item.assessmentYear}</h3>
          <div className="hist__meta">
            <Badge tone={state.tone}>{state.label}</Badge>
            <Badge>{item.itrForm === 'UNDECIDED' ? 'Form not decided' : item.itrForm}</Badge>
            {tax && <Badge tone="info">{tax.regime === 'new' ? 'New' : 'Old'} regime{item.regimeChosen ? '' : ' (suggested)'}</Badge>}
          </div>
        </div>
        <div className="hist__actions">
          <Button to={`/cases/${item.id}/start`} size="sm">Continue<ArrowRight size={16} /></Button>
          <Button variant="ghost" size="sm" onClick={() => onDelete(item)} aria-label={`Delete AY ${item.assessmentYear}`}><Trash2 size={16} /></Button>
        </div>
      </div>
      {tax ? (
        <dl className="hist__figures">
          <div><dt>Total income</dt><dd>{money(tax.grossIncome)}</dd></div>
          <div><dt>Taxable income</dt><dd>{money(tax.taxableIncome)}</dd></div>
          <div><dt>Total tax</dt><dd>{money(tax.totalTax)}{change !== null && change !== 0 && <em className={change > 0 ? 'up' : 'down'}>{change > 0 ? '▲' : '▼'} {formatINR(Math.abs(change))} vs earlier year</em>}</dd></div>
          <div><dt>{tax.netPayable < 0 ? 'Refund' : 'Payable'}</dt><dd>{money(Math.abs(tax.netPayable))}</dd></div>
        </dl>
      ) : (
        <p className="muted">Tax has not been calculated for this year yet.</p>
      )}
    </li>
  );
}

export default function History() {
  const loader = useCallback(() => historyApi.list(), []);
  const { data, loading, error, reload } = useFetch(loader);
  const [pending, setPending] = useState(null);
  const [failure, setFailure] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const returns = data.returns;
  const remove = async () => {
    setFailure('');
    try {
      await casesApi.remove(pending.id);
      setPending(null);
      reload();
    } catch (err) {
      setFailure(getErrorMessage(err));
      setPending(null);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Filing history</h1>
        <p>Your returns by assessment year, with a year-on-year comparison of tax.</p>
      </div>
      <Alert tone="danger">{failure}</Alert>

      {returns.length === 0 ? (
        <Card>
          <div className="state">
            <div className="state__icon"><HistoryIcon /></div>
            <h3>No returns yet</h3>
            <p>Start a return from your dashboard and it will show up here.</p>
            <Button to="/dashboard">Go to dashboard</Button>
          </div>
        </Card>
      ) : (
        <ul className="hist-list">
          {returns.map((item, i) => <ReturnRow key={item.id} item={item} previous={returns[i + 1]} onDelete={setPending} />)}
        </ul>
      )}

      {pending && <ConfirmDeleteModal item={pending} onConfirm={remove} onClose={() => setPending(null)} />}
    </>
  );
}
