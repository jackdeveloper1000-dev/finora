export default function Card({ title, subtitle, action, className = '', children }) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || action) && (
        <header className="card__header">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
