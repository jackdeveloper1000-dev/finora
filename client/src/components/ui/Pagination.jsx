import { ChevronLeft, ChevronRight } from 'lucide-react';
import Button from './Button';

export default function Pagination({ page, pageSize, total, onChange, disabled }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav className="pagination" aria-label="Pagination">
      <span className="pagination__info">{from}–{to} of {total}</span>
      <div className="pagination__actions">
        <Button variant="secondary" size="sm" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
          <ChevronLeft size={16} />
        </Button>
        <span className="pagination__page">Page {page} / {pages}</span>
        <Button variant="secondary" size="sm" disabled={disabled || page >= pages} onClick={() => onChange(page + 1)} aria-label="Next page">
          <ChevronRight size={16} />
        </Button>
      </div>
    </nav>
  );
}
