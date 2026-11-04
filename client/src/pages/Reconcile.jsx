import { Scale } from 'lucide-react';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { casesApi, reconcileApi } from '../api/services';
import ReconcileItem from '../components/reconcile/ReconcileItem';
import TaxFactsForm from '../components/reconcile/TaxFactsForm';
import Alert from '../components/ui/Alert';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';

export default function Reconcile() {
  const { caseId } = useParams();
  const loader = useCallback(async () => {
    const [{ case: item }, facts, recon] = await Promise.all([casesApi.get(caseId), reconcileApi.facts(caseId), reconcileApi.items(caseId)]);
    return { item, facts, recon };
  }, [caseId]);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { item, facts, recon } = data;

  return (
    <>
      <div className="page-head">
        <h1>Reconcile · AY {item.assessmentYear}</h1>
        <p>Enter the figures from your tax documents. We compare them with your bank statements and flag anything that does not line up.</p>
      </div>

      {recon.items.length === 0 ? (
        <Alert tone="info" title="Nothing to compare yet">Add figures from Form 16, AIS or Form 26AS below. Comparisons also need categorized bank transactions.</Alert>
      ) : recon.open > 0 ? (
        <Alert tone="warning" title={`${recon.open} item${recon.open === 1 ? '' : 's'} to resolve`}>Unresolved differences are never hidden from your final review.</Alert>
      ) : (
        <Alert tone="success" title="Everything reconciles">{recon.escalated > 0 ? `${recon.escalated} item(s) are waiting for expert review.` : 'No open differences.'}</Alert>
      )}

      {recon.items.length > 0 && (
        <Card title="Comparison results" action={<Scale size={20} className="muted" />}>
          <ul className="recon-list">
            {recon.items.map((i) => <ReconcileItem key={i.id} item={i} onChanged={reload} />)}
          </ul>
        </Card>
      )}

      {facts.sources.map((source) => (
        <TaxFactsForm key={source.key} caseId={caseId} source={source} documents={facts.documents} onSaved={reload} />
      ))}
    </>
  );
}
