import { BarChart3, BadgeCheck, Calculator, FileSearch, FileText, Landmark, Layers, Lock, Scale, ShieldCheck, Sparkles, TrendingUp, UploadCloud, UserRound, Zap } from 'lucide-react';

export const NAV_LINKS = [
  { href: '#home', label: 'Home' },
  { href: '#how', label: 'How it works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
];

export const RESOURCES = [
  { href: '#security', label: 'Security and privacy' },
  { href: '#how', label: 'How the numbers are worked out' },
  { href: 'https://www.incometax.gov.in/iec/foportal/', label: 'Income Tax e-Filing portal', external: true },
];

export const SOURCES = [
  { icon: Landmark, label: 'Bank statements' },
  { icon: FileText, label: 'Form 16' },
  { icon: Layers, label: 'AIS / 26AS' },
  { icon: BarChart3, label: 'Investments' },
];

export const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Encrypted at rest' },
  { icon: Zap, label: 'Ready in minutes' },
  { icon: Scale, label: 'Built for India' },
];

export const STEPS = [
  { icon: UploadCloud, title: 'Upload documents', text: 'Drop your bank statements. That is the only thing you need to start.' },
  { icon: Sparkles, title: 'Smart analysis', text: 'Finora reads every transaction and sorts it with a clear reason.' },
  { icon: Calculator, title: 'Tax calculation', text: 'Old and new regime compared with Indian tax rules, working shown.' },
  { icon: BadgeCheck, title: 'Ready-to-file ITR', text: 'Review the return, approve with one tick and download it.' },
];

export const FEATURES = [
  { icon: Zap, title: 'Transaction analysis', text: 'Reads and categorises your bank transactions.' },
  { icon: Layers, title: 'Smart reconciliation', text: 'Matches your figures with AIS, 26AS and TDS records.' },
  { icon: TrendingUp, title: 'Income discovery', text: 'Finds salary, interest and dividends automatically.' },
  { icon: Calculator, title: 'Tax comparison', text: 'Picks the regime that costs you less and shows why.' },
  { icon: UserRound, title: 'Easy and guided', text: 'Three short steps. No tax expertise needed.' },
  { icon: Lock, title: 'Privacy and security', text: 'Files and PAN are encrypted. Your data stays yours.' },
];

export const SAMPLE_SUMMARY = [
  { label: 'Total income', value: '₹12,84,500', tone: 'green' },
  { label: 'Salary found', value: '₹11,40,000', tone: 'violet' },
  { label: 'Interest found', value: '₹86,420', tone: 'blue' },
];

export const SAMPLE_INSIGHTS = [
  '3 income sources identified',
  'All major transactions categorised',
  'Both tax regimes compared',
  'Your return is ready to review',
];

export const PLANS = [
  {
    name: 'Self-serve',
    price: '₹0',
    unit: 'free during early access',
    features: ['Upload bank statements', 'Automatic categorisation', 'Old vs new regime comparison', 'Download your return package'],
    cta: 'Start free',
  },
  {
    name: 'Expert-checked',
    price: '₹0',
    unit: 'free during early access',
    badge: 'Most popular',
    highlight: true,
    features: ['Everything in Self-serve', 'A tax expert reviews your return', 'Questions answered in the app', 'Approval only after their review'],
    cta: 'Get a review',
  },
  {
    name: 'E-filing with Finora',
    price: 'Soon',
    unit: 'not available yet',
    features: ['Direct submission to the portal', 'Official ITR JSON', 'Refund tracking'],
    cta: 'Start free',
    muted: true,
  },
];

export const ASSURANCES = [
  { icon: FileSearch, title: 'Every figure has a source', text: 'Each number on the return shows where it came from.' },
  { icon: BadgeCheck, title: 'You approve, always', text: 'Nothing is final until you tick approve, and changes withdraw it.' },
  { icon: Lock, title: 'Encrypted and private', text: 'AES-256 encryption for files and PAN. Download or erase your data any time.' },
];
