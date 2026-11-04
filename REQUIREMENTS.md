# Requirements status

Checked against `AI_Powered_Indian_ITR_Platform_PRD.pdf` (v1.0, 2 Nov 2026) and the two Income Tax Department links. Status as of 4 Nov 2026, localhost build.

**Legend:** Done = built and tested. Partial = works for a narrower case than the PRD asks. Missing = not built.

## 1. MVP acceptance criteria (PRD section 27)

| # | Criterion | Status | Note |
|---|---|---|---|
| 1 | Create a taxpayer profile securely | Done | PAN encrypted, last four shown |
| 2 | Upload multiple bank statements and supporting documents | Partial | Upload accepts PDF, images, XLS; only CSV and XLSX can be read |
| 3 | Process supported bank formats into normalised transactions | Partial | Header-detecting CSV/XLSX parser; no PDF, scanned or password-protected files |
| 4 | Opening/closing balance and date-range checks | Done | Running balance, opening/closing, financial-year range, duplicates |
| 5 | Categories with confidence, user can correct | Done | Rule-based, with a reason per row and a review queue |
| 6 | Preserve source evidence for extracted values | Partial | Each return field names its source; no click-through to the document row |
| 7 | Import and reconcile supported tax documents | Partial | Form 16, AIS and 26AS figures are typed in; nothing is read from the files |
| 8 | Identify major mismatches and ask the user to resolve | Done | Resolve with a note, or escalate |
| 9 | Eligibility from a versioned deterministic ruleset | Done | Seven questions, ITR-1 only |
| 10 | Tax calculated by deterministic code, not an LLM | Done | Rule sets per assessment year |
| 11 | Calculation trace and evidence visible | Done | Step-by-step trace for both regimes |
| 12 | Compare tax regimes | Done | Old vs new, cheaper one recommended |
| 13 | Review-ready ITR representation | Partial | Finora's own JSON, marked `official: false`; not the official ITR-1 schema |
| 14 | Blocking errors prevent finalisation | Done | Four validation levels |
| 15 | Explicit user approval recorded | Done | Fingerprint; withdrawn if figures change |
| 16 | Material changes auditable | Done | `audit_events` |
| 17 | Sensitive documents protected | Done | AES-256-GCM, signed short-lived links, role checks |
| 18 | Route complex cases to an expert | Partial | Expert review works; unsupported cases are told to see a professional but are not auto-routed to a request |

**13 of 18 fully met, 5 partial, none absent.**

## 2. By PRD section

