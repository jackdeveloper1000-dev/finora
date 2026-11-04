import { Receipt } from 'lucide-react';
import { useCallback } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { casesApi, documentsApi } from '../api/services';
import DocumentList from '../components/documents/DocumentList';
import DocumentChecklist from '../components/filing/DocumentChecklist';
import UploadPanel from '../components/documents/UploadPanel';
import Button from '../components/ui/Button';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';

export default function Documents() {
  const { caseId } = useParams();
  const { refreshFiling } = useOutletContext();
  const loader = useCallback(async () => {
    const [{ case: item }, { documents }] = await Promise.all([casesApi.get(caseId), documentsApi.list(caseId)]);
    return { item, documents };
  }, [caseId]);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <h1>Documents · AY {data.item.assessmentYear}</h1>
        <p>Your files are private to your account. Every figure we extract will link back to its source document.</p>
      </div>
      {data.documents.some((d) => ['extracted', 'needs_review'].includes(d.status)) && (
        <Button to={`/cases/${caseId}/transactions`} variant="secondary" className="btn--block-mobile"><Receipt size={18} />View transactions</Button>
      )}
      <UploadPanel caseId={caseId} onUploaded={() => { reload(); refreshFiling(); }} />
      <DocumentList documents={data.documents} onChanged={() => { reload(); refreshFiling(); }} />
      <DocumentChecklist />
    </>
  );
}
