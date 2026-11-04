import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useCallback } from 'react';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { casesApi, filingApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import Button from '../ui/Button';
import { Select } from '../ui/Select';
import FilingStepper from './FilingStepper';

// Wraps every per-return page with the year picker, progress stepper and back/continue navigation.
export default function FilingLayout() {
  const { caseId } = useParams();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lastSegment = pathname.split('/').pop();
  const currentPath = lastSegment === 'file-itr' ? 'itr' : lastSegment;

  // Reloads on every page change so the ticks and score stay current.
  const loader = useCallback(async () => {
    const [filing, { cases }] = await Promise.all([filingApi.get(caseId), casesApi.years()]);
    return { filing, cases };
  }, [caseId, pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const { data, reload } = useFetch(loader);

  const steps = data?.filing.steps ?? [];
  const index = steps.findIndex((s) => s.path === currentPath);
  const previous = index > 0 ? steps[index - 1] : null;
  const next = index >= 0 && index < steps.length - 1 ? steps[index + 1] : null;

  return (
    <div className="filing">
      <header className="filing__head">
        <div className="filing__bar">
          {data && (
            <div className="yearpick">
              <Select variant="pill" ariaLabel="Assessment year" options={data.cases.map((c) => ({ value: c.id, label: `AY ${c.assessmentYear}` }))} value={caseId} onChange={(next) => navigate(`/cases/${next}/${currentPath}`)} />
            </div>
          )}
          <span className="saved"><CheckCircle2 size={15} />Progress saves automatically</span>
          {data && (
            <span className="score" title="How ready your return is to approve">
              Readiness <strong>{data.filing.readiness.score}</strong>/100
              {data.filing.readiness.blocking > 0 && <em>{data.filing.readiness.blocking} blocking</em>}
            </span>
          )}
        </div>
        {data ? <FilingStepper caseId={caseId} steps={steps} current={currentPath} /> : <div className="stepper stepper--skeleton skeleton" />}
      </header>

      <Outlet context={{ refreshFiling: reload }} />

      <footer className="filing__foot">
        <div>{previous && <Button to={`/cases/${caseId}/${previous.path}`} variant="secondary"><ArrowLeft size={16} />{previous.label}</Button>}</div>
        <div className="filing__foot-right">
          <Link to="/dashboard" className="btn btn--ghost">Save &amp; finish later</Link>
          {next && <Button to={`/cases/${caseId}/${next.path}`}>{next.label}<ArrowRight size={16} /></Button>}
        </div>
      </footer>
    </div>
  );
}