| Area | Status | What exists / what is missing |
|---|---|---|
| 6.1 Account | Done | Email and password, Google, email verification, TOTP two-factor with backup codes, session list, sign out everywhere, lockout, password reset |
| 6.1 Account | Partial | Mobile OTP and SMS login not built; consent is a terms tick-box, not recorded per purpose |
| 6.2 Document vault | Done | Drag and drop with progress, encrypted at rest, signed 2-minute links, statuses, delete, duplicate check, malware-scan hook (off by default) |
| 6.2 Document vault | Missing | Versioned processing results; password-protected files |
| 6.3 Dashboard | Done | Progress, insights (notice risk, deduction gap, advance tax), estimate only after enough data |
| 7 Bank statements | Partial | Own-account transfer matching and unusually-large-credit prompts not built |
| 8 AI extraction | Missing | No OCR and no AI model: classification is rules only. No model governance, no kill switch. The Anthropic key is stored but unused |
| 9 Ledger and reconciliation | Partial | Salary, TDS and interest rules. Dividend, capital-gain and challan rules not built |
| 10 Tax documents | Missing | Reading Form 16, AIS/TIS, 26AS, interest and dividend certificates |
| 11 Eligibility | Done | Versioned, explains why each question is asked |
| 12 Tax engine | Done | AY 2025-26 and 2026-27, slabs, 87A rebate and marginal relief, 80C and 80D caps, cess, rounding, trace |
| 12 Tax engine | Partial | Rules are not yet verified by a tax professional (shown in the app). No house property or capital gains |
| 13 Questionnaire | Partial | Eligibility questions only; no engine that generates questions from missing or conflicting evidence |
| 14 Review workspace | Partial | Home, Documents, Analysis, Tax summary, ITR, validation, approval. Missing: evidence click-through, investments, deductions and tax-credit screens |
| 15 ITR generation | Done | Mapping, four validation levels, blocking errors, approval |
| 16 Filing | Partial | Provider boundary and a manual hand-off built (see section 3). Direct submission missing |
| 17 Architecture | Differs | Node, React and MySQL instead of Laravel, Next.js and PostgreSQL. No queue (processing is synchronous), local disk instead of object storage, no OpenAPI file, no CI/CD, no tracing |
| 18 Database | Partial | Missing tables: document pages, extraction runs, bank accounts, tax documents, payments |
| 19 API | Partial | Consistent error envelope, request ids, pagination, rate limits on auth and general. Missing: idempotency keys, OpenAPI, billing endpoints |
| 20 Security | Done | HTTPS, encryption, signed links, roles, two-factor for experts, audit log, upload validation, headers, rate limits |
| 20 Security | Missing | Secrets manager, tested backups, database encryption at rest, SAST/DAST and penetration test, data retention policy |
| 21 Admin console | Missing | Only a command to create staff accounts |
| 22 Expert workflow | Done | Request, pick up, chat, approve or ask for changes, two-factor required, audit |
| 22 Expert workflow | Missing | Expert edits with before/after values, SLA tracking, assignment rules, payment |
| 23 Payments | Missing | No billing. The landing page says "free during early access" |
| 24 Notifications | Partial | In-app bell and email for codes and resets. No SMS or WhatsApp, no deadline or mismatch alerts |
| 25 Non-functional | Partial | Responsive and keyboard friendly; English only; no load or availability targets measured |
| 26 Testing | Partial | 94 unit and 49 integration tests, browser-checked flows. Missing: property-based tests, load tests, scanned-document corpus, tax-expert UAT |

## 3. Filing (the "File ITR" option)

**Built now:** a provider boundary (`server/src/modules/filing/providers.js`) and a manual hand-off.

1. The return is prepared and approved in Finora.
2. **File ITR** opens a four-step page: keep your figures, open the e-Filing portal, submit and e-verify there, then record the acknowledgement number and date.
3. The return becomes **Filed**, the acknowledgement is stored, and the event is audited.

**Why not direct submission.** The Income Tax Department's API page lists seven specifications, all for e-Return Intermediaries (ERIs): Login, Add Client, Prefill, Validate and Submit ITR, e-Verify Return, Acknowledgement, and the overall ERI specification. Taxpayer consent is required to add a client, and it lists no sandbox or onboarding steps. Direct filing therefore needs Finora to be registered as an ERI first.

## 4. PAN Verification specification (the PDF you linked)

- **What it is:** a SOAP service (service id 10001) that checks PAN, full name and date of birth against the e-Filing database. It answers Y or N for each field.
- **Who can call it:** registered "External Agencies" only. They must register on the e-Filing portal and be approved by the portal admin.
- **What it needs:**
  - a client id and client secret from the API gateway;
  - a user id and password in a WS-Security UsernameToken;
  - a request signed with a registered digital signature certificate;
  - encryption with the e-Filing public key.
- **Endpoints:** a UAT address (`uatservices.incometax.gov.in`) and a production address (`services.incometax.gov.in`).
- **Errors it returns:** duplicate request id, invalid signature, empty PAN, PAN not in correct format, PAN does not exist, PAN inactive, and similar.
- **What Finora does today:** checks the PAN format and the holder-type letter (4th character) locally.
- **To use the real service:** register as an External Agency, obtain a certificate and credentials, then add a verifier next to the existing format check. Do not start before registration is approved.

## 5. Suggested order for what remains

1. Read Form 16 and AIS/26AS files (biggest gain in manual entry removed).
2. PDF and scanned statements with OCR.
3. Evidence click-through from each figure to the source row.
4. Official ITR-1 JSON export (needs the current schema from the Department).
5. Tax-professional verification of the rule sets.
6. Admin console, backups, CI and deployment hardening.
7. ERI registration, if direct filing is wanted.
