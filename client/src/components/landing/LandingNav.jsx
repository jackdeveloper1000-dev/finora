import { ChevronDown, ExternalLink, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../ui/Logo';
import { NAV_LINKS, RESOURCES } from './content';

const ResourceLink = ({ item, onClick }) => (
  <a href={item.href} onClick={onClick} {...(item.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
    {item.label}{item.external && <ExternalLink size={14} />}
  </a>
);

function ResourcesMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="lp-menu" ref={ref}>
      <button type="button" className="lp-menu__btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Resources<ChevronDown size={15} />
      </button>
      {open && (
        <div className="lp-menu__panel" role="menu">
          {RESOURCES.map((r) => <ResourceLink key={r.label} item={r} onClick={() => setOpen(false)} />)}
        </div>
      )}
    </div>
  );
}

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <header className="lp-nav">
      <div className="lp-nav__bar">
        <span className="lp-logo"><Logo to="/" /></span>
        <nav className="lp-nav__links" aria-label="Sections">
          {NAV_LINKS.map((l, i) => <a key={l.href} href={l.href} className={i === 0 ? 'is-active' : ''}>{l.label}</a>)}
          <ResourcesMenu />
        </nav>
        <div className="lp-nav__actions">
          <Link to="/login" className="lp-btn lp-btn--ghost">Log in</Link>
          <Link to="/register" className="lp-btn lp-btn--solid lp-nav__cta">Get started</Link>
          <button type="button" className="lp-nav__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? 'Close menu' : 'Open menu'}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="lp-nav__menu" aria-label="Mobile sections">
          {NAV_LINKS.map((l) => <a key={l.href} href={l.href} onClick={() => setOpen(false)}>{l.label}</a>)}
          {RESOURCES.map((r) => <ResourceLink key={r.label} item={r} onClick={() => setOpen(false)} />)}
          <Link to="/login" onClick={() => setOpen(false)}>Log in</Link>
        </nav>
      )}
    </header>
  );
}
