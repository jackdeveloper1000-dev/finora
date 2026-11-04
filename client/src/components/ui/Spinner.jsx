export default function Spinner({ large }) {
  return <span className={`spinner${large ? ' spinner--lg' : ''}`} role="status" aria-label="Loading" />;
}
