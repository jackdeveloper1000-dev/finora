import Alert from '../ui/Alert';
import Card from '../ui/Card';

const TONE = { error: 'danger', warning: 'warning', info: 'info' };

export default function IssueList({ issues }) {
  if (!issues.length) return null;
  const attention = issues.filter((i) => i.severity !== 'info').length;

  return (
    <Card title="Checks" subtitle={attention ? `${attention} item(s) need your attention` : 'Everything looks consistent'}>
      <div className="form">
        {issues.map((issue) => (
          <Alert key={issue.id} tone={TONE[issue.severity]} title={issue.document}>{issue.message}</Alert>
        ))}
      </div>
    </Card>
  );
}
