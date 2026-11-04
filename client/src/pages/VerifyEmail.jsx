import { MailCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { authApi } from '../api/services';
import CodeInput from '../components/auth/CodeInput';
import AuthLayout from '../components/layout/AuthLayout';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errors';

const RESEND_SECONDS = 60;
const LENGTH = 6;

export default function VerifyEmail() {
  const { verifyEmail } = useAuth();
  const { state } = useLocation();
  const email = state?.email;

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState(state?.notice ?? '');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (!email) return <Navigate to="/register" replace />;

  const submit = async (value = code) => {
    if (value.length !== LENGTH || busy) return;
    setBusy(true);
    setError('');
    try {
      await verifyEmail({ email, code: value });
    } catch (err) {
      setError(getErrorMessage(err));
      setCode('');
      setBusy(false);
    }
  };

  const handleChange = (value) => {
    setCode(value);
    setError('');
    if (value.length === LENGTH) submit(value);
  };

  const resend = async () => {
    setError('');
    try {
      await authApi.resendCode(email);
      setInfo(`A new code is on its way to ${email}.`);
      setCode('');
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Check your email"
      subtitle={<>We sent a 6-digit code to <strong>{email}</strong>. Enter it to verify your account.</>}
      footer={<>Wrong address? <Link to="/register">Start again</Link></>}
    >
      <form className="form" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <Alert tone="danger">{error}</Alert>
        {!error && <Alert tone="success" title={info ? undefined : <><MailCheck size={16} /> Code sent</>}>{info || 'It expires in 10 minutes. Check your spam folder if you do not see it.'}</Alert>}
        <CodeInput value={code} onChange={handleChange} disabled={busy} invalid={Boolean(error)} />
        <Button type="submit" block loading={busy} disabled={code.length !== LENGTH}>Verify and continue</Button>
        <p className="code__resend">
          Did not get it?{' '}
          {wait > 0 ? <span>Resend in {wait}s</span> : <button type="button" className="linklike" onClick={resend}>Send a new code</button>}
        </p>
      </form>
    </AuthLayout>
  );
}
