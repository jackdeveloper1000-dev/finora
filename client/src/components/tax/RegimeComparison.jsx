import { useState } from 'react';
import { taxApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { formatINR } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import TraceTable from './TraceTable';

const REGIMES = ['new', 'old'];

function RegimeCard({ calc, recommended, chosen, onChoose, busy }) {
  const refund = calc.netPayable < 0;
  return (
    <div className={`regime${recommended ? ' is-recommended' : ''}`}>
      <div className="regime__head">
        <h3>{calc.label}</h3>
        {recommended && <Badge tone="success">Lower tax</Badge>}
        {chosen && <Badge tone="info">Your choice</Badge>}
      </div>
      <dl className="regime__figures">
        <div><dt>Taxable income</dt><dd>{formatINR(calc.taxableIncome)}</dd></div>
        <div><dt>Total tax</dt><dd>{formatINR(calc.totalTax)}</dd></div>
        <div className="regime__net"><dt>{refund ? 'Refund due' : 'Tax payable'}</dt><dd className={refund ? 'amount--credit' : ''}>{formatINR(Math.abs(calc.netPayable))}</dd></div>
      </dl>
      <Button variant={chosen ? 'secondary' : 'primary'} size="sm" disabled={chosen} loading={busy} onClick={onChoose}>{chosen ? 'Selected' : 'Choose this regime'}</Button>
    </div>
  );
}

export default function RegimeComparison({ caseId, data, onChanged }) {
  const { calculation, chosenRegime } = data;
  const [view, setView] = useState(calculation.recommended);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const choose = async (regime) => {
    setBusy(regime);
    setError('');
    try {
      await taxApi.chooseRegime(caseId, regime);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const { ruleset } = calculation;

  return (
    <>
      <Card title="Old vs new regime" subtitle={calculation.savings > 0 ? `The ${calculation.recommended} regime saves you ${formatINR(calculation.savings)} in tax.` : 'Both regimes give the same tax.'}>
        <div className="form">
          <Alert tone="danger">{error}</Alert>
          {calculation.warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
          <div className="regimes">
            {REGIMES.map((r) => (
              <RegimeCard key={r} calc={calculation.regimes[r]} recommended={calculation.recommended === r && calculation.savings > 0} chosen={chosenRegime === r} busy={busy === r} onChoose={() => choose(r)} />
            ))}
          </div>
        </div>
      </Card>

      <Card title="How we calculated it" subtitle="Every line is computed by fixed rules and traced to its source.">
        <div className="form">
          <div className="tabs" role="tablist">
            {REGIMES.map((r) => (
              <button key={r} role="tab" aria-selected={view === r} className={`tab${view === r ? ' is-active' : ''}`} onClick={() => setView(r)}>{calculation.regimes[r].label}</button>
            ))}
          </div>
          <TraceTable steps={calculation.regimes[view].steps} />
          <p className="muted trace__foot">
            Tax rules v{ruleset.version} for FY {ruleset.financialYear} · {ruleset.source} · {ruleset.verified ? 'Verified by a tax professional' : 'Not yet verified by a tax professional'}
          </p>
        </div>
      </Card>
    </>
  );
}
