import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/services';
import AuthLayout from '../components/layout/AuthLayout';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Field from '../components/ui/Field';
import useForm from '../hooks/useForm';
import { createValidator, rules } from '../utils/validators';

const validate = createValidator({ password: [rules.password] });

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();

  const form = useForm({
    initialValues: { password: '' },
    validate,
    onSubmit: async ({ password }) => {
      await authApi.resetPassword({ token, password });
      navigate('/login', { replace: true, state: { notice: 'Your password was updated. Sign in with your new password.' } });
    },
  });

  if (!token) {
    return (
      <AuthLayout title="Link not valid" subtitle="This reset link is incomplete." footer={<Link to="/login">Back to sign in</Link>}>
        <div className="form">
          <Alert tone="warning">Open the link from your email again, or request a new one.</Alert>
          <Link className="btn btn--primary btn--block" to="/forgot-password">Request a new link</Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Pick something you have not used before." footer={<Link to="/login">Back to sign in</Link>}>
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." {...form.bind('password')} />
        <Button type="submit" block loading={form.submitting}>Update password</Button>
        {form.submitError.includes('expired') && <Link to="/forgot-password">Request a new link</Link>}
      </form>
    </AuthLayout>
  );
}
