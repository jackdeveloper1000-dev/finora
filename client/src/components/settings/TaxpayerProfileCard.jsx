import { useCallback, useState } from 'react';
import { profileApi } from '../../api/services';
import useFetch from '../../hooks/useFetch';
import useForm from '../../hooks/useForm';
import { OCCUPATION, RESIDENTIAL_STATUS } from '../../utils/format';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import DateField from '../ui/DatePicker';
import Field from '../ui/Field';
import SelectField from '../ui/Select';
import { ErrorState, PageLoader } from '../ui/StateView';

const EMPTY = { fullName: '', pan: '', dob: '', residentialStatus: 'resident', occupation: 'salaried', address: '' };

const adultCutoff = new Date();
adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
const LATEST_BIRTH = adultCutoff.toISOString().slice(0, 10);

function ProfileForm({ profile, onSaved }) {
  const [saved, setSaved] = useState(false);

  const validate = createValidator({
    fullName: [rules.required('Enter your name as per PAN')],
    pan: [profile ? () => '' : rules.required('PAN is required'), rules.pan],
    dob: [rules.adult],
  });

  const form = useForm({
    initialValues: profile ? { ...EMPTY, ...profile, pan: '' } : EMPTY,
    validate,
    onSubmit: async (values) => {
      setSaved(false);
      const { profile: next } = await profileApi.save({ ...values, pan: values.pan.trim().toUpperCase() || undefined });
      form.setValue('pan', '');
      setSaved(true);
      onSaved(next);
    },
  });

  return (
    <form className="form" onSubmit={form.handleSubmit} noValidate>
      <Alert tone="danger">{form.submitError}</Alert>
      {saved && <Alert tone="success">Taxpayer details saved.</Alert>}
      <div className="form-grid">
        <Field label="Full name (as per PAN)" autoComplete="name" {...form.bind('fullName')} />
        <Field
          label="PAN"
          maxLength={10}
          autoCapitalize="characters"
          placeholder={profile ? profile.panMasked : 'ABCPE1234F'}
          hint={profile ? 'Leave blank to keep your saved PAN.' : 'Stored encrypted. Only the last 4 characters are ever shown.'}
          {...form.bind('pan')}
          onChange={(e) => form.setValue('pan', e.target.value.toUpperCase())}
        />
        <DateField label="Date of birth" startWith="years" min="1900-01-01" max={LATEST_BIRTH} {...form.bind('dob')} />
        <SelectField label="Residential status" options={RESIDENTIAL_STATUS} {...form.bind('residentialStatus')} />
        <SelectField label="Primary occupation" options={OCCUPATION} {...form.bind('occupation')} />
        <div className="form-grid__full">
          <Field as="textarea" label="Address" optional maxLength={255} {...form.bind('address')} />
        </div>
      </div>
      <div className="form-actions"><Button type="submit" loading={form.submitting}>Save taxpayer details</Button></div>
    </form>
  );
}

export default function TaxpayerProfileCard() {
  const loader = useCallback(() => profileApi.get(), []);
  const { data, loading, error, reload } = useFetch(loader);
  const [updated, setUpdated] = useState(null);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const profile = updated ?? data.profile;

  return (
    <Card title="Taxpayer details" subtitle="Enter these exactly as they appear on your PAN card. They are used to prepare your return.">
      {!profile && <Alert tone="info" title="One quick step">Complete these details to start your first return.</Alert>}
      <ProfileForm profile={profile} onSaved={setUpdated} />
    </Card>
  );
}
