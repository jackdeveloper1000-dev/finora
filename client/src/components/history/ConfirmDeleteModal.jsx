import { useState } from 'react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

export default function ConfirmDeleteModal({ item, onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete AY ${item.assessmentYear}?`} onClose={onClose}>
      <div className="form">
        <p className="muted">This permanently deletes this return, its uploaded documents, transactions and calculations. This cannot be undone.</p>
        <div className="form-actions modal__actions">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={confirm}>Delete return</Button>
        </div>
      </div>
    </Modal>
  );
}
