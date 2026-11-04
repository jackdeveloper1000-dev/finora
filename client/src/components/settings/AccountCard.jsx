import { useState } from 'react';
import { accountApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import useForm from '../../hooks/useForm';
import { initials } from '../../utils/format';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';

export default function AccountCard() {
  const { user, updateUser } = useAuth();
  const [saved, setSaved] = useState(false);

  const form = useForm({
    initialValues: { name: user.name },
    validate: createValidator({ name: [rules.required('Enter your full name')] }),
    onSubmit: async ({ name }) => {
      setSaved(false);
      const { account } = await accountApi.rename(name.trim());
      updateUser({ name: account.name });
      setSaved(true);
    },
  });

  return (
    <Card title="Account">
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <div className="account-head">
          <span className="avatar avatar--lg">{initials(user.name)}</span>
          <div>
            <strong>{user.name}</strong>
            <div className="muted">{user.email || user.mobile}</div>
            <Badge tone="info">Taxpayer</Badge>
          </div>
        </div>
        <Alert tone="danger">{form.submitError}</Alert>
        {saved && <Alert tone="success">Name updated.</Alert>}
        <div className="form-grid">
          <Field label="Full name" autoComplete="name" {...form.bind('name')} />
          <Field label="Email" value={user.email || ''} disabled readOnly hint="Your sign-in email can’t be changed here." />
        </div>
        <div className="form-actions"><Button type="submit" loading={form.submitting}>Save changes</Button></div>
      </form>
    </Card>
  );
}
