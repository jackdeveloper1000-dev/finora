import { useState } from 'react';
import { reconcileApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { RECON_STATUS, formatINR } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Field from '../ui/Field';

const isOpen = (status) => status === 'mismatch' || status === 'missing';
const money = (value) => (value === null ? '—' : formatINR(value));

export default function ReconcileItem({ item, onChanged }) {
  const [explaining, setExplaining] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const status = RECON_STATUS[item.status];

  const submit = async (action) => {
    setBusy(action);
    setError('');
    try {
      await reconcileApi.resolve(item.id, { action, note: note || undefined });
      setExplaining(false);
      setNote('');
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  return (
    <li className={`recon recon--${item.status}`}>
      <div className="recon__head">
        <h3>{item.title}</h3>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <div className="recon__values">
        <div><span className="recon__source">{item.sourceA}</span><strong>{money(item.valueA)}</strong></div>
        <div><span className="recon__source">{item.sourceB}</span><strong>{money(item.valueB)}</strong></div>
      </div>
      <p className="recon__message">{item.message}</p>
      {item.note && <p className="recon__note">Your note: {item.note}</p>}

      {isOpen(item.status) && !explaining && <Button size="sm" variant="secondary" onClick={() => setExplaining(true)}>Explain &amp; resolve</Button>}
      {(item.status === 'resolved' || item.status === 'escalated') && (
        <Button size="sm" variant="ghost" loading={busy === 'reopen'} onClick={() => submit('reopen')}>Reopen</Button>
      )}

      {explaining && (
        <div className="form recon__form">
          <Alert tone="danger">{error}</Alert>
          <Field as="textarea" label="What explains the difference?" placeholder="e.g. Other bank account not uploaded yet" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="form-actions">
            <Button size="sm" loading={busy === 'resolve'} onClick={() => submit('resolve')}>Mark resolved</Button>
            <Button size="sm" variant="secondary" loading={busy === 'escalate'} onClick={() => submit('escalate')}>Ask an expert</Button>
            <Button size="sm" variant="ghost" onClick={() => setExplaining(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </li>
  );
}
