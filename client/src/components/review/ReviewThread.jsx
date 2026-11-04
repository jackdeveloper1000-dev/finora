import { Send } from 'lucide-react';
import { useState } from 'react';
import { getErrorMessage } from '../../utils/errors';
import { formatDateTime } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Field from '../ui/Field';

export default function ReviewThread({ messages, onSend, canReply }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError('');
    try {
      await onSend(body.trim());
      setBody('');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="thread">
      {messages.length === 0 ? (
        <p className="muted">No messages yet.</p>
      ) : (
        <ul className="thread__list">
          {messages.map((m) => (
            <li key={m.id} className={`bubble bubble--${m.role === 'customer' ? 'customer' : 'expert'}`}>
              <strong>{m.author ?? (m.role === 'customer' ? 'Customer' : 'Expert')}</strong>
              <p>{m.body}</p>
              <em>{formatDateTime(m.createdAt)}</em>
            </li>
          ))}
        </ul>
      )}
      {canReply && (
        <form className="thread__form" onSubmit={submit} noValidate>
          <Alert tone="danger">{error}</Alert>
          <Field label="Message" as="textarea" rows={3} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} />
          <div className="form-actions">
            <Button type="submit" loading={sending} disabled={!body.trim()}><Send size={16} />Send</Button>
          </div>
        </form>
      )}
    </div>
  );
}
