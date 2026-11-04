import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, danger: XCircle };

export default function Alert({ tone = 'info', title, children }) {
  if (!children && !title) return null;
  const Icon = ICONS[tone];
  return (
    <div className={`alert alert--${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
      <Icon size={18} />
      <div className="alert__body">
        {title && <div className="alert__title">{title}</div>}
        {children}
      </div>
    </div>
  );
}
