import { useEffect, useRef, useState } from 'react';
import { authApi } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage } from '../../utils/errors';
import Alert from '../ui/Alert';

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

const loadGoogleScript = () =>
  new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true });
    script.addEventListener('load', resolve, { once: true });
    script.addEventListener('error', () => reject(new Error('Could not load Google sign-in.')), { once: true });
    if (!existing) document.head.appendChild(script);
  });

// Renders Google's own button. Hidden when the server has no Google client id configured.
export default function GoogleButton({ text = 'continue_with', onMfa }) {
  const { loginWithGoogle } = useAuth();
  const holder = useRef(null);
  const onMfaRef = useRef(onMfa);
  const signInRef = useRef(loginWithGoogle);
  onMfaRef.current = onMfa;
  signInRef.current = loginWithGoogle;
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { googleClientId } = await authApi.config();
        if (!googleClientId || cancelled) return;
        await loadGoogleScript();
        if (cancelled) return;
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async ({ credential }) => {
            setError('');
            try {
              const result = await signInRef.current(credential);
              if (result?.mfaRequired) onMfaRef.current?.(result.mfaToken);
            } catch (err) {
              setError(getErrorMessage(err));
            }
          },
        });
        setEnabled(true);
      } catch {
        /* Google sign-in is optional; email and password still work. */
      }
    })();
    return () => { cancelled = true; };
  }, [text]);

  // Google draws a fixed-pixel button, so draw it again whenever the available width changes.
  useEffect(() => {
    const node = holder.current;
    if (!enabled || !node) return undefined;
    let last = 0;
    const draw = () => {
      const width = Math.round(Math.min(Math.max(node.clientWidth, 200), 400));
      if (width === last) return;
      last = width;
      node.replaceChildren();
      window.google.accounts.id.renderButton(node, { theme: 'outline', size: 'large', text, shape: 'pill', width, logo_alignment: 'center' });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, text]);

  return (
    <div className="google" hidden={!enabled}>
      <div className="auth__or"><span>or</span></div>
      <div ref={holder} className="google__button" />
      <p className="google__note"><span className="google__tag">Recommended</span> No spam. Only used for secure sign-in.</p>
      <Alert tone="danger">{error}</Alert>
    </div>
  );
}
