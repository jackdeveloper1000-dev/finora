import useForm from '../../hooks/useForm';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Field from '../ui/Field';
import Modal from '../ui/Modal';

// A deliberate speed bump for destructive actions: password, and optionally a typed word.
export default function ConfirmPasswordModal({ title, description, actionLabel, confirmWord, onConfirm, onClose }) {
  const form = useForm({
    initialValues: { password: '', typed: '' },
    validate: (values) => {
      const errors = createValidator({ password: [rules.required('Enter your password')] })(values);
      if (confirmWord && values.typed.trim() !== confirmWord) errors.typed = `Type ${confirmWord} to continue`;
      return errors;
    },
    onSubmit: ({ password }) => onConfirm(password),
  });

  return (
    <Modal title={title} onClose={onClose}>
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <p className="muted">{description}</p>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Your password" type="password" autoComplete="current-password" {...form.bind('password')} />
        {confirmWord && <Field label={`Type ${confirmWord} to confirm`} autoComplete="off" {...form.bind('typed')} />}
        <div className="form-actions modal__actions">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="danger" loading={form.submitting}>{actionLabel}</Button>
        </div>
      </form>
    </Modal>
  );
}
