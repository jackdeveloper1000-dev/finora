import { CheckCircle2, FileSpreadsheet, XCircle } from 'lucide-react';
import { useState } from 'react';
import { documentsApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { validateFile } from '../../utils/files';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';
import DropZone from '../ui/DropZone';
import { Select } from '../ui/Select';
import Spinner from '../ui/Spinner';

const QUICK_EXTENSIONS = ['csv', 'xlsx'];
const QUICK_ACCEPT = QUICK_EXTENSIONS.map((e) => `.${e}`).join(',');
const checkFile = (file) => validateFile(file) || (QUICK_EXTENSIONS.includes(file.name.split('.').pop().toLowerCase()) ? '' : 'Only CSV and Excel (.xlsx) statements can be read for now.');

// Drop files and it starts straight away: upload, then the parent prepares the whole return.
export default function UploadStep({ assessmentYear, caseId, savedDocs = 0, years, onYearChange, onUploaded }) {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const patch = (id, changes) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...changes } : r)));

  const start = async (files) => {
    const entries = files.map((file, i) => ({ id: `${Date.now()}-${i}`, file, name: file.name, state: 'waiting', error: checkFile(file) }));
    setRows(entries.map((e) => ({ ...e, state: e.error ? 'failed' : 'waiting' })));
    setBusy(true);
    let uploaded = 0;
    for (const entry of entries.filter((e) => !e.error)) {
      patch(entry.id, { state: 'uploading' });
      try {
        await documentsApi.upload(caseId, { file: entry.file, docType: 'bank_statement' });
        patch(entry.id, { state: 'done' });
        uploaded += 1;
      } catch (err) {
        patch(entry.id, { state: 'failed', error: getErrorMessage(err) });
      }
    }
    setBusy(false);
    if (uploaded > 0) onUploaded();
  };

  return (
    <Card
      title="Upload your bank statements"
      subtitle="Drop one or more files. Finora reads them, sorts every transaction and prepares your return on its own."
      action={years.length > 1 && (
        <div className="quick__year">
          <Select variant="pill" ariaLabel="Assessment year" disabled={busy} options={years.map((y) => ({ value: y, label: `AY ${y}` }))} value={assessmentYear} onChange={onYearChange} />
        </div>
      )}
    >
      <div className="form">
        <DropZone onFiles={start} accept={QUICK_ACCEPT} disabled={busy} title={busy ? 'Uploading…' : 'Drop statements here, or tap to choose'} hint="CSV or Excel (.xlsx), up to 10 MB each." />
        {savedDocs > 0 && rows.length === 0 && (
          <Button variant="secondary" onClick={onUploaded}>Use the {savedDocs} statement{savedDocs === 1 ? '' : 's'} I already uploaded</Button>
        )}
        {rows.length > 0 && (
          <ul className="quick__files">
            {rows.map((r) => (
              <li key={r.id} className={`quick__file quick__file--${r.state}`}>
                <FileSpreadsheet size={18} />
                <span className="quick__file-name">{r.name}</span>
                {r.state === 'uploading' && <Spinner />}
                {r.state === 'done' && <CheckCircle2 size={18} />}
                {r.state === 'failed' && <XCircle size={18} />}
                {r.error && <span className="quick__file-error">{r.error}</span>}
              </li>
            ))}
          </ul>
        )}
        {!busy && rows.length > 0 && rows.every((r) => r.state === 'failed') && <Alert tone="warning">None of those files could be added. Check the messages above and try again.</Alert>}
      </div>
    </Card>
  );
}
