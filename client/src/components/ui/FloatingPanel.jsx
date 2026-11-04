import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useMediaQuery from '../../hooks/useMediaQuery';

const GAP = 6;
const EDGE = 8;
const HIDDEN = { position: 'fixed', top: 0, left: 0, visibility: 'hidden' };

// A popover anchored to a control. It is drawn on <body>, so cards and dialogs can never clip it, and it flips
// upward when there is no room below. On phones it becomes a bottom sheet that is easy to reach with a thumb.
export default function FloatingPanel({ anchorRef, open, onClose, children, className = '', align = 'start', width, minWidth = 0, title, role, label }) {
  const panelRef = useRef(null);
  const sheet = useMediaQuery('(max-width: 600px)');
  const [style, setStyle] = useState(HIDDEN);

  const place = useCallback(() => {
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel || sheet) return;
    const rect = anchor.getBoundingClientRect();
    const panelWidth = Math.min(Math.max(width ?? rect.width, minWidth), window.innerWidth - EDGE * 2);
    const below = window.innerHeight - rect.bottom - EDGE - GAP;
    const above = rect.top - EDGE - GAP;
    const up = panel.scrollHeight > below && above > below;
    const left = Math.max(EDGE, Math.min(align === 'end' ? rect.right - panelWidth : rect.left, window.innerWidth - panelWidth - EDGE));
    const next = {
      position: 'fixed',
      left,
      width: panelWidth,
      maxHeight: Math.max(180, Math.min(up ? above : below, 440)),
      ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
    };
    setStyle((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [anchorRef, align, sheet, width, minWidth]);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, children]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, onClose, place, anchorRef]);

  if (!open) return null;

  return createPortal(
    <>
      {sheet && <div className="sheet__backdrop" aria-hidden="true" />}
      <div ref={panelRef} className={`float${sheet ? ' float--sheet' : ''} ${className}`.trim()} style={sheet ? undefined : style} role={role} aria-label={label}>
        {sheet && title && <div className="float__title">{title}</div>}
        {children}
      </div>
    </>,
    document.body,
  );
}
