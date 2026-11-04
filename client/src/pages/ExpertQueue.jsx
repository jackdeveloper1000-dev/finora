import { ClipboardCheck, ShieldAlert } from 'lucide-react';
import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { expertApi } from '../api/services';
import { REVIEW_STATUS } from '../components/review/ReviewCard';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import { PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { formatDateTime } from '../utils/format';

const SCOPES = [
  { key: 'open', label: 'Waiting' },
  { key: 'mine', label: 'My reviews' },
  { key: 'done', label: 'Completed' },
];

export default function ExpertQueue() {
  const [scope, setScope] = useState('open');
  const loader = useCallback(() => expertApi.queue(scope), [scope]);
  const { data, loading, error, reload } = useFetch(loader);
  const needsMfa = error.includes('two-factor');

  return (
    <>
      <div className="page-head">
        <h1>Review queue</h1>
        <p>Returns customers have asked an expert to check.</p>
      </div>

      <div className="tabs" role="tablist">
        {SCOPES.map((s) => (
          <button key={s.key} role="tab" aria-selected={scope === s.key} className={`tab${scope === s.key ? ' is-active' : ''}`} onClick={() => setScope(s.key)}>{s.label}</button>
        ))}
      </div>

      <Card>
        {loading && !data && !error ? <PageLoader /> : needsMfa ? (
          <div className="state">
            <div className="state__icon"><ShieldAlert /></div>
            <h3>Turn on two-factor sign-in</h3>
            <p>Reviewers can see customer returns, so two-factor sign-in is required first.</p>
            <Link className="btn btn--primary" to="/settings?tab=security">Open security settings</Link>
          </div>
        ) : error ? (
          <div className="state">
            <h3>Could not load the queue</h3>
            <p>{error}</p>
            <button type="button" className="btn btn--secondary" onClick={reload}>Try again</button>
          </div>
        ) : data.reviews.length === 0 ? (
          <div className="state">
            <div className="state__icon"><ClipboardCheck /></div>
            <h3>Nothing here</h3>
            <p>{scope === 'open' ? 'No customers are waiting for a review.' : 'Reviews you pick up will appear here.'}</p>
          </div>
        ) : (
          <ul className="queue">
            {data.reviews.map((r) => (
              <li key={r.id}>
                <Link to={`/expert/reviews/${r.id}`} className="queue__item">
                  <span className="queue__main">
                    <strong>{r.customer}</strong>
                    <span className="muted">AY {r.assessmentYear} · requested {formatDateTime(r.requestedAt)}</span>
                    {r.requestNote && <span className="queue__note">{r.requestNote}</span>}
                  </span>
                  <Badge tone={REVIEW_STATUS[r.status].tone}>{REVIEW_STATUS[r.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
