import { Calculator } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { casesApi, taxApi } from '../api/services';
import EligibilityCard from '../components/tax/EligibilityCard';
import RegimeComparison from '../components/tax/RegimeComparison';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import { getErrorMessage } from '../utils/errors';

export default function Tax() {
  const { caseId } = useParams();
  const [calculating, setCalculating] = useState(false);
  const [calcError, setCalcError] = useState('');

  const loader = useCallback(async () => {
    const [{ case: item }, eligibility, calc] = await Promise.all([casesApi.get(caseId), taxApi.eligibility(caseId), taxApi.calculation(caseId)]);
    return { item, eligibility, calc };
  }, [caseId]);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { item, eligibility, calc } = data;

  const calculate = async () => {
    setCalculating(true);
    setCalcError('');
    try {
      await taxApi.calculate(caseId);
      reload();
    } catch (err) {
      setCalcError(getErrorMessage(err));
    } finally {
      setCalculating(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>Tax · AY {item.assessmentYear}</h1>
        <p>We calculate your tax under both regimes using fixed, versioned rules, so you can pick the better one.</p>
      </div>

      <EligibilityCard key={JSON.stringify(eligibility.questions.map((q) => q.answer))} caseId={caseId} eligibility={eligibility} onSaved={reload} />

      <Card title="Calculate your tax" subtitle="Uses your categorized bank transactions and the figures from your tax documents.">
        <div className="form">
          <Alert tone="danger">{calcError}</Alert>
          <div className="form-actions">
            <Button onClick={calculate} loading={calculating} disabled={!eligibility.supported}><Calculator size={18} />{calc.calculation ? 'Recalculate' : 'Calculate tax'}</Button>
            {!eligibility.supported && <span className="muted">{eligibility.complete ? 'Not available for this kind of return.' : 'Answer the questions above first.'}</span>}
          </div>
        </div>
      </Card>

      {calc.calculation && <RegimeComparison key={calc.calculation.calculatedAt} caseId={caseId} data={calc} onChanged={reload} />}
    </>
  );
}
