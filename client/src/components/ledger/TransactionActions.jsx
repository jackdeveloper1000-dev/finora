import { Check, EyeOff, Pencil, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { classificationApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';

const ICON = 16;

export default function TransactionActions({ txn, onEdit, onChanged, onError }) {
  const [busy, setBusy] = useState(false);

  const run = async (action) => {
    setBusy(true);
    onError('');
    try {
      await classificationApi.update(txn.id, { action });
      onChanged();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const canConfirm = txn.status === 'unreviewed' && txn.category.code !== 'unknown';

  return (
    <div className="row-actions">
      {canConfirm && (
        <button type="button" className="icon-btn icon-btn--ok" disabled={busy} onClick={() => run('confirm')} aria-label="Confirm category" title="Confirm"><Check size={ICON} /></button>
      )}
      <button type="button" className="icon-btn" disabled={busy} onClick={() => onEdit(txn)} aria-label="Change category" title="Change category"><Pencil size={ICON} /></button>
      {txn.status === 'unreviewed' ? (
        <button type="button" className="icon-btn" disabled={busy} onClick={() => run('ignore')} aria-label="Ignore transaction" title="Ignore (exclude from totals)"><EyeOff size={ICON} /></button>
      ) : (
        <button type="button" className="icon-btn" disabled={busy} onClick={() => run('reset')} aria-label="Undo review" title="Undo review"><Undo2 size={ICON} /></button>
      )}
    </div>
  );
}
