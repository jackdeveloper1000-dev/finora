import { useState } from 'react';
import { reconcileApi } from '../../api/services';
import useForm from '../../hooks/useForm';
import { parseAmountInput, createValidator, rules } from '../../utils/validators';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Field from '../ui/Field';
import SelectField from '../ui/Select';

const initialValues = (source) => ({
  documentId: source.documentId ? String(source.documentId) : '',
  ...Object.fromEntries(source.facts.map((f) => [f.key, f.amount === null ? '' : String(f.amount)])),
});

export default function TaxFactsForm({ caseId, source, documents, onSaved }) {
  const [saved, setSaved] = useState(false);
  const matching = documents.filter((d) => d.docType === source.key);

  const validate = createValidator(Object.fromEntries(source.facts.map((f) => [f.key, [rules.optionalAmount]])));

  const form = useForm({
    initialValues: initialValues(source),
    validate,
    onSubmit: async (values) => {
      setSaved(false);
      await reconcileApi.saveFacts(caseId, source.key, {
        documentId: values.documentId ? Number(values.documentId) : null,
        values: Object.fromEntries(source.facts.map((f) => [f.key, parseAmountInput(values[f.key])])),
      });
      setSaved(true);
      onSaved();
    },
  });

  return (
    <Card title={source.label} subtitle={source.hint}>
      <form className="form" onSubmit={form.handleSubmit} noValidate>
        <Alert tone="danger">{form.submitError}</Alert>
        {saved && <Alert tone="success">{source.label} figures saved.</Alert>}
        <div className="form-grid">
          {source.facts.map((f) => (
            <Field key={f.key} label={f.label} optional inputMode="decimal" placeholder="0.00" {...form.bind(f.key)} />
          ))}
        </div>
        <SelectField
          label="Source document"
          optional
          hint={matching.length ? 'Attach the file these figures came from, so every number can be traced.' : `Upload your ${source.label} under Documents (type “${source.label}”) to attach it here.`}
          disabled={!matching.length}
          options={[{ value: '', label: 'None' }, ...matching.map((d) => ({ value: d.id, label: d.name }))]}
          {...form.bind('documentId')}
        />
        <div className="form-actions">
          <Button type="submit" loading={form.submitting}>Save {source.label}</Button>
        </div>
      </form>
    </Card>
  );
}
