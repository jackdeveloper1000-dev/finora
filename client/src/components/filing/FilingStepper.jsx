import { Check } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// Same names as the sidebar, so the step you are on and the section you are in read as one thing.
const LABELS = { transactions: 'Analysis', tax: 'Tax summary', itr: 'ITR' };

export default function FilingStepper({ caseId, steps, current }) {
  const listRef = useRef(null);

  // On a phone the row scrolls sideways. Move only this row (never the page) so the current step sits in the middle.
  useEffect(() => {
    const list = listRef.current;
    const active = list?.querySelector('.is-active');
    if (!list || !active) return;
    list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.clientWidth) / 2 });
  }, [current, steps.length]);

  return (
    <div className="stepbar">
      <ol className="stepper" aria-label="Filing progress" ref={listRef}>
      {steps.map((step, i) => {
        const active = step.path === current;
        return (
          <li key={step.key} className={`stepper__item${active ? ' is-active' : ''}${step.done ? ' is-done' : ''}`}>
            <Link to={`/cases/${caseId}/${step.path}`} aria-current={active ? 'step' : undefined}>
              <span className="stepper__dot">{step.done && !active ? <Check size={14} strokeWidth={3} /> : i + 1}</span>
              <span className="stepper__label">{LABELS[step.path] ?? step.label}</span>
            </Link>
          </li>
        );
      })}
      </ol>
    </div>
  );
}
