import { UserRound } from 'lucide-react';
import { useCallback } from 'react';
import { casesApi, profileApi } from '../api/services';
import CaseCard from '../components/dashboard/CaseCard';
import Insights from '../components/dashboard/Insights';
import StartReturn from '../components/dashboard/StartReturn';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import { useAuth } from '../context/AuthContext';
import useFetch from '../hooks/useFetch';
import { firstName } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuth();
  const loader = useCallback(async () => {
    const [{ profile }, { cases, supportedYears }] = await Promise.all([profileApi.get(), casesApi.list()]);
    return { profile, cases, supportedYears };
  }, []);
  const { data, loading, error, reload } = useFetch(loader);

  if (loading) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { profile, cases, supportedYears } = data;
  const usedYears = new Set(cases.map((c) => c.assessmentYear));
  const availableYears = supportedYears.filter((y) => !usedYears.has(y));

  return (
    <>
      <div className="page-head">
        <h1>Hello, {firstName(user.name)}</h1>
        <p>Here&apos;s where your tax returns stand.</p>
      </div>

      {!profile ? (
        <Card>
          <div className="cta">
            <div className="cta__text">
              <h2>Complete your taxpayer profile</h2>
              <p>We need your PAN and basic details before we can start a return.</p>
            </div>
            <Button to="/settings"><UserRound size={18} />Complete profile</Button>
          </div>
        </Card>
      ) : (
        <StartReturn years={availableYears} onCreated={reload} />
      )}

      {cases.length > 0 && <Insights caseId={cases[0].id} caseReadiness={cases[0].readiness} />}
      {cases.map((item) => <CaseCard key={item.id} item={item} />)}
    </>
  );
}
