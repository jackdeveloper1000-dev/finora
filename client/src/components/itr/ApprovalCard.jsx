import { BadgeCheck, Download, Printer, Send } from 'lucide-react';
import { useState } from 'react';
import { itrApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { downloadBlob, formatDateTime } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';

export default function ApprovalCard({ caseId, itr, onChanged }) {
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const allChecked = itr.confirmations.every((c) => checked[c.key]);

  const run = async (kind, task) => {
    setBusy(kind);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy('');
    }
  };

  const approve = () =>
    run('approve', async () => {
      await itrApi.approve(caseId, Object.keys(checked).filter((k) => checked[k]));
      onChanged();
    });

  const exportPackage = () =>
    run('export', async () => {
      const { blob, name } = await itrApi.exportPackage(caseId);
      downloadBlob(blob, name);
    });

  if (itr.canExport) {
    return (
      <Card title="Approved" className="no-print">
        <div className="form">
          <Alert tone="success" title="You approved this return">Approved on {formatDateTime(itr.approvedAt)}. If any figure changes later, the approval is withdrawn and you will need to approve again.</Alert>
          <Alert tone="danger">{error}</Alert>
          <Alert tone="info" title="This is not an e-filing">The package is a review-ready copy of your return. Finora does not file with the Income Tax Department yet; use these figures to file on the official portal or with a tax professional.</Alert>
          <div className="form-actions">
            <Button loading={busy === 'export'} onClick={exportPackage}><Download size={18} />Download return package</Button>
            <Button variant="secondary" onClick={() => window.print()}><Printer size={18} />Print / Save as PDF</Button>
            <Button to={`/cases/${caseId}/file-itr`}><Send size={18} />{itr.filed ? 'Filing details' : 'File ITR'}</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card title="Approve your return" subtitle="Nothing is final until you approve it." className="no-print">
      <div className="form">
        <Alert tone="danger">{error}</Alert>
        {itr.approvalRevoked && <Alert tone="warning" title="Your earlier approval was withdrawn">Figures changed after you approved. Review the return and approve again.</Alert>}
        <ul className="confirmations">
          {itr.confirmations.map((c) => (
            <li key={c.key}>
              <label className="check">
                <input type="checkbox" checked={Boolean(checked[c.key])} disabled={!itr.canApprove} onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))} />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="form-actions">
          <Button loading={busy === 'approve'} disabled={!itr.canApprove || !allChecked} onClick={approve}><BadgeCheck size={18} />Approve return</Button>
          {!itr.canApprove && <span className="muted">Fix the issues above to enable approval.</span>}
        </div>
      </div>
    </Card>
  );
}
