// Assessment year "2026-27" covers the financial year 1 Apr 2025 – 31 Mar 2026.
export const financialYear = (assessmentYear) => {
  const startYear = Number(assessmentYear.slice(0, 4)) - 1;
  const months = Array.from({ length: 12 }, (_, i) => {
    const month = ((i + 3) % 12) + 1;
    return `${month >= 4 ? startYear : startYear + 1}-${String(month).padStart(2, '0')}`;
  });
  return {
    label: `FY ${startYear}-${String(startYear + 1).slice(2)}`,
    start: `${startYear}-04-01`,
    end: `${startYear + 1}-03-31`,
    months,
  };
};
