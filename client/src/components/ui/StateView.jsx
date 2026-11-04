import { AlertCircle } from 'lucide-react';
import Button from './Button';
import Spinner from './Spinner';

export function PageLoader() {
  return (
    <div className="page-loader">
      <Spinner large />
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error">
      <div className="state__icon"><AlertCircle /></div>
      <h3>We couldn&apos;t load this</h3>
      <p>{message}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    </div>
  );
}
