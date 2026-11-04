import { useEffect, useState } from 'react';
import { classificationApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { formatDate, formatINR } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import SelectField from '../ui/Select';
import Modal from '../ui/Modal';

export default function CategoryDialog({ txn, categories, onClose, onSaved }) {
  const [code, setCode] = useState(txn.category.code === 'unknown' ? '' : txn.category.code);
  const [similar, setSimilar] = useState(0);
  const [applyToSimilar, setApplyToSimilar] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    classificationApi.similarCount(txn.id).then(({ count }) => setSimilar(count)).catch(() => {});
  }, [txn.id]);

  const save = async (e) => {
    e.preventDefault();
    if (!code) return setError('Choose a category');
    setSaving(true);
    setError('');
    try {
      const result = await classificationApi.update(txn.id, { action: 'categorize', categoryCode: code, applyToSimilar: similar > 0 && applyToSimilar });
      onSaved(result.updated);
    } catch (err) {
      setError(getErrorMessage(err));
      setSaving(false);
    }
  };

  const amount = txn.credit > 0 ? `+${formatINR(txn.credit)}` : `−${formatINR(txn.debit)}`;

  return (
    <Modal title="Set category" onClose={onClose}>
      <form className="form" onSubmit={save}>
        <div className="modal__txn">
          <strong>{txn.description}</strong>
          <span className="muted">{formatDate(txn.date)} · {amount}</span>
          {txn.reason && <span className="muted">Suggested: {txn.category.label}. {txn.reason}.</span>}
        </div>
        <Alert tone="danger">{error}</Alert>
        <SelectField label="Category" placeholder="Select a category…" options={categories.filter((c) => c.code !== 'unknown').map((c) => ({ value: c.code, label: c.label }))} value={code} onChange={(e) => setCode(e.target.value)} />
        {similar > 0 && (
          <label className="check">
            <input type="checkbox" checked={applyToSimilar} onChange={(e) => setApplyToSimilar(e.target.checked)} />
            <span>Also apply to {similar} similar unreviewed transaction{similar === 1 ? '' : 's'}</span>
          </label>
        )}
        <div className="form-actions modal__actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}
