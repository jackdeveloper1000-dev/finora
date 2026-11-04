import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import FieldShell from './FieldShell';
import FloatingPanel from './FloatingPanel';

const TYPEAHEAD_MS = 600;

// A listbox that replaces the browser's own dropdown: same look everywhere, thumb-friendly sheet on phones, full keyboard support.
export function Select({ id, options, value, onChange, onBlur, placeholder = 'Select…', disabled, ariaLabel, title, variant = 'field', invalid }) {
  const autoId = useId();
  const listId = `${autoId}-list`;
  const triggerRef = useRef(null);
  const typed = useRef({ text: '', at: 0 });
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const selectedIndex = options.findIndex((o) => String(o.value) === String(value));
  const selected = options[selectedIndex];

  const close = useCallback(() => setOpen(false), []);
  const show = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : options.findIndex((o) => !o.disabled));
    setOpen(true);
  };

  const choose = (index) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const move = (step) => {
    let next = active;
    for (let i = 0; i < options.length; i += 1) {
      next = (next + step + options.length) % options.length;
      if (!options[next].disabled) break;
    }
    setActive(next);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Tab') return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(options.findIndex((o) => !o.disabled)); }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1 - [...options].reverse().findIndex((o) => !o.disabled)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); }
    else if (e.key.length === 1) {
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < TYPEAHEAD_MS ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => !o.disabled && String(o.label).toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
    }
  };

  useEffect(() => {
    if (!open) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, listId]);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className={`select__trigger${variant === 'pill' ? ' select__trigger--pill' : ' field__input'}${invalid ? ' is-invalid' : ''}`}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
      >
        <span className={`select__value${selected ? '' : ' is-placeholder'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={18} className={`select__chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      <FloatingPanel anchorRef={triggerRef} open={open} onClose={close} className="select__panel" title={title ?? ariaLabel} minWidth={200}>
        <ul id={listId} className="select__list" role="listbox" aria-label={ariaLabel ?? title}>
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === selectedIndex}
              aria-disabled={o.disabled || undefined}
              className={`select__option${i === active ? ' is-active' : ''}${i === selectedIndex ? ' is-selected' : ''}${o.disabled ? ' is-disabled' : ''}`}
              onMouseEnter={() => !o.disabled && setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span>{o.label}</span>
              {i === selectedIndex && <Check size={17} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      </FloatingPanel>
    </>
  );
}

// Drop-in for <Field as="select">: the same props as useForm's bind(), with the options passed as data.
export default function SelectField({ label, hint, error, valid, optional, options, value, onChange, onBlur, name, disabled, placeholder }) {
  const id = useId();
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} valid={valid}>
      <Select
        id={id}
        options={options}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        title={label}
        invalid={Boolean(error)}
        onBlur={onBlur}
        onChange={(next) => onChange({ target: { name, value: next } })}
      />
    </FieldShell>
  );
}
