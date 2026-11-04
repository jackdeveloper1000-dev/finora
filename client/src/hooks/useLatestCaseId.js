import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { casesApi } from '../api/services';

// The menu links straight into the return you are working on: the one in the address bar, else the newest.
export default function useLatestCaseId(enabled = true) {
  const { pathname } = useLocation();
  const inCase = /^\/cases\/(\d+)/.exec(pathname)?.[1];
  const [latest, setLatest] = useState(null);
  const insideCase = Boolean(inCase);

  useEffect(() => {
    if (!enabled || insideCase) return;
    casesApi.years().then((d) => setLatest(d.cases[0]?.id ?? null)).catch(() => {});
  }, [enabled, insideCase, pathname]);

  return inCase ? Number(inCase) : latest;
}
