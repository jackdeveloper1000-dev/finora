import { Copy, Download } from 'lucide-react';
import { useCallback, useState } from 'react';
import { accountApi, securityApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import useForm from '../../hooks/useForm';
import { getErrorMessage } from '../../utils/errors';
import { downloadBlob } from '../../utils/format';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import { ErrorState, PageLoader } from '../ui/StateView';

function BackupCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="form">
      <Alert tone="warning" title="Save your backup codes now">
        Each code works once if you lose your phone. We show them only this one time.
      </Alert>
      <ul className="codes">{codes.map((c) => <li key={c}>{c}</li>)}</ul>
      <div className="form-actions">
        <Button variant="secondary" onClick={copy}><Copy size={16} />{copied ? 'Copied' : 'Copy'}</Button>
        <Button variant="secondary" onClick={() => downloadBlob(new Blob([`Finora backup codes\n\n${text}\n`], { type: 'text/plain' }), 'finora-backup-codes.txt')}><Download size={16} />Download</Button>
        <Button onClick={onDone}>I’ve saved them</Button>
      </div>
    </div>
  );
}

function EnableForm({ setup, onEnabled, onCancel }) {
  const form = useForm({
    initialValues: { code: '' },
    validate: createValidator({ code: [rules.required('Enter the 6-digit code')] }),
    onSubmit: async ({ code }) => onEnabled((await securityApi.mfaEnable(code.trim())).backupCodes),
  });

  return (
    <form className="form" onSubmit={form.handleSubmit} noValidate>
      <ol className="mfa-steps">
        <li>Open an authenticator app (Google Authenticator, Microsoft Authenticator, Authy…) and scan this code.</li>
      </ol>
      <div className="mfa-setup">
        <img src={setup.qr} alt="QR code to add Finora to your authenticator app" width="180" height="180" />
        <div>
          <span className="muted">Can’t scan? Enter this key instead:</span>
          <code className="mfa-key">{setup.secret}</code>
        </div>
      </div>
      <Alert tone="danger">{form.submitError}</Alert>
      <Field label="Enter the 6-digit code from the app" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" {...form.bind('code')} />
      <div className="form-actions">
        <Button type="submit" loading={form.submitting}>Turn on</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

function DisableForm({ onDisabled, onCancel }) {
  const form = useForm({
    initialValues: { password: '', code: '' },
    validate: createValidator({ password: [rules.required('Enter your password')], code: [rules.required('Enter a code')] }),
    onSubmit: async (values) => {
      await securityApi.mfaDisable({ password: values.password, code: values.code.trim() });
      onDisabled();
    },
  });

  return (
    <form className="form" onSubmit={form.handleSubmit} noValidate>
      <Alert tone="danger">{form.submitError}</Alert>
      <Field label="Password" type="password" autoComplete="current-password" {...form.bind('password')} />
      <Field label="Authenticator or backup code" autoComplete="one-time-code" {...form.bind('code')} />
      <div className="form-actions">
        <Button type="submit" variant="danger" loading={form.submitting}>Turn off</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

export default function MfaCard() {
  const loader = useCallback(() => accountApi.get(), []);
  const { data, loading, error, reload } = useFetch(loader);
  const [view, setView] = useState('idle'); // idle | setup | codes | disable
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState([]);
  const [startError, setStartError] = useState('');
  const [starting, setStarting] = useState(false);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const enabled = data.account.mfaEnabled;

  const start = async () => {
    setStarting(true);
    setStartError('');
    try {
      setSetup(await securityApi.mfaSetup());
      setView('setup');
    } catch (err) {
      setStartError(getErrorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const finish = () => {
    setView('idle');
    reload();
  };

  let body;
  if (view === 'codes') body = <BackupCodes codes={codes} onDone={finish} />;
  else if (view === 'setup') body = <EnableForm setup={setup} onCancel={() => setView('idle')} onEnabled={(c) => { setCodes(c); setView('codes'); }} />;
  else if (view === 'disable') body = <DisableForm onCancel={() => setView('idle')} onDisabled={finish} />;
  else if (enabled) {
    body = (
      <div className="form">
        <Alert tone="success" title="Two-factor sign-in is on">You will be asked for a code from your authenticator app each time you sign in.</Alert>
        <div className="form-actions"><Button variant="secondary" onClick={() => setView('disable')}>Turn off</Button></div>
      </div>
    );
  } else {
    body = (
      <div className="form">
        <Alert tone="danger">{startError}</Alert>
        <p className="muted">Add a second step with an authenticator app, so a stolen password alone can’t open your account.</p>
        <div className="form-actions"><Button loading={starting} onClick={start}>Set up two-factor sign-in</Button></div>
      </div>
    );
  }

  return <Card title="Two-factor authentication" subtitle="An extra layer of security with an authenticator app.">{body}</Card>;
}
