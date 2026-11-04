import { Link } from 'react-router-dom';
import Alert from '../ui/Alert';
import Card from '../ui/Card';

const LEVELS = { structural: 'Details', arithmetic: 'Arithmetic', business: 'Rules', cross_document: 'Documents' };

function IssueRow({ issue, caseId }) {
  return (
    <Alert tone={issue.severity === 'error' ? 'danger' : 'warning'} title={LEVELS[issue.level]}>
      <span>{issue.message}</span>
      {issue.fix && caseId && <> <Link to={`/cases/${caseId}/${issue.fix}`} className="no-print">Fix this</Link></>}
    </Alert>
  );
}

export default function ValidationPanel({ validation, caseId, reviewer = false }) {
  const { errors, warnings } = validation;
  const subtitle = errors.length ? `${errors.length} issue${errors.length === 1 ? '' : 's'} must be fixed before you can approve` : warnings.length ? 'No blocking issues. Please read the notes below.' : 'No issues found';

  return (
    <Card title="Checks" subtitle={subtitle} className="no-print">
      <div className="form">
        {errors.length === 0 && <Alert tone="success" title="Ready for approval">All validation checks passed.</Alert>}
        {errors.map((i) => <IssueRow key={i.code} issue={i} caseId={reviewer ? null : caseId} />)}
        {warnings.map((i) => <IssueRow key={i.code} issue={i} caseId={reviewer ? null : caseId} />)}
      </div>
    </Card>
  );
}
