import { useRef } from 'react';

// Six single-digit boxes that behave like one field: typing advances, backspace goes back, pasting fills them all.
export default function CodeInput({ value, onChange, length = 6, disabled, invalid, label = 'Verification code' }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? '');

  const focus = (i) => refs.current[Math.max(0, Math.min(length - 1, i))]?.focus();

  const set = (i, digit) => {
    const next = digits.slice();
    next[i] = digit;
    onChange(next.join(''));
  };

  const handleChange = (i, e) => {
    const typed = e.target.value.replace(/\D/g, '');
    if (!typed) return set(i, '');
    if (typed.length > 1) return fill(i, typed);
    set(i, typed);
    focus(i + 1);
  };

  const fill = (start, text) => {
    const next = digits.slice();
    text.split('').slice(0, length - start).forEach((d, k) => { next[start + k] = d; });
    onChange(next.join(''));
    focus(start + text.length);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !digits[i]) {
      e.preventDefault();
      set(Math.max(0, i - 1), '');
      focus(i - 1);
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };

  const handlePaste = (i, e) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '');
    if (!text) return;
    e.preventDefault();
    fill(i, text);
  };

  return (
    <div className={`code${invalid ? ' code--invalid' : ''}`} role="group" aria-label={label}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          className="code__box"
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={length}
          value={digit}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
