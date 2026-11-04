import { BadgeCheck, Download, ExternalLink, Send, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { itrApi } from '../../api/services';
import { getErrorMessage } from '../../utils/errors';
import { downloadBlob, formatDateTime, formatINR } from '../../utils/format';
import Alert from '../ui/Alert';
import Button from '../ui/Button';
import Card from '../ui/Card';

const stat = (label, value, tone) => (
  <div className={`quick__stat${tone ? ` quick__stat--${tone}` : ''}`}>
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

export default function ResultStep({ caseId, result, onChanged }) {
  const { summary, setAside, missingDocuments, files } = result;
  const [itr, setItr] = useState(result.return);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refund = summary.netPayable < 0;
  const approved = itr.canExport;
  const warnings = itr.validation.warnings.filter((w) => w.code !== 'rules_unverified');

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
      setItr(await itrApi.approve(caseId, itr.confirmations.map((c) => c.key)));
      onChanged?.();
    });

  const download = () =>
    run('download', async () => {
      const { blob, name } = await itrApi.exportPackage(caseId);
      downloadBlob(blob, name);
    });

  return (
    <>
      <Card title={approved ? 'Your return is ready' : 'Your return is prepared'} subtitle={`${itr.form} · AY ${itr.assessmentYear} · ${summary.regime === 'new' ? 'New' : 'Old'} tax regime chosen for you`}>
        <div className="form">
          <div className="quick__stats">
            {stat('Total income', formatINR(summary.totalIncome))}
            {stat('Taxable income', formatINR(summary.taxableIncome))}
            {stat('Tax for the year', formatINR(summary.totalTax))}
            {stat(refund ? 'Refund due' : 'Tax to pay', formatINR(Math.abs(summary.netPayable)), refund ? 'good' : summary.netPayable > 0 ? 'warn' : undefined)}
          </div>
          {summary.savedVersusOther > 0 && <Alert tone="success">Finora picked the {summary.regime} regime because it saves you {formatINR(summary.savedVersusOther)} compared with the other one.</Alert>}
          {files.failed.map((f) => <Alert key={f.name} tone="warning" title={`${f.name} was skipped`}>{f.message}</Alert>)}
          {setAside > 0 && <Alert tone="info" title={`${setAside} unclear transaction${setAside === 1 ? ' was' : 's were'} left out`}>They are not counted as income. If one is income, <Link to={`/cases/${caseId}/transactions`}>categorise it</Link> and the return updates.</Alert>}
          {missingDocuments > 0 && <Alert tone="info" title="Based on your bank statements only">Form 16, AIS and 26AS were not added, so salary and interest are taken from your statements. Add them from the detailed view for a closer match.</Alert>}
          {warnings.filter((w) => w.code !== 'salary_estimated').map((w) => <Alert key={w.code} tone="warning">{w.message}</Alert>)}
        </div>
      </Card>

      {approved ? (
        <Card title="Approved" className="quick__done">
          <div className="form">
            <Alert tone="success" title="You approved this return">Approved on {formatDateTime(itr.approvedAt)}. If a figure changes later, the approval is withdrawn automatically.</Alert>
            <Alert tone="danger">{error}</Alert>
            <div className="form-actions">
              <Button loading={busy === 'download'} onClick={download}><Download size={18} />Download return package</Button>
              <Button to={`/cases/${caseId}/file-itr`}><Send size={18} />File ITR</Button>
              <Button variant="secondary" to={`/cases/${caseId}/itr`}><ExternalLink size={18} />See the full return</Button>
            </div>
            <p className="muted">This is a review-ready copy, not an e-filing. Use the figures on the official portal or with a tax professional.</p>
          </div>
        </Card>
      ) : (
        <Card title="Approve" subtitle="One tick and you are done.">
          <div className="form">
            <Alert tone="danger">{error}</Alert>
            <label className="check">
              <input type="checkbox" checked={checked} disabled={!itr.canApprove} onChange={(e) => setChecked(e.target.checked)} />
              <span>I confirm my details are correct and I have no business income, capital gains, rent, foreign assets, directorships or losses to carry forward. I understand the tax rules used are not yet verified by a tax professional, and I am responsible for reviewing this return before filing.</span>
            </label>
            {!itr.canApprove && <Alert tone="warning">This return still has an issue to fix. <Link to={`/cases/${caseId}/itr`}>Open the detailed view</Link> to see what it is.</Alert>}
            <div className="form-actions">
              <Button loading={busy === 'approve'} disabled={!itr.canApprove || !checked} onClick={approve}><BadgeCheck size={18} />Approve my return</Button>
              <Button variant="ghost" to={`/cases/${caseId}/itr`}><UserCheck size={18} />Ask an expert to check it first</Button>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}
