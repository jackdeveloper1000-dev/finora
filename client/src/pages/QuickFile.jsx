import { AlertTriangle, ListChecks } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { casesApi, profileApi, quickApi } from '../api/services';
import DetailsStep from '../components/quick/DetailsStep';
import QuickSteps from '../components/quick/QuickSteps';
import ResultStep from '../components/quick/ResultStep';
import UploadStep from '../components/quick/UploadStep';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';

const isComplete = (p) => Boolean(p && p.dob && p.address);

// Three short steps: details (once), upload, approve. Everything in between is automatic.
export default function QuickFile() {
  const { user } = useAuth();
  const [boot, setBoot] = useState({ loading: true, error: '', profile: null, years: [], cases: [] });
  const [year, setYear] = useState('');
  const [caseId, setCaseId] = useState(null);
  const [phase, setPhase] = useState('details');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setBoot((b) => ({ ...b, loading: true, error: '' }));
    try {
      const [{ profile }, { cases, supportedYears }] = await Promise.all([profileApi.get(), casesApi.list()]);
      setBoot({ loading: false, error: '', profile, years: supportedYears, cases });
      setYear((y) => y || supportedYears[0]);
      setPhase(isComplete(profile) ? 'upload' : 'details');
    } catch (err) {
      setBoot((b) => ({ ...b, loading: false, error: getErrorMessage(err) }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The return for the chosen year is created on demand, so there is never a "start a return" step.
  useEffect(() => {
    if (!year || phase === 'details' || boot.loading) return;
    const existing = boot.cases.find((c) => c.assessmentYear === year);
    if (existing) {
      setCaseId(existing.id);
      return;
    }
    casesApi
      .create(year)
      .then(({ case: created }) => {
        setCaseId(created.id);
        setBoot((b) => ({ ...b, cases: [...b.cases, created] }));
      })
      .catch((err) => setError(getErrorMessage(err)));
  }, [year, phase, boot.loading, boot.cases]);

  const prepare = async () => {
    setPhase('working');
    setError('');
    try {
      const data = await quickApi.prepare(caseId);
      setResult(data);
      setPhase(data.status === 'ready' ? 'result' : data.status);
    } catch (err) {
      setError(getErrorMessage(err));
      setPhase('upload');
    }
  };

  if (boot.loading && !boot.profile && !boot.years.length) return <PageLoader />;
  if (boot.error) return <ErrorState message={boot.error} onRetry={load} />;

  const step = phase === 'details' ? 1 : phase === 'upload' || phase === 'working' ? 2 : 3;

  return (
    <>
      <div className="page-head">
        <h1>File your return</h1>
        <p>Three short steps. Finora does the sorting, the sums and the form for you.</p>
      </div>

      <QuickSteps current={step} done={phase === 'result' && result?.return?.canExport} />
      <Alert tone="danger">{error}</Alert>

      {phase === 'details' && (
        <DetailsStep profile={boot.profile} defaultName={user?.name} onSaved={(profile) => { setBoot((b) => ({ ...b, profile })); setPhase('upload'); }} />
      )}

      {(phase === 'upload' || phase === 'working') && (
        caseId ? (
          phase === 'working' ? (
            <Card><div className="state"><div className="state__icon"><ListChecks /></div><h3>Preparing your return…</h3><p>Reading your statements, sorting transactions, choosing the better tax regime. This takes a few seconds.</p></div></Card>
          ) : (
            <UploadStep caseId={caseId} assessmentYear={year} savedDocs={boot.cases.find((c) => c.id === caseId)?.readiness?.stats?.documents ?? 0} years={boot.years} onYearChange={(y) => { setCaseId(null); setYear(y); }} onUploaded={prepare} />
          )
        ) : (
          <PageLoader />
        )
      )}

      {phase === 'result' && result && <ResultStep caseId={caseId} result={result} />}

      {phase === 'no_income' && (
        <Card>
          <div className="state">
            <div className="state__icon"><AlertTriangle /></div>
            <h3>No income found in those statements</h3>
            <p>Finora could not find salary, interest or dividends. Try the statement for the account your salary is paid into.</p>
            <Button onClick={() => setPhase('upload')}>Upload another statement</Button>
          </div>
        </Card>
      )}

      {phase === 'unsupported' && (
        <Card title="This return needs more than ITR-1">
          <div className="form">
            <Alert tone="warning" title="What Finora noticed in your statements">
              <ul className="quick__reasons">{result.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
            </Alert>
            <p className="muted">A tax professional should prepare this one. You can still use the detailed view to look at your transactions.</p>
            <div className="form-actions"><Button variant="secondary" to={`/cases/${caseId}/transactions`}>Review transactions</Button></div>
          </div>
        </Card>
      )}

      {caseId && phase !== 'details' && (
        <p className="quick__advanced muted">Want every step and every check? <Link to={`/cases/${caseId}/start`}>Open the detailed view</Link>.</p>
      )}
    </>
  );
}
