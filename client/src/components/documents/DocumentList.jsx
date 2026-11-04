import { Cog, Eye, FileSpreadsheet, FileText, Image, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { documentsApi, ledgerApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { DOC_STATUS, DOC_TYPES, formatBytes, formatDateTime, labelOf } from '../../utils/format';
import Alert from '../ui/Alert';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Card from '../ui/Card';

const iconFor = (mime) => (mime.startsWith('image/') ? Image : mime === 'application/pdf' ? FileText : FileSpreadsheet);

function DocumentRow({ doc, onChanged, onError }) {
  const [busy, setBusy] = useState('');
  const [confirming, setConfirming] = useState(false);
  const Icon = iconFor(doc.mimeType);
  const status = DOC_STATUS[doc.status] ?? DOC_STATUS.uploaded;
  const canProcess = doc.docType === 'bank_statement' && ['uploaded', 'rejected'].includes(doc.status);

  const run = async (kind, task) => {
    setBusy(kind);
    onError('');
    try {
      await task();
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setBusy('');
      setConfirming(false);
    }
  };

  const view = () =>
    run('view', async () => {
      const tab = window.open('', '_blank');
      try {
        const { url } = await documentsApi.link(doc.id);
        tab.location.href = url;
      } catch (err) {
        tab?.close();
        throw err;
      }
    });

  const reprocess = () =>
    run('process', async () => {
      try {
        await ledgerApi.process(doc.id);
      } finally {
        onChanged();
      }
    });

  const remove = () =>
    run('delete', async () => {
      await documentsApi.remove(doc.id);
      onChanged();
    });

  return (
    <li className="doc">
      <span className="doc__icon"><Icon size={22} /></span>
      <div className="doc__main">
        <div className="doc__name" title={doc.name}>{doc.name}</div>
        <div className="doc__meta">
          {labelOf(DOC_TYPES, doc.docType)} · {formatBytes(doc.size)} · {formatDateTime(doc.uploadedAt)}
        </div>
        {doc.errorMessage && <div className="doc__error">{doc.errorMessage}</div>}
      </div>
      <Badge tone={status.tone}>{status.label}</Badge>
      <div className="doc__actions">
        {canProcess && (
          <Button size="sm" loading={busy === 'process'} onClick={reprocess}><Cog size={16} />{doc.status === 'rejected' ? 'Retry' : 'Process'}</Button>
        )}
        <Button variant="secondary" size="sm" loading={busy === 'view'} onClick={view} aria-label={`View ${doc.name}`}><Eye size={16} />View</Button>
        {confirming ? (
          <>
            <Button variant="danger" size="sm" loading={busy === 'delete'} onClick={remove}>Confirm</Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} aria-label={`Delete ${doc.name}`}><Trash2 size={16} /></Button>
        )}
      </div>
    </li>
  );
}

export default function DocumentList({ documents, onChanged }) {
  const [error, setError] = useState('');

  return (
    <Card title="Your documents" subtitle={`${documents.length} file${documents.length === 1 ? '' : 's'} in this return`}>
      <div className="form">
        <Alert tone="danger">{error}</Alert>
        {documents.length === 0 ? (
          <div className="state">
            <div className="state__icon"><FileText /></div>
            <h3>No documents yet</h3>
            <p>Upload your bank statements to get started.</p>
          </div>
        ) : (
          <ul className="docs">
            {documents.map((doc) => <DocumentRow key={doc.id} doc={doc} onChanged={onChanged} onError={setError} />)}
          </ul>
        )}
      </div>
    </Card>
  );
}
