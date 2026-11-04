const rupees = (paise) => (paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Counts rows whose running balance doesn't follow from the previous row, for one row ordering.
const findBreaks = (txns) => {
  const breaks = [];
  for (let i = 1; i < txns.length; i++) {
    const prev = txns[i - 1];
    const cur = txns[i];
    if (prev.balance === null || cur.balance === null) continue;
    if (prev.balance + cur.credit - cur.debit !== cur.balance) breaks.push(cur.rowNumber);
  }
  return breaks;
};

// Statements are exported oldest-first or newest-first; use whichever order reconciles.
export const reconcileBalances = (txns) => {
  const withBalance = txns.filter((t) => t.balance !== null);
  if (withBalance.length < 2) return { checked: false };

  const forward = findBreaks(txns);
  const backward = findBreaks([...txns].reverse());
  const chronological = backward.length < forward.length ? [...txns].reverse() : txns;
  const breaks = backward.length < forward.length ? backward : forward;

  const first = chronological.find((t) => t.balance !== null);
  const last = [...chronological].reverse().find((t) => t.balance !== null);
  return {
    checked: true,
    breaks,
    opening: first.balance - first.credit + first.debit,
    closing: last.balance,
  };
};

export const buildIssues = ({ parsed, balance, inserted, duplicates, fy }) => {
  const issues = [];
  const { transactions, skippedRows, signConventionAssumed } = parsed;

  if (balance.checked) {
    if (balance.breaks.length) {
      const sample = balance.breaks.slice(0, 5).join(', ');
      issues.push({
        severity: 'warning',
        message: `Running balance does not match on ${balance.breaks.length} row(s) (e.g. rows ${sample}). Some transactions may be missing or misread.`,
      });
    } else {
      issues.push({
        severity: 'info',
        message: `Running balance reconciles. Opening ₹${rupees(balance.opening)}, closing ₹${rupees(balance.closing)}.`,
      });
    }
  } else {
    issues.push({ severity: 'info', message: 'No running balance in this file, so balance checks were skipped.' });
  }

  const outside = transactions.filter((t) => t.date < fy.start || t.date > fy.end).length;
  if (outside > 0) {
    issues.push({
      severity: 'warning',
      message: `${outside} transaction(s) fall outside ${fy.label}, which is what AY ${fy.assessmentYear} covers. Check that this statement is in the right return.`,
    });
  }
  if (duplicates > 0) {
    issues.push({ severity: 'info', message: `${duplicates} transaction(s) were already present from an overlapping statement and were not added again.` });
  }
  if (skippedRows > 0) {
    issues.push({ severity: skippedRows > 5 ? 'warning' : 'info', message: `${skippedRows} row(s) were skipped (totals, notes or unreadable lines).` });
  }
  if (signConventionAssumed) {
    issues.push({ severity: 'warning', message: 'Amounts had no Dr/Cr marker; negative values were treated as debits and positive as credits. Please verify.' });
  }
  if (transactions.some((t) => t.debit > 0 && t.credit > 0)) {
    issues.push({ severity: 'warning', message: 'Some rows have both a debit and a credit amount. Please review them.' });
  }
  if (inserted === 0 && duplicates === transactions.length) {
    issues.push({ severity: 'warning', message: 'Every transaction in this file was already in your ledger. This looks like a repeat upload.' });
  }
  return issues;
};
