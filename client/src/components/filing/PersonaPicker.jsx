import { Check } from 'lucide-react';
import { useState } from 'react';
import { taxApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { PERSONAS } from './personas';

function Outcome({ outcome, caseId }) {
  if (!outcome) return null;
  if (outcome.kind === 'error') return <Alert tone="danger">{outcome.message}</Alert>;
  if (outcome.supported) {
    return (
      <Alert tone="success" title={`Good news: ${outcome.form} fits, and Finora can prepare it`}>
        Your answers are saved. Next, add your documents.
        <div className="form-actions"><Button size="sm" to={`/cases/${caseId}/documents`}>Continue to documents</Button></div>
      </Alert>
    );
  }
  return (
    <Alert tone="warning" title={outcome.form ? `This needs ${outcome.form}, which a tax professional should handle` : 'Finora cannot prepare this yet'}>
      {outcome.reasons.length ? <ul className="reasons">{outcome.reasons.map((r) => <li key={r}>{r}</li>)}</ul> : outcome.message}
    </Alert>
  );
}

export default function PersonaPicker({ caseId, onSaved }) {
  const [selected, setSelected] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [busy, setBusy] = useState(false);

  const choose = async (persona) => {
    if (persona.later || busy) return;
    setSelected(persona.key);
    setOutcome(null);

    if (persona.unsupportedReason) {
      setOutcome({ kind: 'info', supported: false, form: persona.form, reasons: [], message: persona.unsupportedReason });
      return;
    }
    setBusy(true);
    try {
      const result = await taxApi.saveEligibility(caseId, persona.answers);
      setOutcome({ kind: 'result', supported: result.supported, form: result.supported ? result.itrForm : result.suggestedForm, reasons: result.reasons.map((r) => r.message) });
      onSaved?.();
    } catch (err) {
      setOutcome({ kind: 'error', message: getErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Pick the profile that fits your year" subtitle="We set up the right ITR form and questions for you. You can change this later.">
      <div className="form">
        <div className="personas">
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              type="button"
              className={`persona-card${selected === p.key ? ' is-selected' : ''}${p.later ? ' is-later' : ''}`}
              onClick={() => choose(p)}
              disabled={p.later || busy}
              aria-pressed={selected === p.key}
            >
              <span className="persona-card__top">
                <Badge tone="info">{p.form}</Badge>
                {p.recommended && <Badge tone="success">Common</Badge>}
                {p.later && <Badge>Coming later</Badge>}
                {selected === p.key && <Check size={18} className="persona-card__check" />}
              </span>
              <strong>{p.title}</strong>
              <span>{p.text}</span>
            </button>
          ))}
        </div>
        <Outcome outcome={outcome} caseId={caseId} />
      </div>
    </Card>
  );
}
