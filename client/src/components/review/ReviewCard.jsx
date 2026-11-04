import { UserCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { reviewApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import { PageLoader } from '../ui/StateView';
import ReviewThread from './ReviewThread';

export const REVIEW_STATUS = {
  requested: { label: 'Waiting for an expert', tone: 'info' },
  in_review: { label: 'In review', tone: 'warning' },
  changes_needed: { label: 'Changes needed', tone: 'warning' },
  approved: { label: 'Approved by expert', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
};

const isActive = (r) => r && ['requested', 'in_review', 'changes_needed'].includes(r.status);

export default function ReviewCard({ caseId, onChanged }) {
  const loader = useCallback(() => reviewApi.get(caseId), [caseId]);
  const { data, loading, error: loadError, reload } = useFetch(loader);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (loading && !data) return <PageLoader />;
  if (loadError) return <Alert tone="danger">{loadError}</Alert>;

  const { review, messages, current } = data;
  const status = review && REVIEW_STATUS[review.status];

  const act = async (task) => {
    setBusy(true);
    setError('');
    try {
      await task();
      await reload();
      onChanged?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Expert review" subtitle="Ask a tax professional to check this return before you approve it." className="no-print review-card" action={status && <Badge tone={status.tone}>{status.label}</Badge>}>
      <div className="form">
        <Alert tone="danger">{error}</Alert>

        {!isActive(review) && review?.status === 'approved' && (
          <Alert tone={current ? 'success' : 'warning'} title={current ? 'An expert approved this return' : 'This approval is out of date'}>
            {current
              ? `${review.expert ?? 'An expert'} approved it on ${formatDateTime(review.decidedAt)}. You can now approve it yourself.`
              : 'Figures changed after the expert approved. Request a new review if you want them to check the latest version.'}
          </Alert>
        )}

        {review?.status === 'changes_needed' && <Alert tone="warning" title="Your expert asked for changes">Update the return as described below, then reply to let them know.</Alert>}
        {review?.status === 'requested' && <Alert tone="info" title="Your request is in the queue">You can keep working. Approval is paused until an expert responds or you cancel the request.</Alert>}
        {review?.status === 'in_review' && <Alert tone="info" title={`${review.expert} is reviewing`}>Approval is paused until they respond.</Alert>}

        {review && (messages.length > 0 || isActive(review)) && (
          <ReviewThread messages={messages} canReply={isActive(review)} onSend={(body) => act(() => reviewApi.reply(caseId, body))} />
        )}

        {isActive(review) ? (
          <div className="form-actions">
            <Button variant="secondary" loading={busy} onClick={() => act(() => reviewApi.cancel(caseId))}>Cancel request</Button>
          </div>
        ) : (
          <>
            <Field label="What should the expert look at?" optional as="textarea" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="form-actions">
              <Button loading={busy} onClick={() => act(async () => { await reviewApi.request(caseId, note); setNote(''); })}><UserCheck size={18} />{review ? 'Request another review' : 'Request expert review'}</Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
