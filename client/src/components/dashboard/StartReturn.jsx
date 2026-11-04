import { Plus } from 'lucide-react';
import { casesApi } from '../../api/services';
import useForm from '../../hooks/useForm';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import SelectField from '../ui/Select';

export default function StartReturn({ years, onCreated }) {
  const form = useForm({
    initialValues: { assessmentYear: years[0] },
    onSubmit: async ({ assessmentYear }) => {
      await casesApi.create(assessmentYear);
      onCreated();
    },
  });

  if (!years.length) return null;

  return (
    <Card title="Start a new return" subtitle="Choose the assessment year you want to prepare.">
      <form className="form" onSubmit={form.handleSubmit}>
        <Alert tone="danger">{form.submitError}</Alert>
        <div className="start">
          <SelectField label="Assessment year" options={years.map((y) => ({ value: y, label: `AY ${y}` }))} {...form.bind('assessmentYear')} />
          <Button type="submit" loading={form.submitting}><Plus size={18} />Start return</Button>
        </div>
      </form>
    </Card>
  );
}
