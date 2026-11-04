import { Compass } from 'lucide-react';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <div className="page-loader">
      <div className="state">
        <div className="state__icon"><Compass /></div>
        <h1>Page not found</h1>
        <p>The page you are looking for doesn&apos;t exist or has moved.</p>
        <Button to="/dashboard">Back to dashboard</Button>
      </div>
    </div>
  );
}
