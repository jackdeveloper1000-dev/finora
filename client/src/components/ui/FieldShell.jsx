// The label, hint and error chrome shared by every form control, so custom controls look and read like plain inputs.
export default function FieldShell({ id, label, hint, error, optional, valid, children }) {
  return (
    <div className={`field${error ? ' field--error' : ''}${valid ? ' field--valid' : ''}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label} {optional && <span className="field__optional">(optional)</span>}
        </label>
      )}
      <div className="field__control">{children}</div>
      {error ? (
        <span id={`${id}-err`} className="field__error" role="alert">{error}</span>
      ) : (
        hint && <span id={`${id}-hint`} className="field__hint">{hint}</span>
      )}
    </div>
  );
}
