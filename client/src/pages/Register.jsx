import { Link, useNavigate } from 'react-router-dom';
import GoogleButton from '../components/auth/GoogleButton';
import AuthLayout, { TrustChips } from '../components/layout/AuthLayout';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import { useAuth } from '../context/AuthContext';
import useForm from '../hooks/useForm';
import { createValidator, rules } from '../utils/validators';

const validateFields = createValidator({
  name: [rules.required('Enter your full name')],
  email: [rules.required('Enter your email'), rules.email],
  password: [rules.password],
  confirmPassword: [rules.required('Confirm your password')],
});

const validate = (values) => {
  const errors = validateFields(values);
  if (values.confirmPassword && values.password !== values.confirmPassword) errors.confirmPassword = 'Passwords do not match';
  if (!values.terms) errors.terms = 'Please agree to continue';
  return errors;
};

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { name: '', email: '', password: '', confirmPassword: '', terms: false },
    validate,
    onSubmit: async ({ confirmPassword, terms, ...values }) => {
      const result = await register(values);
      navigate('/verify-email', { state: { email: result.email ?? values.email } });
    },
  });

  return (
    <AuthLayout
      title="Start filing in minutes"
      subtitle="Create your account and get a free tax preview."
      accountMode="register"
      footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
    >
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Full name" autoComplete="name" placeholder="Your full name" {...form.bind('name')} />
        <Field label="Email" type="email" autoComplete="email" placeholder="you@example.com" {...form.bind('email')} />
        <Field label="Password" type="password" autoComplete="new-password" placeholder="At least 8 characters" hint="Use a letter and a number." {...form.bind('password')} />
        <Field label="Confirm password" type="password" autoComplete="new-password" placeholder="Repeat your password" {...form.bind('confirmPassword')} />
        <TrustChips />
        <GoogleButton text="signup_with" onMfa={(mfaToken) => navigate('/login', { state: { mfaToken } })} />
        <div className="field">
          <label className="check auth__terms">
            <input type="checkbox" checked={form.values.terms} onChange={(e) => form.setValue('terms', e.target.checked)} aria-invalid={Boolean(form.errors?.terms)} />
            <span>I agree to the Terms of Service and Privacy Policy, and consent to Finora processing my data to compute and prepare my return.</span>
          </label>
          {form.errors?.terms && <span className="field__error" role="alert">{form.errors.terms}</span>}
        </div>
        <Button type="submit" block loading={form.submitting}>Create account</Button>
      </form>
    </AuthLayout>
  );
}
