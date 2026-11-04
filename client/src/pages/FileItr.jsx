import { CheckCircle2, Download, ExternalLink, Printer, ShieldAlert } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { itrApi, submissionApi } from '../api/services';
import Alert from '../components/ui/Alert';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import DateField from '../components/ui/DatePicker';
import Field from '../components/ui/Field';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useFetch from '../hooks/useFetch';
import useForm from '../hooks/useForm';
import { getErrorMessage } from '../utils/errors';
import { downloadBlob, formatDate } from '../utils/format';
import { createValidator, rules } from '../utils/validators';

const today = () => new Date().toISOString().slice(0, 10);

const validate = createValidator({
  ackNumber: [rules.required('Enter the acknowledgement number'), (v) => (/^\d{10,20}$/.test(v.trim()) ? '' : 'Digits only, as shown on the portal')],
  filedOn: [rules.required('Enter the date you filed')],
});

function Step({ n, title, children }) {
  return (
    <li className="fileitr__step">
      <span className="fileitr__n">{n}</span>
      <div><strong>{title}</strong>{children}</div>
    </li>
  );
}

function RecordForm({ caseId, onSaved }) {
  const form = useForm({
    initialValues: { ackNumber: '', filedOn: today(), eVerified: false },
    validate,
    onSubmit: async (values) => {
      await submissionApi.record(caseId, { ackNumber: values.ackNumber.trim(), filedOn: values.filedOn, eVerified: values.eVerified });
      onSaved();
    },
  });

  return (
    <form className="form" onSubmit={form.handleSubmit} noValidate>
      <Alert tone="danger">{form.submitError}</Alert>
      <Field label="Acknowledgement number" inputMode="numeric" autoComplete="off" {...form.bind('ackNumber')} />
      <DateField label="Date you filed" min="2020-04-01" max={today()} {...form.bind('filedOn')} />
      <label className="check">
        <input type="checkbox" checked={form.values.eVerified} onChange={(e) => form.setValue('eVerified', e.target.checked)} />
        <span>I have already e-verified the return on the portal.</span>
      </label>
      <Button type="submit" loading={form.submitting}>Mark as filed</Button>
    </form>
  );
}

export default function FileItr() {
  const { caseId } = useParams();
  const loader = useCallback(() => submissionApi.get(caseId), [caseId]);
  const { data, loading, error, reload } = useFetch(loader);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { submission, provider } = data;

  const download = async () => {
    setBusy(true);
    setActionError('');
    try {
      const { blob, name } = await itrApi.exportPackage(caseId);
      downloadBlob(blob, name);
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <h1>File ITR · AY {data.assessmentYear}</h1>
        <p>{submission ? <Badge tone="success">Filed</Badge> : <Badge tone="info">Ready to file</Badge>}</p>
      </div>

      {submission ? (
        <Card title="Filed" subtitle="Your return is closed. Keep the acknowledgement for your records.">
          <div className="form">
            <Alert tone="success" title="Marked as filed">Acknowledgement {submission.ackNumber}, filed on {formatDate(submission.filedOn)}.{submission.eVerified ? ' E-verified.' : ' Remember to e-verify on the portal if you have not yet.'}</Alert>
            <div className="form-actions">
              <Button variant="secondary" loading={busy} onClick={download}><Download size={18} />Download return package</Button>
              <Button variant="secondary" onClick={() => window.print()}><Printer size={18} />Print or save as PDF</Button>
            </div>
          </div>
        </Card>
      ) : !data.canFile ? (
        <Card>
          <div className="state">
            <div className="state__icon"><ShieldAlert /></div>
            <h3>Approve your return first</h3>
            <p>Filing opens once the return is checked and approved. Nothing is final until you approve it.</p>
            <Button to={`/cases/${caseId}/itr`}>Go to the return</Button>
          </div>
        </Card>
      ) : (
        <>
          <Alert tone="info" title="How filing works today">{provider.notice} Direct submission from Finora needs registration with the Income Tax Department as an e-Return Intermediary, so it is not switched on.</Alert>
          <Card title="File in four steps">
            <ol className="fileitr__steps">
              <Step n={1} title="Keep your figures at hand">
                <span>Every number on your return is on the return page. Print it or save it as a PDF to copy from.</span>
                <span className="fileitr__row">
                  <Button size="sm" variant="secondary" to={`/cases/${caseId}/itr`}>Open the return</Button>
                  <Button size="sm" variant="secondary" loading={busy} onClick={download}><Download size={16} />Download package</Button>
                </span>
              </Step>
              <Step n={2} title="Open the e-Filing portal and sign in">
                <span>Choose the assessment year, then ITR-1 and the online filing mode. The portal pre-fills much of it; compare with your figures.</span>
                <span className="fileitr__row"><a className="btn btn--secondary btn--sm" href={provider.portalUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={16} />Open the portal</a></span>
              </Step>
              <Step n={3} title="Submit and e-verify">
                <span>Review, submit and e-verify on the portal. An unverified return is treated as not filed.</span>
              </Step>
              <Step n={4} title="Record your acknowledgement here">
                <span>Enter the acknowledgement number the portal shows after submitting, so Finora can close this return.</span>
              </Step>
            </ol>
            <Alert tone="danger">{actionError}</Alert>
          </Card>
          <Card title="I have filed" subtitle="Only after you have submitted the return on the portal.">
            <RecordForm caseId={caseId} onSaved={reload} />
          </Card>
        </>
      )}

      <p className="muted fileitr__note"><CheckCircle2 size={14} /> The package Finora creates is a review copy in Finora's own format. It is not the official ITR JSON and cannot be uploaded to the portal as it is.</p>
    </>
  );
}
