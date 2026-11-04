import { BadgeCheck, MessageSquareWarning } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { expertApi } from '../api/services';
import SectionCard from '../components/itr/SectionCard';
import ValidationPanel from '../components/itr/ValidationPanel';
import { REVIEW_STATUS } from '../components/review/ReviewCard';
import ReviewThread from '../components/review/ReviewThread';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Field from '../components/ui/Field';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { getErrorMessage } from '../utils/errors';
import { formatDateTime, formatINR } from '../utils/format';

export default function ExpertReview() {
  const { reviewId } = useParams();
  const loader = useCallback(() => expertApi.get(reviewId), [reviewId]);
  const { data, loading, error, reload } = useFetch(loader);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [actionError, setActionError] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { review, messages, taxpayer, calculation } = data;
  const itr = data.return;
  const status = REVIEW_STATUS[review.status];
  const calc = itr.regime && calculation ? calculation.regimes[itr.regime] : null;
  const blocked = itr.validation.errors.length > 0;

  const run = async (kind, task) => {
    setBusy(kind);
    setActionError('');
    try {
      await task();
      setNote('');
      await reload();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const decide = (decision) => run(decision, () => expertApi.decide(reviewId, { decision, message: note.trim() || undefined }));

  return (
    <>
      <div className="page-head">
        <h1>{review.customer} · AY {review.assessmentYear}</h1>
        <p><Badge tone={status.tone}>{status.label}</Badge> Requested {formatDateTime(review.requestedAt)}</p>
      </div>

      <Alert tone="danger">{actionError}</Alert>
      {data.changedSinceApproval && <Alert tone="warning" title="Figures changed after your approval">The customer changed this return after you approved it.</Alert>}

      <Card title="Taxpayer" className="review-summary">
        <div className="form">
          <dl className="itr-fields">
            <div className="itr-field"><dt>Name</dt><dd>{taxpayer.name}</dd></div>
            <div className="itr-field"><dt>PAN</dt><dd>{taxpayer.pan}</dd></div>
            {itr.regime && <div className="itr-field"><dt>Tax regime</dt><dd>{itr.regime === 'new' ? 'New' : 'Old'}</dd></div>}
            {calc && <div className="itr-field is-amount"><dt>Taxable income</dt><dd>{formatINR(calc.taxableIncome)}</dd></div>}
            {calc && <div className="itr-field is-amount"><dt>Net payable (refund if negative)</dt><dd>{formatINR(calc.netPayable)}</dd></div>}
          </dl>
          {review.requestNote && <Alert tone="info" title="Customer's note">{review.requestNote}</Alert>}
        </div>
      </Card>

      <ValidationPanel validation={itr.validation} reviewer />
      {itr.sections.map((section) => <SectionCard key={section.key} section={section} />)}

      <Card title="Conversation">
        {review.status === 'requested' ? (
          <div className="form">
            <p className="muted">Pick up this review to start. Other experts will no longer see it in the queue.</p>
            <div className="form-actions">
              <Button loading={busy === 'claim'} onClick={() => run('claim', () => expertApi.claim(reviewId))}>Pick up this review</Button>
            </div>
          </div>
        ) : (
          <ReviewThread messages={messages} canReply={['in_review', 'changes_needed'].includes(review.status)} onSend={(body) => run('message', () => expertApi.message(reviewId, body))} />
        )}
      </Card>

      {review.status === 'in_review' && (
        <Card title="Your decision" subtitle="Approving is recorded against the exact figures you saw.">
          <div className="form">
            <Field label="Message to the customer" optional as="textarea" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} hint="Required when asking for changes." />
            <div className="form-actions">
              <Button loading={busy === 'approved'} disabled={blocked} onClick={() => decide('approved')}><BadgeCheck size={18} />Approve return</Button>
              <Button variant="secondary" loading={busy === 'changes_needed'} disabled={!note.trim()} onClick={() => decide('changes_needed')}><MessageSquareWarning size={18} />Ask for changes</Button>
            </div>
            {blocked && <p className="muted">This return has blocking issues, so it can only be sent back for changes.</p>}
          </div>
        </Card>
      )}
    </>
  );
}
