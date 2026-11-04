export default function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className={`switch${disabled ? ' is-disabled' : ''}`}>
      <span className="switch__text">
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="switch__track" aria-hidden="true"><span /></span>
    </label>
  );
}
