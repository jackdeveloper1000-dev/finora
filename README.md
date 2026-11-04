# Finora — AI-assisted ITR preparation

React (Vite) + Node/Express + MySQL. Built phase by phase from the PRD.

## Run locally

1. Start **MySQL** (and Apache for phpMyAdmin) in XAMPP.
2. Server:
   ```
   cd server
   npm install
   npm run db:init     # creates finora_db from ../schema.sql (safe to re-run)
   npm run dev         # http://localhost:5000
   ```
   Settings live in `server/.env` (see `.env.example`).
3. Client:
   ```
   cd client
   npm install
   npm run dev         # http://localhost:5173 (proxies /api to :5000)
   ```

## Pages

`/` public landing page (signed-in users are redirected to `/dashboard`), `/login`, `/register`, then the app under `/dashboard`,
`/cases/:id/{start,documents,transactions,reconcile,tax,itr}` (wrapped in a guided stepper with readiness score), `/history`, `/notifications` and `/settings` (profile, notification preferences, security, data & privacy). Landing copy lives in `client/src/components/landing/content.js`.

## Structure

```
server/src
  config/       env, db pool, db init
  middleware/   auth, validate, error handling
  modules/      auth | profile | cases | documents | ledger | classification | taxfacts | reconciliation | tax | itr  (routes -> controller -> service, zod schemas)
  utils/        AppError, crypto (AES-256-GCM), asyncHandler
client/src
  api/          axios client (single-flight token refresh), service calls
  components/   ui (reusable), layout, dashboard
  hooks/        useForm, useFetch
  pages/        Login, Register, Dashboard, Profile
  styles/       tokens -> base -> components -> layout
```

## Tax rules

Slabs, rebates and caps are data in `server/src/modules/tax/rulesets.js` (seeded into `tax_rulesets`). A ruleset version is
immutable: change a rule by adding a new version, so stored calculations stay reproducible. `verifiedBy` stays `null`
until a tax professional signs off; the UI shows this on every result.

Supported: resident individuals with salary, interest and dividend income. Everything else is routed to an expert.

## Sample data

`sample-data/` has synthetic statements to try the app (see its README.txt).

## Tests

```
cd server
npm test                   # 77 unit tests: parsers, rules, calculator, validation, security
npm run test:integration   # full taxpayer lifecycle against MySQL (creates and removes its own data)
```

Bank layouts are handled by a header-detecting table parser (`modules/ledger/parsers`). To support a new
format (e.g. PDF), produce a grid of cells and pass it to `parseTable`.

## Security and operations

- **Files are encrypted at rest** (AES-256-GCM, per-file IV) in `server/uploads`; they are only served through 2-minute signed links.
  Files stored before this change are still readable. Back up `DATA_ENCRYPTION_KEY`: without it, uploads and PANs cannot be recovered.
- **Malware scanning:** `SCAN_PROVIDER=clamav` streams every upload to a clamd instance and fails closed if it is unreachable.
  With `none`, only the EICAR test string is caught, which is a wiring check, not protection.
- **Tokens are typed:** login tokens and document links cannot be substituted for one another.
- **Logs** are JSON lines in production (no query strings, tokens or document contents). Every response carries `X-Request-Id`.
- **Health:** `GET /api/health` (liveness) and `GET /api/health/ready` (database + tax rules; use for load balancers).

### Before real use (production checklist)

