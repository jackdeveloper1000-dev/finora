import { useEffect, useState } from 'react';
import { casesApi } from '../api/services';

const known = new Map();

// Looks up the assessment year of a return for labels such as breadcrumbs; one cheap request fills the cache for all returns.
export default function useCaseYear(caseId) {
  const [, refresh] = useState(0);

  useEffect(() => {
    if (!caseId || known.has(caseId)) return undefined;
    let cancelled = false;
    casesApi
      .years()
      .then(({ cases }) => {
        cases.forEach((c) => known.set(c.id, c.assessmentYear));
        if (!cancelled) refresh((n) => n + 1);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [caseId]);

  return caseId ? known.get(caseId) : undefined;
}
