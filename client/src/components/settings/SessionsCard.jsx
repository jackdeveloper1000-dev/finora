import { Laptop } from 'lucide-react';
import { useCallback, useState } from 'react';
import { securityApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import { getErrorMessage } from '../../utils/errors';
import { describeDevice, formatDateTime } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import { ErrorState, PageLoader } from '../ui/StateView';

export default function SessionsCard() {
  const loader = useCallback(() => securityApi.sessions(), []);
  const { data, loading, error, reload } = useFetch(loader);
  const [busy, setBusy] = useState(null);
  const [failure, setFailure] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const signOut = async (id) => {
    setBusy(id);
    setFailure('');
    try {
      await securityApi.revokeSession(id);
      await reload();
    } catch (err) {
      setFailure(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card title="Active sessions" subtitle="Devices that are currently signed in to your account.">
      <div className="form">
        <Alert tone="danger">{failure}</Alert>
        <ul className="sessions">
          {data.sessions.map((s) => (
            <li key={s.id} className="session">
              <span className="session__icon"><Laptop size={20} /></span>
              <div className="session__main">
                <strong>{describeDevice(s.device)}</strong>
                <span className="muted">Signed in {formatDateTime(s.signedInAt)}{s.ip ? ` · ${s.ip}` : ''}</span>
              </div>
              {s.current ? <Badge tone="success">This device</Badge> : <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => signOut(s.id)}>Sign out</Button>}
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
