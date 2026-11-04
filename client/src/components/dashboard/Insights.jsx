import { ArrowRight } from 'lucide-react';
import { useCallback } from 'react';
import { filingApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import { formatINR } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import ProgressRing from '../ui/ProgressRing';

const RISK_TONE = { low: 'success', medium: 'warning', high: 'warning' };
const RISK_LABEL = { low: 'Low risk', medium: 'Medium risk', high: 'High risk' };

function ProgressCard({ caseId, filing, caseReadiness }) {
  const { readiness, next } = filing;
  const progress = caseReadiness.progress;
  const nextPath = next?.path ?? 'itr';
  const statusMessage = readiness.blocking > 0
    ? `${readiness.blocking} validation issue${readiness.blocking === 1 ? '' : 's'} currently block approval.`
    : next
      ? 'No validation issues currently block approval. Continue with the next filing step.'
      : 'No blocking issues. You are ready to review and approve.';
  return (
    <Card title="Filing progress" subtitle={`AY ${filing.assessmentYear}`}>
      <div className="insight insight--row">
        <ProgressRing value={progress} />
        <div className="insight__body">
          <p>{statusMessage}</p>
          <div className="insight__actions">
            {next || readiness.blocking > 0 ? (
              <Button size="sm" to={`/cases/${caseId}/${nextPath}`}>
                {readiness.blocking > 0 ? 'Continue to resolve issues' : `Continue: ${next.label}`}<ArrowRight size={16} />
              </Button>
            ) : (
              <Badge tone="success">All steps complete</Badge>
            )}
            <Button size="sm" variant="secondary" to={`/cases/${caseId}/tax`}>Compare regimes</Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function RiskCard({ risk }) {
  return (
    <Card title="Notice risk" subtitle="How likely mismatches are to draw questions">
      {risk.level === null ? (
        <p className="muted">Upload your documents to see your notice risk.</p>
      ) : (
        <div className="insight">
          <div className="insight__line"><Badge tone={RISK_TONE[risk.level]}>{RISK_LABEL[risk.level]}</Badge><span className="muted">Score {risk.score}/100</span></div>
          <ul className="insight__list">{risk.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

function GapRow({ label, row }) {
  const pct = Math.min(100, Math.round((row.claimed / row.limit) * 100));
  return (
    <div className="gap">
      <div className="insight__line"><strong>{label}</strong><span className="muted">{formatINR(row.claimed)} of {formatINR(row.limit)}</span></div>
      <div className="gap__bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      <span className="gap__note">{row.gap > 0 ? `${formatINR(row.gap)} of room left` : 'Fully used'}</span>
    </div>
  );
}

function GapCard({ gap }) {
  return (
    <Card title="Deduction gap" subtitle="Unused room under the old-regime limits">
      {gap?.hasFigures ? (
        <div className="insight">
          <GapRow label="Section 80C" row={gap.section80C} />
          <GapRow label="Section 80D" row={gap.section80D} />
          <p className="muted insight__foot">These deductions apply to the old regime only.</p>
        </div>
      ) : (
        <p className="muted">Add the deductions from your Form 16 in the Reconcile step to see how much room you have left.</p>
      )}
    </Card>
  );
}

function AdvanceCard({ advance }) {
  let body = <p className="muted">Calculate your tax to see whether advance tax applies.</p>;
  if (advance) {
    body = advance.refund ? (
      <Alert tone="success">Estimated refund of {formatINR(Math.abs(advance.netPayable))}. No advance tax is needed.</Alert>
    ) : advance.applicable ? (
      <Alert tone="warning" title={`About ${formatINR(advance.netPayable)} still to pay`}>It is ₹10,000 or more after TDS, so advance tax instalments apply. Paying on time avoids interest.</Alert>
    ) : (
      <Alert tone="info">About {formatINR(advance.netPayable)} payable, which is under ₹10,000. No advance tax is needed.</Alert>
    );
  }
  return <Card title="Advance tax" subtitle={advance ? `Based on the ${advance.regime} regime` : 'Estimate'}>{body}</Card>;
}

export default function Insights({ caseId, caseReadiness }) {
  const loader = useCallback(() => filingApi.get(caseId), [caseId]);
  const { data: filing, loading, error } = useFetch(loader);

  if (error) return <Alert tone="danger" title="Smart insights unavailable">{error}</Alert>;
  if (loading && !filing) return <div className="insights">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton insights__skeleton" />)}</div>;

  return (
    <section aria-label="Smart insights" className="insights-wrap">
      <div className="page-head"><h2>Smart insights</h2><p>What Finora noticed while checking your return.</p></div>
      <div className="insights">
        <ProgressCard caseId={caseId} filing={filing} caseReadiness={caseReadiness} />
        <RiskCard risk={filing.insights.noticeRisk} />
        <GapCard gap={filing.insights.deductionGap} />
        <AdvanceCard advance={filing.insights.advanceTax} />
      </div>
    </section>
  );
}
