import Badge from '../ui/Badge';

const toneOf = (txn) => {
  if (txn.status === 'ignored') return 'neutral';
  if (txn.needsReview) return 'warning';
  if (txn.status === 'confirmed' || txn.status === 'corrected') return 'success';
  return 'info';
};

const statusNote = { confirmed: 'Confirmed', corrected: 'Set by you', ignored: 'Ignored', unreviewed: 'Auto' };

export default function CategoryBadge({ txn }) {
  const { category, confidence, reason, status, needsReview } = txn;
  const note = needsReview ? (category.code === 'unknown' ? null : 'Needs review') : statusNote[status];
  const title = [reason, confidence ? `Confidence ${Math.round(confidence * 100)}%` : null].filter(Boolean).join(' · ');

  return (
    <span className="category" title={title}>
      <Badge tone={toneOf(txn)}>{category.label}</Badge>
      {note && <span className="category__note">{note}</span>}
    </span>
  );
}
