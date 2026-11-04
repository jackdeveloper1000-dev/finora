import { Receipt, Search } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { casesApi, classificationApi, ledgerApi } from '../api/services';
import CategoryBreakdown from '../components/ledger/CategoryBreakdown';
import CategoryDialog from '../components/ledger/CategoryDialog';
import IssueList from '../components/ledger/IssueList';
import LedgerSummary from '../components/ledger/LedgerSummary';
import ReviewBanner from '../components/ledger/ReviewBanner';
import TransactionTable from '../components/ledger/TransactionTable';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Pagination from '../components/ui/Pagination';
import { ErrorState, PageLoader } from '../components/ui/StateView';
import useDebouncedValue from '../hooks/useDebouncedValue';
import useFetch from '../hooks/useFetch';

const PAGE_SIZE = 25;

const TABS = [
  { key: 'review', label: 'Needs review' },
  { key: 'all', label: 'All' },
  { key: 'reviewed', label: 'Reviewed' },
  { key: 'ignored', label: 'Ignored' },
];

export default function Transactions() {
  const { caseId } = useParams();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(null);
  const [category, setCategory] = useState(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const q = useDebouncedValue(search.trim());

  useEffect(() => setPage(1), [q, filter, category]);

  const overview = useCallback(async () => {
    const [{ case: item }, { ledger }, { categories }] = await Promise.all([casesApi.get(caseId), ledgerApi.summary(caseId), classificationApi.categories()]);
    return { item, ledger, categories };
  }, [caseId]);
  const summary = useFetch(overview);

  const needsReview = summary.data?.ledger.review.needsReview ?? 0;
  const activeFilter = filter ?? (needsReview > 0 ? 'review' : 'all');

  const list = useCallback(
    () => ledgerApi.transactions(caseId, { page, pageSize: PAGE_SIZE, q: q || undefined, filter: activeFilter, category: category || undefined }),
    [caseId, page, q, activeFilter, category],
  );
  const txns = useFetch(list);

  const refresh = () => {
    summary.reload();
    txns.reload();
  };

  if (summary.loading && !summary.data) return <PageLoader />;
  if (summary.error) return <ErrorState message={summary.error} onRetry={summary.reload} />;

  const { item, ledger, categories } = summary.data;
  const { review } = ledger;
  const tabCount = { review: review.needsReview, ignored: review.ignored, reviewed: review.reviewed };

  const handleSaved = (updated) => {
    setEditing(null);
    setNotice(updated > 1 ? `Updated ${updated} transactions.` : 'Category saved.');
    refresh();
  };

  return (
    <>
      <div className="page-head">
        <h1>Transactions · AY {item.assessmentYear}</h1>
        <p>Every row links back to the statement and line it came from.</p>
      </div>

      {ledger.count === 0 ? (
        <Card>
          <div className="state">
            <div className="state__icon"><Receipt /></div>
            <h3>No transactions yet</h3>
            <p>Upload a bank statement (CSV or Excel) and we&apos;ll read it for you.</p>
            <Button to={`/cases/${caseId}/documents`}>Upload statement</Button>
          </div>
        </Card>
      ) : (
        <>
          <ReviewBanner caseId={caseId} review={review} onChanged={refresh} />
          <LedgerSummary ledger={ledger} />
          <CategoryBreakdown byCategory={review.byCategory} selected={category} onSelect={setCategory} />
          <IssueList issues={ledger.issues} />

          <Card
            title="Transactions"
            action={
              <label className="search">
                <Search size={16} />
                <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search description" aria-label="Search transactions" />
              </label>
            }
          >
            <div className="form">
              <div className="tabs" role="tablist">
                {TABS.map((tab) => (
                  <button key={tab.key} role="tab" aria-selected={activeFilter === tab.key} className={`tab${activeFilter === tab.key ? ' is-active' : ''}`} onClick={() => setFilter(tab.key)}>
                    {tab.label}{tabCount[tab.key] > 0 && <span className="tab__count">{tabCount[tab.key]}</span>}
                  </button>
                ))}
              </div>
              {category && (
                <div className="chip-row">
                  <span className="chip">Category: {categories.find((c) => c.code === category)?.label ?? category}<button type="button" onClick={() => setCategory(null)} aria-label="Clear category filter">×</button></span>
                </div>
              )}
              {notice && <Alert tone="success">{notice}</Alert>}
              <Alert tone="danger">{actionError}</Alert>

              {txns.error ? (
                <ErrorState message={txns.error} onRetry={txns.reload} />
              ) : !txns.data ? (
                <PageLoader />
              ) : txns.data.items.length === 0 ? (
                <div className="state"><p>{activeFilter === 'review' && !q && !category ? 'Nothing needs review. Nice work.' : 'No transactions match these filters.'}</p></div>
              ) : (
                <div className={txns.loading ? 'is-loading' : ''}>
                  <TransactionTable items={txns.data.items} onEdit={setEditing} onChanged={() => { setNotice(''); refresh(); }} onError={setActionError} />
                  <Pagination page={page} pageSize={PAGE_SIZE} total={txns.data.total} onChange={setPage} disabled={txns.loading} />
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {editing && <CategoryDialog txn={editing} categories={categories} onClose={() => setEditing(null)} onSaved={handleSaved} />}
    </>
  );
}
