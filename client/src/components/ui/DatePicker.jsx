import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import FieldShell from './FieldShell';
import FloatingPanel from './FloatingPanel';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const YEARS_PER_PAGE = 12;

const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (iso) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return match ? { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) } : null;
};
const daysIn = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const weekdayOfFirst = (y, m) => new Date(Date.UTC(y, m, 1)).getUTCDay();
const todayISO = () => {
  const now = new Date();
  return toISO(now.getFullYear(), now.getMonth(), now.getDate());
};
const shiftDay = (iso, days) => {
  const p = parse(iso);
  const next = new Date(Date.UTC(p.y, p.m, p.d + days));
  return toISO(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate());
};
const shiftMonth = (iso, months) => {
  const p = parse(iso);
  const first = new Date(Date.UTC(p.y, p.m + months, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return toISO(y, m, Math.min(p.d, daysIn(y, m)));
};
const display = (iso) => {
  const p = parse(iso);
  return p ? `${pad(p.d)} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
};

function Calendar({ value, min, max, startWith, clearable, onPick, onClear }) {
  const today = todayISO();
  const initial = value || (max && today > max ? max : today);
  const [focus, setFocus] = useState(initial);
  const [mode, setMode] = useState(value ? 'days' : startWith);
  const [yearPage, setYearPage] = useState(() => Math.floor((parse(initial).y - 1) / YEARS_PER_PAGE));
  const gridRef = useRef(null);

  const view = parse(focus);
  const outOfRange = (iso) => (min && iso < min) || (max && iso > max);

  useEffect(() => {
    if (mode !== 'days') return;
    gridRef.current?.querySelector(`[data-date="${focus}"]`)?.focus({ preventScroll: true });
  }, [focus, mode]);

  const moveFocus = (next) => {
    if (outOfRange(next)) return;
    setFocus(next);
  };

  const onGridKey = (e) => {
    const keys = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in keys) { e.preventDefault(); moveFocus(shiftDay(focus, keys[e.key])); }
    else if (e.key === 'PageUp') { e.preventDefault(); moveFocus(shiftMonth(focus, e.shiftKey ? -12 : -1)); }
    else if (e.key === 'PageDown') { e.preventDefault(); moveFocus(shiftMonth(focus, e.shiftKey ? 12 : 1)); }
    else if (e.key === 'Home') { e.preventDefault(); moveFocus(toISO(view.y, view.m, 1)); }
    else if (e.key === 'End') { e.preventDefault(); moveFocus(toISO(view.y, view.m, daysIn(view.y, view.m))); }
  };

  const lead = weekdayOfFirst(view.y, view.m);
  const cells = [...Array(lead).fill(null), ...Array.from({ length: daysIn(view.y, view.m) }, (_, i) => i + 1)];
  const firstYear = yearPage * YEARS_PER_PAGE + 1;

  return (
    <div className="cal">
      <div className="cal__head">
        <button type="button" className="cal__nav" aria-label={mode === 'years' ? 'Earlier years' : 'Previous month'} onClick={() => (mode === 'years' ? setYearPage((p) => p - 1) : setFocus(shiftMonth(focus, mode === 'months' ? -12 : -1)))}><ChevronLeft size={18} /></button>
        <button type="button" className="cal__title" aria-live="polite" onClick={() => setMode(mode === 'days' ? 'months' : mode === 'months' ? 'years' : 'days')}>
          {mode === 'years' ? `${firstYear} – ${firstYear + YEARS_PER_PAGE - 1}` : mode === 'months' ? view.y : `${MONTHS[view.m]} ${view.y}`}
        </button>
        <button type="button" className="cal__nav" aria-label={mode === 'years' ? 'Later years' : 'Next month'} onClick={() => (mode === 'years' ? setYearPage((p) => p + 1) : setFocus(shiftMonth(focus, mode === 'months' ? 12 : 1)))}><ChevronRight size={18} /></button>
      </div>

      {mode === 'years' && (
        <div className="cal__picker" role="grid" aria-label="Choose a year">
          {Array.from({ length: YEARS_PER_PAGE }, (_, i) => firstYear + i).map((y) => {
            const disabled = (min && y < parse(min).y) || (max && y > parse(max).y);
            return (
              <button key={y} type="button" disabled={disabled} className={`cal__cell${y === view.y ? ' is-current' : ''}${value && parse(value).y === y ? ' is-selected' : ''}`} onClick={() => { setFocus(toISO(y, view.m, Math.min(view.d, daysIn(y, view.m)))); setMode('months'); }}>{y}</button>
            );
          })}
        </div>
      )}

      {mode === 'months' && (
        <div className="cal__picker" role="grid" aria-label="Choose a month">
          {MONTHS.map((name, m) => {
            const first = toISO(view.y, m, 1);
            const last = toISO(view.y, m, daysIn(view.y, m));
            const disabled = (min && last < min) || (max && first > max);
            return (
              <button key={name} type="button" disabled={disabled} className={`cal__cell${m === view.m ? ' is-current' : ''}`} onClick={() => { setFocus(toISO(view.y, m, Math.min(view.d, daysIn(view.y, m)))); setMode('days'); }}>{name.slice(0, 3)}</button>
            );
          })}
        </div>
      )}

      {mode === 'days' && (
        <>
          <div className="cal__week" aria-hidden="true">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
          <div className="cal__days" role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} ref={gridRef} onKeyDown={onGridKey}>
            {cells.map((day, i) => {
              if (day === null) return <span key={`b${i}`} />;
              const iso = toISO(view.y, view.m, day);
              const disabled = outOfRange(iso);
              return (
                <button
                  key={iso}
                  type="button"
                  data-date={iso}
                  tabIndex={iso === focus ? 0 : -1}
                  disabled={disabled}
                  aria-label={display(iso)}
                  aria-pressed={iso === value}
                  className={`cal__day${iso === value ? ' is-selected' : ''}${iso === today ? ' is-today' : ''}`}
                  onClick={() => onPick(iso)}
                >{day}</button>
              );
            })}
          </div>
        </>
      )}

      <div className="cal__foot">
        {clearable && value ? <button type="button" className="cal__link" onClick={onClear}>Clear</button> : <span />}
        <button type="button" className="cal__link" disabled={outOfRange(today)} onClick={() => onPick(today)}>Today</button>
      </div>
    </div>
  );
}

export function DatePicker({ id, value, onChange, onBlur, min, max, disabled, invalid, startWith = 'days', clearable = false, title = 'Choose a date', placeholder = 'Select a date' }) {
  const triggerRef = useRef(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select__trigger field__input${invalid ? ' is-invalid' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled}
        onBlur={onBlur}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={`select__value${value ? '' : ' is-placeholder'}`}>{value ? display(value) : placeholder}</span>
        <CalendarDays size={18} className="select__chevron" aria-hidden="true" />
      </button>
      <FloatingPanel anchorRef={triggerRef} open={open} onClose={close} className="cal__panel" width={320} title={title} role="dialog" label={title}>
        <Calendar
          value={value}
          min={min}
          max={max}
          startWith={startWith}
          clearable={clearable}
          onPick={(iso) => { onChange(iso); close(); }}
          onClear={() => { onChange(''); close(); }}
        />
      </FloatingPanel>
    </>
  );
}

// Drop-in for <Field type="date">: same props as useForm's bind(). Birth dates open on the year grid, so nobody scrolls back thirty years.
export default function DateField({ label, hint, error, valid, optional, value, onChange, onBlur, name, min, max, startWith, clearable, disabled }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} valid={valid}>
      <DatePicker id={id} value={value} min={min} max={max} startWith={startWith} clearable={clearable} disabled={disabled} title={label} invalid={Boolean(error)} onBlur={onBlur} onChange={(next) => onChange({ target: { name, value: next } })} />
    </FieldShell>
  );
}
