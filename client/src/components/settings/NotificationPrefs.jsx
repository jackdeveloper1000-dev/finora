import { useCallback, useState } from 'react';
import { accountApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import { getErrorMessage } from '../../utils/errors';
import Alert from '../ui/Alert';
import Card from '../ui/Card';
import { ErrorState, PageLoader } from '../ui/StateView';
import Switch from '../ui/Switch';

const OPTIONS = [
  { key: 'notifyProcessed', label: 'Document processed', description: 'When a statement or document has been read.' },
  { key: 'notifyReturns', label: 'Return updates', description: 'When your return is approved, or an approval is withdrawn because figures changed.' },
];

export default function NotificationPrefs() {
  const loader = useCallback(() => accountApi.get(), []);
  const { data, loading, error, reload } = useFetch(loader);
  const [prefs, setPrefs] = useState(null);
  const [failure, setFailure] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const current = prefs ?? data.preferences;

  const toggle = async (key, value) => {
    const previous = current;
    setPrefs({ ...current, [key]: value });
    setFailure('');
    try {
      setPrefs((await accountApi.savePreferences({ [key]: value })).preferences);
    } catch (err) {
      setPrefs(previous);
      setFailure(getErrorMessage(err));
    }
  };

  return (
    <Card title="Notification preferences" subtitle="Choose which alerts appear in your notification centre.">
      <div className="form">
        <Alert tone="danger">{failure}</Alert>
        <div className="switches">
          {OPTIONS.map((o) => <Switch key={o.key} label={o.label} description={o.description} checked={current[o.key]} onChange={(v) => toggle(o.key, v)} />)}
        </div>
      </div>
    </Card>
  );
}
