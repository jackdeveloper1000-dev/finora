import { ListChecks, Sparkles, UserRoundCheck } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { casesApi } from '../api/services';
import ConfirmDetails from '../components/filing/ConfirmDetails';
import DocumentChecklist from '../components/filing/DocumentChecklist';
import PersonaPicker from '../components/filing/PersonaPicker';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';

export default function Start() {
  const { caseId } = useParams();
  const { refreshFiling } = useOutletContext();
  const [showPersonas, setShowPersonas] = useState(false);
  const loader = useCallback(() => casesApi.get(caseId), [caseId]);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <>
      <div className="page-head">
        <h1>How would you like to start?</h1>
        <p>AY {data.case.assessmentYear}. Two ways to get going. You can switch at any time without losing work.</p>
      </div>

      <ConfirmDetails caseId={caseId} assessmentYear={data.case.assessmentYear} />

      <div className="starts">
        <div className="start-card start-card--main">
          <span className="start-card__icon"><Sparkles size={22} /></span>
          <div className="start-card__head"><h2>Start from your documents</h2><Badge tone="success">Recommended</Badge></div>
          <p>Upload your bank statements and tax documents. Finora reads them, sorts every transaction and shows what needs your attention.</p>
          <ul>
            <li>Finds salary, interest and dividends</li>
            <li>Flags what is missing or does not match</li>
            <li>Nothing to fill in by hand to begin</li>
          </ul>
          <Button to={`/cases/${caseId}/documents`}>Upload documents</Button>
        </div>

        <div className="start-card">
          <span className="start-card__icon start-card__icon--alt"><UserRoundCheck size={22} /></span>
          <div className="start-card__head"><h2>Tell us about yourself</h2></div>
          <p>Pick the profile that matches your situation. Finora sets up the right ITR form and tells you early if you need a professional.</p>
          <ul>
            <li>14 ready-made profiles</li>
            <li>Shows which return applies and why</li>
            <li>Best if you have not collected documents yet</li>
          </ul>
          <Button variant="secondary" onClick={() => setShowPersonas((v) => !v)} aria-expanded={showPersonas}>{showPersonas ? 'Hide profiles' : 'Choose a profile'}</Button>
        </div>
      </div>

      {showPersonas && <PersonaPicker caseId={caseId} onSaved={refreshFiling} />}

      <DocumentChecklist defaultOpen />
      <p className="muted start-foot"><ListChecks size={16} /> Answers and uploads are saved as you go.</p>
    </>
  );
}