1. Run behind HTTPS (the server refuses to start in production with a non-https `CLIENT_URL`) and set `NODE_ENV=production`.
2. Use a long random `JWT_SECRET` (32+ chars) and `DATA_ENCRYPTION_KEY` (64 hex), kept in a secrets manager, never in git.
3. Set `SCAN_PROVIDER=clamav` and run clamd; keep `SCAN_FAIL_CLOSED=true`.
4. Use a dedicated least-privilege MySQL user (not root with an empty password) and encrypted, tested backups of the database and `uploads/`.
5. Have a tax professional verify `modules/tax/rulesets.js`, then set `verifiedBy` in a new ruleset version.
6. Run `npm test` and `npm run test:integration`; commission an external penetration test.
7. Review privacy obligations (India's DPDP Act) for PAN, bank and tax data, including retention and deletion.

## Guided filing

`GET /api/cases/:id/filing` returns step completion, a 0–100 readiness score, blocking issues and dashboard insights
(notice risk, deduction gap, advance tax). Scoring is pure and tested in `server/src/modules/filing/insights.js`.

## Account security

Two-factor sign-in (TOTP, RFC 6238 — works with Google/Microsoft Authenticator and similar) with one-time backup codes, password change that
ends other sessions, an active-sessions list, and a full data export / erase flow. A session revoked on purpose is never accepted again;
only a just-rotated refresh token gets a 10-second grace window for double page loads.

## Roadmap

| Phase | Scope | Status |
|-------|-------|--------|
| 1 | Foundation, auth + sessions, taxpayer profile, assessment-year cases, responsive shell | Done |
| 2 | Document vault: validated upload, SHA-256 duplicate block, signed 2-min view links, audit log | Done |
| 3 | Bank statement parsing (CSV/XLSX), normalized ledger, balance / duplicate / overlap / FY checks | Done (PDF & scanned statements pending) |
| 4 | Rule-based transaction classification (confidence + reason), review queue, apply-to-similar | Done (AI suggestions pending an API key) |
| 5 | Tax-document figures (Form 16 / AIS / 26AS) with evidence + reconciliation against the ledger | Done (figures are typed in; PDF/JSON extraction pending) |
| 6 | Eligibility questionnaire, versioned tax rules (AY 2025-26, 2026-27), calculation trace, old/new regime comparison | Done (rules pending tax-expert verification) |
| 7 | ITR-1 field mapping, 4-level validation, review + explicit approval, export package, print view | Done (export is Finora's own format, not the official ITR JSON) |
| 8 | Hardening: encryption at rest, malware-scan hook, typed tokens, structured logs, health checks, end-to-end tests | Done (PDF/AI extraction still open) |

Uploads are written to `server/uploads` (override with `UPLOAD_DIR`, `MAX_UPLOAD_MB`), outside any public path;
files are only served through short-lived signed links. File type is verified from content, not the extension.

Security notes: PAN is AES-256-GCM encrypted; refresh tokens are stored hashed, rotated on use, and reuse revokes
all sessions; repeated failed logins lock the account temporarily.

## Expert review

Customers can ask an expert to check a return from the Return page. Experts work from their own queue at `/expert`.

- Create staff accounts with `npm run user:staff -- expert@example.com "Full Name" expert` (in `server`). It prints a one-time password.
- Experts must turn on two-factor sign-in before they can see any customer data.
- Experts see the masked PAN only. Every view, claim and decision is written to the audit log.
- A customer cannot approve while a review is open. An expert approval is marked out of date if the figures change afterwards.

## Password reset

"Forgot password?" on the sign-in page emails a single-use link that expires in 30 minutes. Using it signs the account out everywhere and clears any lockout. Set `MAIL_TRANSPORT=smtp` with the `SMTP_*` and `MAIL_FROM` values in `server/.env` to send real email. The default, `log`, prints the message to the server console instead (never in production).

## Google sign-in

The sign-in and register pages show "Sign in with Google" when `GOOGLE_CLIENT_ID` is set in `server/.env`. It uses Google ID tokens, verified on the server, so no client secret is needed. A first-time Google user gets an account; the same verified email as an existing account is linked to it. Two-factor sign-in still applies. In Google Cloud Console, add every site origin (for example `http://localhost:5173`) under Authorized JavaScript origins for that client. An origin mismatch can leave Google's button visible but prevent authentication; check the browser console for `The given origin is not allowed for the given client ID.`

## Email and verification

Sending is set in `server/.env` (MAIL_MAILER, MAIL_HOST, MAIL_PORT, MAIL_USERNAME, MAIL_PASSWORD, MAIL_FROM_ADDRESS, MAIL_FROM_NAME, MAIL_ENCRYPTION). Without MAIL_PASSWORD, messages are printed to the server log instead of sent.

New accounts must confirm their email with a 6-digit code (valid 10 minutes, 5 attempts, one resend a minute) before they can sign in. Google sign-in accounts are already verified. A successful password reset returns the user to the sign-in page with a confirmation message.

## Quick file (three steps)

"File taxes" opens `/quick`: 1) your details (name, PAN, date of birth, address, asked once), 2) drop bank statements (CSV or xlsx), 3) review and approve with one tick. After the upload, `POST /api/cases/:id/quick-prepare` reads the statements, confirms confident categories, sets uncertain rows aside (they are never counted as income), answers the eligibility questions from the statements, calculates both regimes and picks the cheaper one. The detailed step-by-step view is still available from the same page. The landing page uses a violet theme scoped to `.lp` in `client/src/styles/landing.css`; the app itself keeps the navy theme.

## File ITR (hand-off)

After approval, **File ITR** (`/cases/:id/file-itr`) guides the user through submitting on the Income Tax e-Filing portal and records the acknowledgement number and date (`filing_submissions` table, return status `filed`). Direct submission is not built: it needs registration as an e-Return Intermediary. See `REQUIREMENTS.md` for the full gap report against the PRD.
