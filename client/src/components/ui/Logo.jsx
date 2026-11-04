import { useId } from 'react';
import { Link } from 'react-router-dom';

// An italic, rounded "F" built from three bars. The same shape is used for the favicon (public/favicon.svg).
export function LogoMark({ className = 'logo__mark' }) {
  const gradient = useId();
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="6" y1="4" x2="34" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#8b5cff" />
          <stop offset="1" stopColor="#5427d6" />
        </linearGradient>
      </defs>
      <g transform="translate(6 0) skewX(-14)" fill={`url(#${gradient})`}>
        <rect x="11" y="5" width="9" height="30" rx="3" />
        <rect x="11" y="5" width="24" height="8" rx="3" />
        <rect x="11" y="18" width="17" height="7.5" rx="3" />
      </g>
    </svg>
  );
}

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo" aria-label="Finora home">
      <LogoMark />
      Finora
    </Link>
  );
}
