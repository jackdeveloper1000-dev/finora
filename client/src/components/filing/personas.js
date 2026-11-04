// Starting profiles. Each maps onto the eligibility questions, so choosing one pre-answers them.
// `unsupportedReason` profiles cannot be expressed as answers and are explained instead.
const NO = { business_income: 'no', capital_gains: 'no', house_property: 'no', foreign: 'no', director: 'no', agriculture: 'no', losses: 'no' };
const withYes = (...keys) => ({ ...NO, ...Object.fromEntries(keys.map((k) => [k, 'yes'])) });

export const PERSONAS = [
  { key: 'salaried', title: 'Salaried, no other income', text: 'Just salary. No property, capital gains or side income.', form: 'ITR-1', recommended: true, answers: NO },
  { key: 'salaried_hp', title: 'Salaried + house property', text: 'Salary plus one house property, self-occupied or rented out.', form: 'ITR-1', answers: withYes('house_property') },
  { key: 'salaried_cg', title: 'Salaried + capital gains', text: 'You sold Indian shares or mutual funds this year.', form: 'ITR-2', answers: withYes('capital_gains') },
  { key: 'global_rsu', title: 'Global employee, RSU/ESPP', text: 'Foreign RSUs or ESPP, no share sales this year.', form: 'ITR-2', answers: withYes('foreign') },
  { key: 'global_sold', title: 'Global employee, sold shares', text: 'You sold company shares (RSU/ESPP) this year.', form: 'ITR-2', answers: withYes('foreign', 'capital_gains') },
  { key: 'multi_asset', title: 'Multi-asset investor', text: 'Indian and foreign stocks, mutual funds and rental property.', form: 'ITR-2', answers: withYes('foreign', 'capital_gains', 'house_property') },
  { key: 'landlord', title: 'Landlord / multiple properties', text: 'Two or more house properties, or rental income.', form: 'ITR-2', answers: withYes('house_property') },
  { key: 'crypto', title: 'Crypto / virtual digital assets', text: 'Income from crypto or NFTs.', form: 'ITR-2', answers: withYes('capital_gains') },
  { key: 'high_income', title: 'High income (over ₹50 lakh)', text: 'Surcharge and asset disclosure apply.', form: 'ITR-2', unsupportedReason: 'Income above ₹50 lakh attracts surcharge and needs ITR-2. Finora does not support this yet, so a tax professional should handle it.' },
  { key: 'investor', title: 'Investor, no salary', text: 'Capital gains, dividends and interest, no salary.', form: 'ITR-2', answers: withYes('capital_gains') },
  { key: 'senior', title: 'Senior citizen: pension + interest', text: 'Pension, FD and savings interest. Retired, no business income.', form: 'ITR-1', answers: NO },
  { key: 'nri', title: 'Non-resident Indian (NRI)', text: 'Non-resident with Indian income.', form: 'ITR-2', unsupportedReason: 'Non-residents need ITR-2 and different tax rules. Finora supports resident individuals only for now.' },
  { key: 'trader', title: 'F&O / intraday trader', text: 'You traded futures, options or intraday.', form: 'ITR-3', later: true },
  { key: 'freelancer', title: 'Salaried + freelance income', text: 'Salary plus freelance, consulting or professional income.', form: 'ITR-3', later: true },
];

export const DOCUMENT_CHECKLIST = [
  { title: 'Bank statements (CSV or Excel)', text: 'Used to find salary, interest and dividends, and to cross-check your documents.', how: 'Net banking → statements → download for April to March as CSV or Excel.' },
  { title: 'Form 16 (Part A and B)', text: 'Your employer’s salary certificate with the TDS deducted.', how: 'Ask your employer’s payroll or HR team; it is usually issued by mid-June.' },
  { title: 'Annual Information Statement (AIS)', text: 'The tax department’s view of your income: salary, interest, dividends.', how: 'incometax.gov.in → AIS, under the e-File menu.' },
  { title: 'Form 26AS', text: 'TDS credits and advance tax paid in your name.', how: 'incometax.gov.in → View Form 26AS, or the TRACES portal.' },
  { title: 'Investment proofs (80C, 80D)', text: 'Needed only if you claim deductions under the old regime.', how: 'Premium receipts, PPF or NPS passbook and ELSS statements from your insurer or bank.' },
];
