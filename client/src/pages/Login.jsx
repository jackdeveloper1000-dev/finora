import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import GoogleButton from '../components/auth/GoogleButton';
import AuthLayout, { TrustChips } from '../components/layout/AuthLayout';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import useForm from '../hooks/useForm';
import { getErrorCode } from '../utils/errors';
import { createValidator, rules } from '../utils/validators';

const validate = createValidator({
  identifier: [rules.required('Enter your email or mobile number')],
  password: [rules.required('Enter your password')],
});

const validateCode = createValidator({ code: [rules.required('Enter the code from your authenticator app')] });

function CodeStep({ mfaToken, onBack }) {
  const { verifyMfa } = useAuth();
  const form = useForm({
    initialValues: { code: '' },
    validate: validateCode,
    onSubmit: ({ code }) => verifyMfa({ mfaToken, code }),
  });

  return (
    <AuthLayout
      title="Two-step verification"
      subtitle="Enter the 6-digit code from your authenticator app, or one of your backup codes."
      footer={<button type="button" className="linklike" onClick={onBack}>Back to sign in</button>}
    >
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Verification code" inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="123456" {...form.bind('code')} />
        <Button type="submit" block loading={form.submitting}>Verify and sign in</Button>
      </form>
    </AuthLayout>
  );
}

export default function Login() {
  const { login } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mfaToken, setMfaToken] = useState(location.state?.mfaToken ?? null);

  const form = useForm({
    initialValues: { identifier: '', password: '' },
    validate,
    onSubmit: async (values) => {
      try {
        const result = await login(values);
        if (result?.mfaRequired) setMfaToken(result.mfaToken);
      } catch (err) {
        if (getErrorCode(err) !== 'EMAIL_NOT_VERIFIED') throw err;
        const email = err.response.data.error.details?.email ?? values.identifier;
        navigate('/verify-email', { state: { email, notice: 'Verify your email to sign in. We sent you a new code.' } });
      }
    },
  });

  if (mfaToken) return <CodeStep mfaToken={mfaToken} onBack={() => setMfaToken(null)} />;

  return (
    <AuthLayout
      title="Continue your tax filing"
      subtitle="Sign in to review, verify and prepare your return."
      accountMode="login"
      footer={<>New to Finora? <Link to="/register">Create an account</Link></>}
    >
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="success">{location.state?.notice}</Alert>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Email or mobile number" autoComplete="username" placeholder="you@example.com" {...form.bind('identifier')} />
        <Field label="Password" type="password" autoComplete="current-password" placeholder="Enter your password" {...form.bind('password')} />
        <Link to="/forgot-password" className="auth-forgot">Forgot password?</Link>
        <TrustChips />
        <GoogleButton text="signin_with" onMfa={setMfaToken} />
        <Button type="submit" block loading={form.submitting}>Sign in</Button>
      </form>
    </AuthLayout>
  );
}
