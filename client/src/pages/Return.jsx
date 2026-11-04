import { FileCheck2 } from 'lucide-react';
import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { itrApi } from '../api/services';
import ApprovalCard from '../components/itr/ApprovalCard';
import ReviewCard from '../components/review/ReviewCard';
import SectionCard from '../components/itr/SectionCard';
import ValidationPanel from '../components/itr/ValidationPanel';
import Badge from '../components/ui/Badge';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { CASE_STATUS } from '../utils/format';

export default function Return() {
  const { caseId } = useParams();
  const loader = useCallback(() => itrApi.get(caseId), [caseId]);
  const { data: itr, loading, error, reload } = useFetch(loader);

  if (loading && !itr) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const status = CASE_STATUS[itr.status] ?? CASE_STATUS.draft;

  return (
    <>
      <div className="page-head">
        <h1>Return · {itr.form} · AY {itr.assessmentYear}</h1>
        <p><Badge tone={status.tone}>{status.label}</Badge>{itr.regime && <> {itr.regime === 'new' ? 'New' : 'Old'} tax regime</>}</p>
      </div>

      <ValidationPanel validation={itr.validation} caseId={caseId} />

      {itr.sections.length === 0 ? (
        <Card className="no-print">
          <div className="state">
            <div className="state__icon"><FileCheck2 /></div>
            <h3>Your return is not ready to preview</h3>
            <p>Calculate your tax and choose a regime first. Your return is built from those figures.</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="print-only print-note">Finora review copy · not an official e-filing · generated for your records</div>
          {itr.sections.map((section) => <SectionCard key={section.key} section={section} />)}
          <ReviewCard caseId={caseId} />
          <ApprovalCard caseId={caseId} itr={itr} onChanged={reload} />
        </>
      )}
    </>
  );
}
