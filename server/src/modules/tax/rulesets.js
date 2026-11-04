import { query, queryOne } from '../../config/db.js';

// Rulesets are immutable once published: change a rule by adding a new version, never by editing one,
// so a previously prepared return can always be reproduced.
// All amounts are in rupees. `upTo: null` means "no upper limit".
const OLD_REGIME = {
  label: 'Old regime',
  standardDeduction: 50_000,
  allowsDeductions: true,
  slabs: {
    general: [{ upTo: 250_000, rate: 0 }, { upTo: 500_000, rate: 5 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
    senior: [{ upTo: 300_000, rate: 0 }, { upTo: 500_000, rate: 5 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
    superSenior: [{ upTo: 500_000, rate: 0 }, { upTo: 1_000_000, rate: 20 }, { upTo: null, rate: 30 }],
  },
  rebate: { limit: 500_000, max: 12_500, marginalRelief: false },
};

const COMMON = {
  cessPercent: 4,
  // Surcharge applies above this taxable income and is not modelled; such cases go to an expert.
  surchargeThreshold: 5_000_000,
  deductionCaps: { section80C: 150_000, section80D: { general: 25_000, senior: 50_000 } },
};

const RULESETS = [
  {
    assessmentYear: '2026-27',
    version: '1.0',
    config: {
      meta: { financialYear: '2025-26', source: 'Finance Act 2025 (Budget 2025-26)', verifiedBy: null },
      ...COMMON,
      regimes: {
        new: {
          label: 'New regime',
          standardDeduction: 75_000,
          allowsDeductions: false,
          slabs: [
            { upTo: 400_000, rate: 0 }, { upTo: 800_000, rate: 5 }, { upTo: 1_200_000, rate: 10 },
            { upTo: 1_600_000, rate: 15 }, { upTo: 2_000_000, rate: 20 }, { upTo: 2_400_000, rate: 25 }, { upTo: null, rate: 30 },
          ],
          rebate: { limit: 1_200_000, max: 60_000, marginalRelief: true },
        },
        old: OLD_REGIME,
      },
    },
  },
  {
    assessmentYear: '2025-26',
    version: '1.0',
    config: {
      meta: { financialYear: '2024-25', source: 'Finance (No. 2) Act 2024 (Budget July 2024)', verifiedBy: null },
      ...COMMON,
      regimes: {
        new: {
          label: 'New regime',
          standardDeduction: 75_000,
          allowsDeductions: false,
          slabs: [
            { upTo: 300_000, rate: 0 }, { upTo: 700_000, rate: 5 }, { upTo: 1_000_000, rate: 10 },
            { upTo: 1_200_000, rate: 15 }, { upTo: 1_500_000, rate: 20 }, { upTo: null, rate: 30 },
          ],
          rebate: { limit: 700_000, max: 25_000, marginalRelief: true },
        },
        old: OLD_REGIME,
      },
    },
  },
];

export const ensureRulesets = async () => {
  for (const { assessmentYear, version, config } of RULESETS) {
    await query('INSERT IGNORE INTO tax_rulesets (assessment_year, version, config_json) VALUES (:assessmentYear, :version, :config)', {
      assessmentYear,
      version,
      config: JSON.stringify(config),
    });
  }
};

export const getActiveRuleset = async (assessmentYear) => {
  const row = await queryOne(
    'SELECT id, version, config_json FROM tax_rulesets WHERE assessment_year = :assessmentYear AND is_active = 1 ORDER BY id DESC LIMIT 1',
    { assessmentYear },
  );
  if (!row) return null;
  const config = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
  return { id: row.id, version: row.version, config };
};
