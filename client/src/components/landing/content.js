import { BarChart3, BadgeCheck, Calculator, FileText, Landmark, Layers, Lock, Scale, ShieldCheck, Sparkles, TrendingUp, UploadCloud, UserRound, Zap } from 'lucide-react';

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
  { icon: Landmark, label: 'Bank Statements' },
  { icon: FileText, label: 'Form 16' },
  { icon: Layers, label: 'AIS / 26AS' },
  { icon: BarChart3, label: 'Investments' },
];

export const TRUST_POINTS = [
  { icon: ShieldCheck, label: 'Bank-level security' },
  { icon: Zap, label: 'AI-powered analysis' },
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
  { icon: TrendingUp, title: 'Tax optimisation', text: 'Compares tax regimes and suggests the better option.' },
  { icon: UserRound, title: 'Easy and guided filing', text: 'No tax expertise required.' },
  { icon: Lock, title: 'Privacy and security', text: 'Files and PAN are encrypted. Your data stays yours.' },
];

export const SAMPLE_SUMMARY = [
  { label: 'Total income', value: '₹12,84,500', tone: 'green' },
  { label: 'TDS detected', value: '₹1,48,200', tone: 'violet' },
  { label: 'Capital gains', value: '₹86,420', tone: 'blue' },
];

export const SAMPLE_INSIGHTS = [
  '3 income sources identified',
  'All major transactions categorized',
  'Matched with AIS & 26AS',
  'Your return is ready to review',
];

export const PLANS = [
  {
    name: 'Free',
    price: '₹0',
    unit: '',
    features: ['Upload documents', 'Financial analysis', 'Income & tax summary', 'Tax health check'],
    cta: 'Start free',
  },
  {
    name: 'File Your ITR',
    price: '₹499',
    unit: '/ return',
    badge: 'Most popular',
    highlight: true,
    features: ['Everything in Free', 'Complete ITR preparation', 'Tax calculation & reconciliation', 'ITR file ready for submission'],
    cta: 'File my ITR',
  },
  {
    name: 'Expert Review',
    price: '₹999',
    unit: '/ return',
    features: ['Everything in File Your ITR', 'Review by a tax expert (CA)', 'Complex case assistance', 'Final verification & support'],
    cta: 'Get expert review',
  },
];

export const TESTIMONIALS = [
  {
    quote: 'Super easy to use. I just uploaded my bank statements and Form 16, and my ITR was ready within minutes.',
    name: 'Rohit Shah',
    role: 'Salaried Professional',
  },
  {
    quote: 'The AI analysis is impressive. It even identified a few missed investment entries that I had forgotten.',
    name: 'Pooja Mehta',
    role: 'IT Professional',
  },
  {
    quote: 'Finally, a tax platform that actually understands my financial data and explains everything clearly.',
    name: 'Kunal Patel',
    role: 'Freelancer',
  },
];
