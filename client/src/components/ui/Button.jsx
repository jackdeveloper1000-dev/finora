import { Link } from 'react-router-dom';
import Spinner from './Spinner';

export default function Button({ variant = 'primary', size, block, loading, disabled, to, className = '', children, ...rest }) {
  const classes = ['btn', `btn--${variant}`, size && `btn--${size}`, block && 'btn--block', className].filter(Boolean).join(' ');

  if (to) {
    return (
      <Link to={to} className={classes} {...rest}>
        {children}
      </Link>
    );
  }
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}
