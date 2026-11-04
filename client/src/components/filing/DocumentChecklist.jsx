import { ChevronDown, FileText } from 'lucide-react';
import { DOCUMENT_CHECKLIST } from './personas';

export default function DocumentChecklist({ defaultOpen = false }) {
  return (
    <details className="checklist card" open={defaultOpen}>
      <summary>
        <span className="checklist__title"><FileText size={20} />Documents you may need, and how to get them</span>
        <ChevronDown size={20} className="checklist__chevron" />
      </summary>
      <ul className="checklist__list">
        {DOCUMENT_CHECKLIST.map((d) => (
          <li key={d.title}>
            <strong>{d.title}</strong>
            <span>{d.text}</span>
            <em>{d.how}</em>
          </li>
        ))}
      </ul>
    </details>
  );
}
