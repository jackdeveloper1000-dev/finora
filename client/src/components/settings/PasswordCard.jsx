import { useState } from 'react';
import { securityApi } from '../../api/services';
import useForm from '../../hooks/useForm';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';

const validate = (values) => {
  const errors = createValidator({ currentPassword: [rules.required('Enter your current password')], newPassword: [rules.password] })(values);
  if (!errors.newPassword && values.confirm !== values.newPassword) errors.confirm = 'Passwords do not match';
  return errors;
};

export default function PasswordCard() {
  const [done, setDone] = useState(false);
  const form = useForm({
    initialValues: { currentPassword: '', newPassword: '', confirm: '' },
    validate,
    onSubmit: async ({ currentPassword, newPassword }) => {
      setDone(false);
      await securityApi.changePassword({ currentPassword, newPassword });
      form.setValues({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
    },
  });

  return (
    <Card title="Change password" subtitle="Changing your password signs you out everywhere else.">
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        {done && <Alert tone="success">Password updated. Other devices have been signed out.</Alert>}
        <Field label="Current password" type="password" autoComplete="current-password" {...form.bind('currentPassword')} />
        <div className="form-grid">
          <Field label="New password" type="password" autoComplete="new-password" hint="At least 8 characters with a letter and a number." {...form.bind('newPassword')} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" {...form.bind('confirm')} />
        </div>
        <div className="form-actions"><Button type="submit" loading={form.submitting}>Update password</Button></div>
      </form>
    </Card>
  );
}
