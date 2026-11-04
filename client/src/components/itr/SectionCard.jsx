import { RESIDENTIAL_STATUS, formatDate, formatINR, labelOf } from '../../utils/format';
import Card from '../ui/Card';

const displayValue = (field) => {
  if (field.kind === 'amount') return formatINR(field.value);
  if (field.code === 'PartA.ResidentialStatus') return labelOf(RESIDENTIAL_STATUS, field.value);
  if (field.code === 'PartA.DateOfBirth' && field.value) return formatDate(field.value);
  return field.value || '—';
};

export default function SectionCard({ section }) {
  return (
    <Card title={section.title} className="itr-section">
      <dl className="itr-fields">
        {section.fields.map((f) => (
          <div key={f.code} className={`itr-field${f.kind === 'amount' ? ' is-amount' : ''}`}>
            <dt>
              {f.label}
              {f.evidence && <span className="itr-field__evidence">{f.evidence}</span>}
            </dt>
            <dd>{displayValue(f)}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
