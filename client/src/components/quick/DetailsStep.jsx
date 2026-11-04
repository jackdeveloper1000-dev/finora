import { profileApi } from '../../api/services';
import useForm from '../../hooks/useForm';
import { createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import DateField from '../ui/DatePicker';
import Field from '../ui/Field';

const adultCutoff = new Date();
adultCutoff.setFullYear(adultCutoff.getFullYear() - 18);
const LATEST_BIRTH = adultCutoff.toISOString().slice(0, 10);

// Only what the return itself needs; everything else gets a sensible default.
export default function DetailsStep({ profile, defaultName, onSaved }) {
  const validate = createValidator({
    fullName: [rules.required('Enter your name as per PAN')],
    pan: [profile ? () => '' : rules.required('Enter your PAN'), rules.pan],
    dob: [rules.adult],
    address: [rules.required('Enter your address')],
  });

  const form = useForm({
    initialValues: { fullName: profile?.fullName ?? defaultName ?? '', pan: '', dob: profile?.dob ?? '', address: profile?.address ?? '' },
    validate,
    onSubmit: async (values) => {
      const { profile: saved } = await profileApi.save({
        fullName: values.fullName.trim(),
        pan: values.pan.trim().toUpperCase() || undefined,
        dob: values.dob,
        address: values.address.trim(),
        residentialStatus: profile?.residentialStatus ?? 'resident',
        occupation: profile?.occupation ?? 'salaried',
      });
      onSaved(saved);
    },
  });

  return (
    <Card title="Your details" subtitle="Four fields, asked once. They go on the return exactly as you enter them.">
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        <Field label="Full name (as per PAN)" autoComplete="name" {...form.bind('fullName')} />
        <Field
          label="PAN"
          autoComplete="off"
          maxLength={10}
          placeholder={profile ? profile.panMasked : 'ABCPE1234F'}
          hint={profile ? 'Already saved. Leave blank to keep it.' : 'Stored encrypted. Only the last four characters are ever shown.'}
          {...form.bind('pan')}
          onChange={(e) => form.setValue('pan', e.target.value.toUpperCase())}
        />
        <DateField label="Date of birth" startWith="years" min="1900-01-01" max={LATEST_BIRTH} {...form.bind('dob')} />
        <Field label="Address" as="textarea" rows={2} autoComplete="street-address" {...form.bind('address')} />
        <Button type="submit" block loading={form.submitting}>Continue</Button>
      </form>
    </Card>
  );
}
