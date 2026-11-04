import { CheckCheck } from 'lucide-react';
import { useState } from 'react';
import { classificationApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import Alert from '../ui/Alert';
import Button from '../ui/Button';

export default function ReviewBanner({ caseId, review, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const confirmAll = async () => {
    setBusy(true);
    setError('');
    try {
      await classificationApi.confirmHighConfidence(caseId);
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (review.needsReview === 0 && review.readyToConfirm === 0) {
    return <Alert tone="success" title="Review complete">Every transaction is categorized and nothing needs your attention.</Alert>;
  }

  return (
    <div className="form">
      <Alert tone="danger">{error}</Alert>
      <Alert tone={review.needsReview ? 'warning' : 'info'} title={review.needsReview ? `${review.needsReview} transaction${review.needsReview === 1 ? '' : 's'} need your review` : 'Auto-categorized transactions are ready to confirm'}>
        <div className="banner">
          <span>
            {review.needsReview > 0 && 'Unrecognised income and low-confidence tax items are never counted until you decide. '}
            {review.readyToConfirm > 0 && `${review.readyToConfirm} were categorized with high confidence.`}
          </span>
          {review.readyToConfirm > 0 && (
            <Button size="sm" variant="secondary" loading={busy} onClick={confirmAll}><CheckCheck size={16} />Confirm {review.readyToConfirm} high-confidence</Button>
          )}
        </div>
      </Alert>
    </div>
  );
}
