import { FileWarning, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import { documentsApi, ledgerApi } from '../../api/services';
import useUploadQueue from '../../hooks/useUploadQueue';
import { ACCEPT_ATTR, ACCEPTED_EXTENSIONS, MAX_UPLOAD_MB } from '../../utils/files';
import { DOC_TYPES } from '../../utils/format';
import Card from '../ui/Card';
import DropZone from '../ui/DropZone';
import SelectField from '../ui/Select';

export default function UploadPanel({ caseId, onUploaded }) {
  const [docType, setDocType] = useState('bank_statement');
  const upload = useCallback(
    async (file, options, onProgress) => {
      const { document } = await documentsApi.upload(caseId, { file, ...options }, onProgress);
      // A parsing problem is recorded on the document itself, so the upload still counts as done.
      if (options.docType === 'bank_statement') await ledgerApi.process(document.id).catch(() => {});
    },
    [caseId],
  );
  const { items, add, dismiss } = useUploadQueue({ upload, onUploaded });

  return (
    <Card title="Upload documents" subtitle="Bank statements, Form 16, AIS/26AS and supporting proofs.">
      <div className="form">
        <SelectField label="Document type" options={DOC_TYPES} value={docType} onChange={(e) => setDocType(e.target.value)} />
        <DropZone
          accept={ACCEPT_ATTR}
          onFiles={(files) => add(files, { docType })}
          title="Drag files here or tap to browse"
          hint={`${ACCEPTED_EXTENSIONS.join(', ').toUpperCase()} · up to ${MAX_UPLOAD_MB} MB each`}
        />
        {items.length > 0 && (
          <ul className="queue">
            {items.map((it) => (
              <li key={it.id} className={`queue__item${it.error ? ' has-error' : ''}`}>
                <div className="queue__main">
                  <span className="queue__name">{it.name}</span>
                  {it.error ? (
                    <span className="queue__error"><FileWarning size={14} />{it.error}</span>
                  ) : (
                    <div className="queue__bar" role="progressbar" aria-valuenow={it.progress} aria-valuemin={0} aria-valuemax={100}>
                      <span style={{ width: `${it.progress}%` }} />
                    </div>
                  )}
                </div>
                {it.error && (
                  <button type="button" className="icon-btn" onClick={() => dismiss(it.id)} aria-label={`Dismiss ${it.name}`}><X size={16} /></button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
