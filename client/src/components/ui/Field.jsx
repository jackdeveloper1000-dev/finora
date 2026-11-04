import { useId, useState } from 'react';
import { CheckCircle2, Eye, EyeOff } from 'lucide-react';

export default function Field({ label, hint, error, valid, optional, as: Tag = 'input', type = 'text', children, ...rest }) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const isPassword = type === 'password';
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;

  return (
    <div className={`field${error ? ' field--error' : ''}${valid ? ' field--valid' : ''}`}>
      <label className="field__label" htmlFor={id}>
        {label} {optional && <span className="field__optional">(optional)</span>}
      </label>
      <div className="field__control">
        <Tag
          id={id}
          className="field__input"
          type={Tag === 'input' ? (isPassword && visible ? 'text' : type) : undefined}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          style={isPassword || valid ? { paddingRight: 44 } : undefined}
          {...rest}
        >
          {children}
        </Tag>
        {valid && !isPassword && Tag === 'input' && <CheckCircle2 className="field__valid-icon" size={18} aria-hidden="true" />}
        {isPassword && (
          <button type="button" className="field__toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
            {visible ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error ? (
        <span id={`${id}-err`} className="field__error" role="alert">{error}</span>
      ) : (
        hint && <span id={`${id}-hint`} className="field__hint">{hint}</span>
      )}
    </div>
  );
}
