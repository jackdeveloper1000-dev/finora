# Finora authentication and filing-flow tasks

## Goal

Improve Finora's sign-in and registration experience using the public MuTax sign-in page as a high-level UX reference, then make the first signed-in steps clear and consistent. Keep Finora's own branding, copy, and implementation; do not copy MuTax assets or exact page content.

## Reference review

- Reference pages reviewed: `https://mutax.ai/signin`, its create-account view, and the authenticated dashboard and filing entry flow.
- The user authenticated the reference session. The assistant did not enter or store the supplied credentials.
- Reference sign-in view includes a sign-in/create-account switcher, email and password fields, forgot-password link, Google sign-in CTA, trust/security cues, and a clear primary action.
- Reference registration view includes full name, email, password and confirmation, Google sign-up, terms/privacy consent, and a clear return-to-sign-in action.
- Finora already has separate sign-in and registration routes, Google identity buttons, email/password fields, forgot-password access, and cross-links between the forms. The work should refine and verify these rather than add duplicate auth mechanisms.
- The authenticated reference dashboard groups notice risk, filing progress, deduction gap, advance tax, RSU vestings, and regulatory updates under Smart insights. It also exposes a clear Start filing action and a regime-comparison action.
- The reference filing entry flow offers Smart Detect, Manual Start, and CA Assisted paths. Finora should keep its own document-first and profile-based paths, only adopting the clarity of offering explicit starting choices.
- The reference's dashboard, filing entry, regime comparison, history, and settings pages showed no page-level horizontal overflow at 375 px, 768 px, or 1440 px in this pass.
- Do not copy reference branding, exact copy, or product features that Finora does not support. Use the reference only for high-level UX patterns.

## Tasks

### P1 — Sign-in and registration UI

- [x] Align Finora's sign-in and registration pages into a consistent, responsive auth experience inspired by the reference's clear form hierarchy and account-mode switcher, while retaining Finora branding and its own copy.
- [x] Keep Google sign-in and sign-up visible and visually consistent with the primary email/password flow.
- [ ] Verify Google authentication completes the correct sign-in or registration flow, reports provider/network errors clearly, and never leaves the user in a false success state.
- [x] Add password confirmation to registration and show the password requirements before submission.
- [ ] Review whether registration should require explicit terms/privacy consent; if required, add accessible consent controls and links to Finora's own policies.
- [x] Preserve the forgot-password flow and make sign-in/register mode changes, validation messages, and focus states usable with keyboard and assistive technology.
- [x] Check the sign-in and registration layouts at 375 px, 768 px, and 1440 px, including long validation errors and the Google button's small-screen width.

### P1 — First signed-in experience

- [x] Make the dashboard's filing progress, blocker count, and status messages use a single consistent source of truth. Current display showed 67% on the case card versus 70% in Smart insights, one blocking issue versus 0 to review, and a "figures line up" insight at the same time.
- [x] Make the next action after sign-in unambiguous: show the blocking issue and provide a direct route to resolve it before approval.
- [x] Keep the dashboard's useful summary cards (progress, unresolved issues, tax estimate, and upcoming actions) scannable, with clear actions to resume filing and compare regimes where applicable.
- [ ] When showing smart insights, ensure each card is relevant to Finora's supported tax scope and is backed by the case data. Do not display unsupported RSU/regulatory modules or contradictory risk and reconciliation summaries.
- [ ] Review the dashboard-to-filing journey (`/dashboard` → `/cases/:id/start` → documents/review/reconciliation/tax/return) so that "Continue filing" consistently resumes the relevant next step.
- [ ] Preserve clear entry choices for document-first setup versus profile/questionnaire setup, with concise explanations of what each path does and the ability to switch without losing saved work.
- [ ] Verify first-time and returning-user behavior, including the empty/new case, an in-progress case, and an account with multiple assessment years.
- [ ] Keep the scope of supported return types, tax estimates, and official filing limitations clear in the dashboard and return journey.

### P1 — Responsive issue from testing

- [ ] Fix and verify the horizontal overflow on the Transactions page at phone and tablet widths. Latest measured page-level overflow was 79 px at 375 px and 68 px at 768 px; desktop at 1440 px had no overflow.
- [ ] Recheck the Transactions table, long source-document names, and monetary summary values after the fix; allow table-local scrolling or responsive reflow without making the whole page scroll sideways.

### P2 — End-to-end verification

- [ ] Test email/password sign-in, invalid credentials, registration validation, duplicate-account handling, forgot password, Google auth success/failure, and MFA/step-up authentication.
- [ ] Verify unauthenticated visitors can access public landing/auth pages, protected routes return to the intended destination after sign-in, and sign-out clears access.
- [ ] Run responsive smoke checks at 375 px, 768 px, and 1440 px for the public auth pages and the signed-in dashboard and filing flow.
- [ ] Confirm no test credentials, tokens, or personal tax data are written to this task file, logs, or screenshots.

## Test notes

- The MuTax sign-in and create-account screens and an already-authenticated dashboard were inspected. No reference account credentials or private tax figures were added to this file.
- Finora's current sign-in page already shows a Google button, email/mobile and password fields, a forgot-password link, and a registration link. Its registration page already shows Google sign-up, name, email, optional mobile, and password fields.
- Shared sign-in/register mode navigation was added, registration now validates password confirmation without sending that field to the API, Google provider failures are surfaced, and Google initialization is reused across auth routes.
- Dashboard filing progress now uses the same case readiness percentage as the case card, distinguishes validation blockers from transactions awaiting review, offers a direct continuation action and regime comparison, and surfaces insight load errors.
- Transaction summary cards now use responsive columns and allow long currency values to wrap inside the card; browser verification is still pending.
- Login/register were checked at 375 px, 768 px, and 1440 px with no page overflow. A mismatched registration confirmation was rejected without submitting.
- Login/register placeholders now include password guidance and use a more legible color; the Google button expands to the available form width and adjusts on resize.
- A fresh browser check confirmed visible placeholders and no overflow on login/register at 375 px, 768 px, and 1440 px. Google renders at up to 400 px wide; authentication remains blocked until the active site origin is authorized in the Google OAuth client.
- The signed-in Finora dashboard, start flow, history, settings, notifications, documents, transactions, reconciliation, tax, and return pages were previously smoke-tested at 375 px, 768 px, and 1440 px.
- The dashboard and Transactions responsive changes could not be rechecked in the browser because the Finora session was signed out and protected routes redirected to login. Use a valid authorized session for that verification.
- The authenticated reference dashboard, filing entry, regime comparison, history, and settings pages were smoke-checked at 375 px, 768 px, and 1440 px; none showed page-level horizontal overflow.
- A fresh authenticated check can be gated by Finora's MFA. Use an authorized Finora account/session and a valid MFA code for future end-to-end testing; do not bypass MFA.
