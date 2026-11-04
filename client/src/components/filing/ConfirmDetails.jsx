import { useCallback, useState } from 'react';
import { profileApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import { RESIDENTIAL_STATUS, formatDate, labelOf } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { PageLoader } from '../ui/StateView';

// Age on the last day of the financial year decides the senior-citizen slabs, so it is worth a second look.
const ageOnFinancialYearEnd = (dob, assessmentYear) => {
  const end = new Date(Date.UTC(Number(assessmentYear.slice(0, 4)), 2, 31));
  const born = new Date(`${dob}T00:00:00Z`);
  let age = end.getUTCFullYear() - born.getUTCFullYear();
  if (end.getUTCMonth() < born.getUTCMonth() || (end.getUTCMonth() === born.getUTCMonth() && end.getUTCDate() < born.getUTCDate())) age -= 1;
  return age;
};

const storageKey = (caseId) => `finora.confirmed.${caseId}`;
const readConfirmed = (caseId) => {
  try {
    return localStorage.getItem(storageKey(caseId)) === '1';
  } catch {
    return false;
  }
};

export default function ConfirmDetails({ caseId, assessmentYear }) {
  const loader = useCallback(() => profileApi.get(), []);
  const { data, loading } = useFetch(loader);
  const [confirmed, setConfirmed] = useState(() => readConfirmed(caseId));

  const confirm = () => {
    setConfirmed(true);
    try {
      localStorage.setItem(storageKey(caseId), '1');
    } catch {
      // the confirmation still works for this visit
    }
  };

  if (loading) return <PageLoader />;
  const profile = data?.profile;
  if (!profile) return null;

  const age = ageOnFinancialYearEnd(profile.dob, assessmentYear);

  return (
    <Card title="Confirm it’s you" subtitle="Check these details. Your date of birth decides senior-citizen tax rates, so it has to be right.">
      <dl className="identity">
        <div><dt>Name</dt><dd>{profile.fullName}</dd></div>
        <div><dt>PAN</dt><dd>{profile.panMasked}</dd></div>
        <div><dt>Date of birth</dt><dd>{formatDate(profile.dob)} <span className="muted">(age {age} at year end)</span></dd></div>
        <div><dt>Residential status</dt><dd>{labelOf(RESIDENTIAL_STATUS, profile.residentialStatus)}</dd></div>
      </dl>
      {confirmed ? (
        <Alert tone="success" title="Details confirmed">Change them any time from your profile.</Alert>
      ) : (
        <div className="form-actions">
          <Button onClick={confirm}>Yes, that’s me</Button>
          <Button to="/settings" variant="secondary">Not quite, edit</Button>
        </div>
      )}
    </Card>
  );
}
