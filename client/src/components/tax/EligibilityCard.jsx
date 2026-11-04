import { useState } from 'react';
import { taxApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';

function YesNo({ name, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={name}>
      {['yes', 'no'].map((option) => (
        <label key={option} className={`segmented__option${value === option ? ' is-active' : ''}`}>
          <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
          {option === 'yes' ? 'Yes' : 'No'}
        </label>
      ))}
    </div>
  );
}

function Outcome({ eligibility }) {
  if (!eligibility.complete) return <Alert tone="info">Answer every question to see which return applies to you.</Alert>;
  if (eligibility.supported) return <Alert tone="success" title="You can file ITR-1 with Finora">Based on your answers, a simple ITR-1 return fits your situation.</Alert>;
  return (
    <Alert tone="warning" title={eligibility.suggestedForm ? `This needs ${eligibility.suggestedForm}, which a tax professional should handle` : 'This is outside what Finora supports yet'}>
      <ul className="reasons">{eligibility.reasons.map((r) => <li key={r.code}>{r.message}</li>)}</ul>
    </Alert>
  );
}

export default function EligibilityCard({ caseId, eligibility, onSaved }) {
  const [answers, setAnswers] = useState(() => Object.fromEntries(eligibility.questions.map((q) => [q.key, q.answer])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty = eligibility.questions.some((q) => answers[q.key] !== q.answer);
  const filled = Object.fromEntries(Object.entries(answers).filter(([, v]) => v));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await taxApi.saveEligibility(caseId, filled);
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Which return applies to you?" subtitle="A few quick questions decide the ITR form. We only ask what is needed.">
      <div className="form">
        <Alert tone="danger">{error}</Alert>
        <ul className="questions">
          {eligibility.questions.map((q) => (
            <li key={q.key} className="question">
              <div>
                <div className="question__text">{q.question}</div>
                <div className="question__why">{q.why}</div>
              </div>
              <YesNo name={q.key} value={answers[q.key]} onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
            </li>
          ))}
        </ul>
        {eligibility.warnings.map((w) => <Alert key={w} tone="warning">{w}</Alert>)}
        {!dirty && <Outcome eligibility={eligibility} />}
        <div className="form-actions">
          <Button onClick={save} loading={saving} disabled={!dirty || Object.keys(filled).length === 0}>Save answers</Button>
        </div>
      </div>
    </Card>
  );
}
