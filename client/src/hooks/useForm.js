import { useCallback, useState } from 'react';
import { getErrorMessage, getFieldErrors } from '../utils/errors';

const hasErrors = (errors) => Object.values(errors).some(Boolean);

export default function useForm({ initialValues, validate = () => ({}), onSubmit }) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [valid, setValid] = useState({});

  const setValue = useCallback((name, value) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: '' } : prev));
    setValid((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
  }, []);

  const bind = (name) => ({
    name,
    value: values[name] ?? '',
    error: errors[name],
    valid: Boolean(valid[name]) && !errors[name] && Boolean(values[name]),
    onChange: (e) => setValue(name, e.target.value),
    // Validate a field when the user leaves it, so mistakes show up before submit.
    onBlur: () => {
      const message = validate(values)[name] || '';
      setErrors((prev) => ({ ...prev, [name]: message }));
      setValid((prev) => ({ ...prev, [name]: !message }));
    },
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setSubmitError('');
    if (hasErrors(found)) return;

    setSubmitting(true);
    try {
      await onSubmit(values);
    } catch (err) {
      setErrors(getFieldErrors(err));
      setSubmitError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return { values, errors, setValues, setValue, bind, handleSubmit, submitting, submitError, setSubmitError };
}
