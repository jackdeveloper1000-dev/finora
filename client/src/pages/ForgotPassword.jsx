import { MailCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/services';
import AuthLayout from '../components/layout/AuthLayout';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import useForm from '../hooks/useForm';
import { createValidator, rules } from '../utils/validators';

const validate = createValidator({ email: [rules.required('Enter your email'), rules.email] });

export default function ForgotPassword() {
  const [sentTo, setSentTo] = useState('');
  const form = useForm({
    initialValues: { email: '' },
    validate,
    onSubmit: async ({ email }) => {
      await authApi.forgotPassword(email.trim());
      setSentTo(email.trim());
    },
  });

  const footer = <Link to="/login">Back to sign in</Link>;

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="If an account exists for that address, a reset link is on its way." footer={footer}>
        <div className="form">
          <Alert tone="success" title={<><MailCheck size={16} /> Link sent</>}>
            We emailed instructions to {sentTo}. The link works once and expires in 30 minutes.
          </Alert>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your email and we will send you a link to choose a new one." footer={footer}>
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" {...form.bind('email')} />
        <Button type="submit" block loading={form.submitting}>Send reset link</Button>
      </form>
    </AuthLayout>
  );
}
