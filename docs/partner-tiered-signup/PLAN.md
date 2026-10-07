# Plan – Mizaniya Pay tiered Partner signup (frontend + mock data)

Story: ClickUp 869fcne3g. Replaces 869bucgp9, builds on 869bbzntr, fixes 869e4xg74.
**Status: implemented (phases 1–6) on the mock backend. The sections below are the original plan; read "Build notes" first for what changed.**

## Build notes (what differs from the plan above)

Approved scope: frontend only + mock data, Tailwind + shadcn, Vite/React/TS, react-router-dom, react-hook-form + zod, i18next, vitest + Testing Library.

- **shadcn**: the CLI could not reach `ui.shadcn.com` from the build environment (egress policy), so the components in `src/components/ui` are written by hand in shadcn's style (Radix + `cva` + `tailwind-merge`, `components.json` present). Native `<select>` is used instead of Radix Select (58 wilayas, mobile). If you want the upstream files, run `npx shadcn add …` locally and diff.
- **Tailwind v4** with brand tokens in `src/index.css` (`@theme`), mapped to shadcn's semantic variables.
- **Enterprise step**: the story lists an "Enterprise-only section" inside business details *and* an "Enterprise documents" step for routed Companies. They are the same thing here: a separate `enterpriseDocs` step before Review, used both when Enterprise is picked on step 1 and when a Company is routed by volume. Enterprise therefore has 6 steps.
- **Manager ID**: the Company proof list names "manager ID". It is required only when the legal representative is *not* the registered manager (together with the delegation); otherwise the representative's own ID covers it.
- **Settlement holder mismatch**: warning for AE/trader; **blocking** for Company/Enterprise (the story says they *must* use the company's account). Configurable per type (`holderMismatch`).
- **Uploads before the account exists**: step 2 holds uploads and the account is created on Continue, so the mock accepts uploads without a session. A real backend needs a pre-signup upload token.
- **OTP flags are decided by the server**: the mock recomputes `emailVerified/phoneVerified` and ignores what the client sends (kept only for an unchanged, previously verified value).
- **Resubmit**: only flagged items may change. If the rejection has no flagged fields, edits are unrestricted.
- **Upgrade**: modelled as a second draft on an APPROVED account (`partner.upgrade`) with its own PENDING/REJECTED state and its own admin row. Approving swaps the type, limits and KYC level; live keys are untouched. After starting an upgrade the partner lands on `firstIncompleteStep` (e.g. AE → Company also asks for the role, which AEs never entered).
- **Declared-volume update** (needed by "ask the partner to update their declared volume"): new `updateDeclaredVolume`. It never changes limits; a band that would turn a Company into an Enterprise is refused ("start an upgrade").
- **Limits, thresholds, bands, reasons, AML questions** are placeholders (see `tbd.ts`, `reasons.ts`). AE annual cap (5,000,000 DZD) is the only real number.
- **Fonts**: Google Fonts `<link>` (no answer was given on self-hosting).
- **Dev tools**: `?dev=1` QA panel and a test outbox on `/status`; not product features.
- **Not built**: real e-mail, auth for the admin, real file preview (mock shows metadata), per-transaction enforcement of limits and of the AE category rule (UI only shows/checks them), `AE_ALLOW_PHYSICAL_GOODS_ONLINE` enforcement (notice only).
- **Verification**: 230+ automated tests (unit, API, UI flows, contrast). The four signup flows, the Arabic RTL layout and the 390 px layout were also checked in a real browser with a throwaway Playwright script kept outside the repo.
- **Known rough edges**: about 18 non-blocking oxlint warnings (state set in effects, fast-refresh export rule), a single ~500 kB JS chunk (no route splitting yet), Arabic copy is a first pass.

## 1. What exists today

Nothing. The repo `ZakariaBrahimi/Partner-singup` has no commits, no branches, no `docs/design/partner-signup/*.dc.html` mockups, no backend, no i18n, no tests. There is no existing Step 1 / Step 2 form, merchant/KYB model, upload/OTP/API-key/notification service, or admin list to reuse.

So "reuse existing conventions" is replaced by "establish conventions that a real backend and the existing apps can adopt". Scope you set: **frontend only, mock data, so the flow can be tested end to end**.

## 2. Scope

In (frontend, runs in the browser against a mock API):
- Partner portal: step 1 → 5, helper, no-legal-status dead end, change-type popup, application status (timeline, rejection, fix & resubmit, approval, Enterprise contract pending), draft/resume, AE cap banner, upgrade start, volume-above-band notice.
- Admin screens: submissions list (KYC L2/L3 + Partner type filter + incomplete drafts), detail with type-specific checklist, document preview popup, approve / reject (mandatory reason) / mark contract signed, audit log view.
- Config-driven partner-type schema, shared validators, i18n (FR/AR/EN, RTL), design tokens.
- A mock API that mirrors the endpoint contract in §5, persisted in `localStorage`, with built-in scenario triggers for testing.

Out (listed in §9 as backend/other-team handoff): real persistence, OTP delivery, file storage, API keys, email, audit storage, cron jobs (AE cap, volume checks), limits enforcement at transaction time, auth. Also out per story: NGOs, public institutions, foreign companies, e-signature.

## 3. Stack (needs your OK – you said no new libraries without asking)

| Concern | Choice | Why |
|---|---|---|
| Build / lang | Vite + React 18 + TypeScript (strict) | Standard, fast, no SSR needed for a portal |
| Routing | `react-router-dom` | Steps, status, admin as routes |
| Forms | `react-hook-form` | Per-field blur validation, `aria-*` wiring |
| Schema/validation | `zod` + `@hookform/resolvers` | Same schema shared with the future server |
| i18n | `i18next` + `react-i18next` | FR/AR/EN, `dir` switching for RTL |
| Tests | `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom` | Unit + flow tests |
| Styling | Plain CSS with CSS variables (tokens from the brief) | "Custom look, no design system" |
| Fonts | Plus Jakarta Sans, IBM Plex Mono via Google Fonts `<link>` | No extra package; swap to self-hosted later if offline is needed |
| Mocking | Hand-written in-memory/localStorage API (no MSW) | Fewer deps; same function signatures as the real client |

Everything else (stepper, upload tile, OTP input, strength meter, combobox, modal, toast-free inline errors) is built in-repo. If you'd rather avoid any of the libraries above (e.g. hand-rolled validation instead of RHF/zod), say so and I'll adapt.

## 4. Folder layout (single app, shared code isolated so it can be extracted)

```
docs/partner-tiered-signup/{PLAN.md,QA.md}
src/
  shared/                     # no React, no DOM: movable to a shared package later
    config/
      partnerTypes.ts         # THE configuration (see §6)
      tbd.ts                  # every TBD value, one place
      reasons.ts              # rejection reason codes
    validators/               # format rules, one module
    schema/                   # zod schemas generated from partnerTypes config
    flow/                     # resolveSteps(type, answers), status transitions
    types.ts                  # PartnerType, MerchantStatus, KybStatus, OnboardingState…
  api/
    client.ts                 # interface + functions used by the UI (§5)
    mock/                     # handlers, seed data, scenario triggers, latency/failure sim
  i18n/{fr,ar,en}.json, index.ts
  styles/{tokens.css,base.css}
  components/                 # Stepper, StepLayout, TypeCard, UploadTile, OtpField,
                              # PasswordMeter, Field, ErrorSummary, ActivityCombobox,
                              # OwnersList, Modal, Banner, Timeline, StatusBadge
  portal/                     # pages: Start, Helper, NoLegalStatus, steps, Review, Status
  admin/                      # pages: List, Detail, DocPreview, AuditLog
  main.tsx, routes.tsx
tests/                        # unit + flow tests
```

## 5. "Endpoints" (mock API contract; same shape the real backend should expose)

All async, all return `{ ok: true, data } | { ok: false, fieldErrors?, error }`.

- `createAccount({email,phone,password})` + `sendOtp / verifyOtp({channel,value,code})` → account in `DRAFT`, sandbox keys. Mock OTP is `123456`; `000000` fails.
- `getDraft()` / `saveStep(stepId, data)` → persists `lastCompletedStep`.
- `validateField({field,value})` → `{valid, code, message}`; checks format via the shared validators, then duplicates against seeded partners.
- `uploadDocument(file, docType)` → progress events, then `{id, name, size, status}`. Enforces JPG/PNG/PDF ≤ 5 MB. Mock failure trigger: filename containing `fail`.
- `submit()` → merchant `PENDING_APPROVAL`, KYB `PENDING`; server re-validates the whole schema (same zod) and returns field errors keyed by field.
- `getPartnerStatus()` → timeline, rejection `{code,text,flaggedFields[]}`, KYC level, limits, keys, contract state.
- `resubmit(changes)` → only flagged items editable; others kept.
- `startUpgrade(toType)` → pre-filled draft of the new type; current account unchanged.
- `searchAnaeActivities(q)` → code/name search over seed.
- Admin: `listSubmissions({level,type,state})`, `getSubmission(id)`, `approve(id)`, `reject(id,{code,text,flaggedFields})`, `markContractSigned(id)`, `listAudit(id)`.
- Mock "time-travel" helpers on a dev panel (`?dev=1`): set AE annual volume (80% / 100%), set monthly volume above band, impersonate each partner state.

Duplicate triggers in mock seed (documented in QA.md): e.g. an RC, NIF, NIS, NIN, AE number, email, phone, RIB, CCP that already exist, so each duplicate error is testable.

## 6. Data model & configuration (TypeScript types + config, no DB)

Types mirror the story: `PartnerType`, `MerchantStatus` (`DRAFT` added in front of `PENDING_APPROVAL | APPROVED | REJECTED`), `KybStatus`, `kycLevel`, `lastCompletedStep`, `volumeBand`, `avgTicket`, `settlement {type,number,holderName}`, AE (`anaeCardNumber`, `anaeActivityCode`), trader `registrationType RC|RAM`, company (`nis`, `legalForm`, `beneficialOwners[]`), enterprise (`contractSignedAt/By`, AML answers + status, technical contact, collects-for-sub-merchants), `rejection {code,text,flaggedFields[]}`, AE annual volume + review flags.

`partnerTypes.ts` is one entry per type containing: label/description i18n keys, `steps` (ids from a shared step registry, plus type-specific step ids), `fields` per step (with validators, conditional visibility rules such as role hidden for AE/trader, `.com.dz` when channel includes online), `documents` (required/optional, accepted formats), `allowedProducts`, `kycLevel`, `limitKeys`, `reviewChecklist` items, `upgradeTargets`. The flow code only reads this config: stepper, step renderer, review summary, server-side (mock) validation, and admin checklist are all generated from it. **Adding a type = adding one config entry (+ i18n strings).** A test proves this by registering a fake type at runtime and walking it through the flow.

Enterprise routing is a rule in the flow module (`declaredBand > ENTERPRISE_VOLUME_THRESHOLD` on a COMPANY inserts the `enterpriseDocs` step before Review).

### TBD values (all in `src/shared/config/tbd.ts`, each with `// TODO(compliance): <question>`)
`ENTERPRISE_VOLUME_THRESHOLD`, `BENEFICIAL_OWNER_THRESHOLD_PCT`, `VOLUME_BANDS`, `LIMITS` (per type/band: per-transaction, monthly, payout), `AE_ANNUAL_CAP_DZD` (5,000,000, a legal value, not TBD), `AE_CAP_BEHAVIOUR = 'FLAG'`, `AE_ALLOW_PHYSICAL_GOODS_ONLINE = false`, `ANAE_VERIFICATION = 'MANUAL'`, `BA_INSTRUCTION_06_2025_CEILINGS_APPLY = undefined`, `EXPECTED_REVIEW_TIME` (placeholder text for the confirmation screen). Placeholders are obviously fake (e.g. `1_000_000_000` thresholds named `PLACEHOLDER_…`) so they can't be mistaken for decisions. The 7 open questions are tracked in this file, not decided.

### Validators (one module)
Format rules for RC, NIF, NIS, NIN, AE card, email, phone (+213), RIB, CCP, website `.com.dz`. Since no backend rules exist to reuse, **every identifier format except email/phone/`.com.dz` is a placeholder** (`// TODO(compliance): confirm format`), loose and clearly labelled, not an invented official rule. NIN is commonly 18 digits and RIB 20 digits in Algeria, but I will not hard-code those as fact; I'll flag them in the TODO for you to confirm.

### ANAE seed
`src/api/mock/seed/anaeActivities.ts`: a file you fill in, with a few placeholder rows (code, FR/AR labels, allowed payment categories).

## 7. Screens & components

Portal (desktop-first, stacks at phone width; 300px navy sidebar, 760px main column, tokens/fonts/sizes exactly as in your brief):
1. **Partner type**: 4 cards (yellow ring + "Selected" badge, "Continue as {type}"), Help me choose, No registered business yet?, Already a partner? Log in.
2. **Helper**: up to 3 yes/no, preselects type; all "no" → **No legal status** dead end (customer-app link, anae.dz info; no way forward).
3. **Account & legal rep** (shared): OTP email/phone, password meter, role (hidden for AE/trader), ID type toggle + front/back uploads, NIN, selfie (camera via `getUserMedia`, with file-picker fallback).
4. **3a / 3b business details**: AE (ANAE number, activity combobox chip, "what you can accept", 5M cap notice, physical-goods notice with link to step 1) / Trader (RC|RAM toggle, NIF) / Company & Enterprise (legal form, RC, NIF, NIS, statuts PDF, beneficial owners list with verified/missing badges, delegation upload when rep ≠ manager, Enterprise section with AML status, technical contact, sub-merchants question).
5. **Settlement & volume**: Bank/CCP, holder-name mismatch warning (stricter for company types), band + average ticket, live Enterprise-routing note.
6. **Review & submit**: per-step summary with Edit, document list with status, declarations checkbox, confirmation screen.
7. **Application status**: timeline, rejection reason + highlighted flagged fields/docs, "Fix and resubmit" (only flagged items open), approval view (keys, KYC level, limits), Enterprise "Contract signature pending", AE 80%/100% banners with Upgrade CTA, volume-above-band banner, upgrade flow.
8. **Change type popup**: keeps shared-step data, resets only type-specific fields.

Cross-cutting: every action shows trigger → loading → success/fail; errors inline under the field via `aria-invalid` + `aria-describedby`, plus an error summary at the top of the step linking to each field (this is the 869e4xg74 fix); no generic error toasts anywhere. 48px inputs, 52px buttons, ≥44px touch targets, 3px navy focus outline, 4.5:1 contrast, all copy via i18n (FR/AR/EN, `dir="rtl"` for AR). Draft auto-saves after each step; reload resumes at the last completed step.

Admin: list (tabs KYC L2 / L3 / Incomplete drafts, Partner-type filter, shows last completed step for drafts), detail (type-specific checklist, document preview modal, declared band, AE activity code, volume/cap flags), approve, reject (reason code + text mandatory, flagged fields optional), mark contract signed (go-live blocked until done), audit trail.

## 8. Phases (one commit each, with tests; revised for frontend-only)

1. **Foundation**: Vite/TS/test setup, tokens + fonts, i18n scaffold, shared types, `partnerTypes` config, `tbd.ts`, validators, zod schema generation, flow resolver, ANAE seed. Tests: validators, schema per type, step resolution, "add a type with config only".
2. **Mock API**: all endpoints in §5, localStorage persistence, status transitions, duplicate seeds, scenario triggers. Tests: status transitions, validate-field, submit re-validation, resubmit only-flagged.
3. **Portal**: step 1, helper, dead end, steps 2–5, status screen, draft/resume, change-type popup. Component tests for the a11y wiring.
4. **Admin UI**: list/filters, type checklists, approve/reject/contract signed, audit.
5. **Post-approval behaviour in the UI**: limits display, AE cap banners (80/100%, FLAG/BLOCK config), activity restriction demo, upgrade path, volume-band flag (driven by the dev panel).
6. **Tests & QA**: end-to-end flow tests per type (signup → approve / reject → resubmit), `QA.md` checklist including the mock triggers.

## 9. Risks

- **Empty repo / no design source**: Figma and `.dc.html` mockups are unavailable (Figma connector failed to connect), so visuals follow your token table and layout description only. If mockups exist, please add `docs/design/partner-signup/` and I'll align.
- **Format rules are placeholders**: RC/NIF/NIS/NIN/AE/RIB/CCP formats aren't defined anywhere I can see; mock validation is lenient on purpose.
- **A mock can't prove server behaviour**: the "server re-validates on save/submit" requirement is simulated by running the same shared zod schema inside the mock; the real guarantee must be implemented in the backend.
- **Selfie camera** needs HTTPS/localhost and permission; the file-picker fallback keeps it testable.
- **RTL/Arabic copy**: I'll write FR/EN strings; AR strings will be a first-pass machine-quality translation needing native review. Legal/compliance wording especially.
- **localStorage as DB** means the "admin" and "partner" views share one browser profile; the dev panel handles switching.
- **Compliance wording** (AE cap, `.com.dz`, AML) is quoted from the story, not legally reviewed.

## 10. Handoff list (lives outside this repo / not built here)

Added while building (contracts the real backend must honour; `src/api/types.ts` is the interface, `src/api/mock/api.ts` is the executable spec):
- Recompute OTP-verified flags server-side; refuse `createAccount`/`saveStep(account)` for unverified contacts.
- Re-run the shared schema + duplicate checks on save, submit and resubmit; field errors keyed `field` (save) or `step.field` (submit/resubmit); duplicate code `duplicate.<field>`.
- Resubmit may change only flagged `step.field` items.
- Upgrade drafts, upgrade approval/rejection and their admin rows; volume updates must go to admin re-review before limits change.
- Enterprise: approve keeps the live key inactive until "contract signed".
- Notification templates: submitted, approved, rejected (with reason), contract signed, AE 80 %, AE 100 %, volume above band, upgrade approved.
- AE category restriction must be enforced where payment links/invoices are created.
- Admin identity for the audit log (the mock uses a fixed actor).

- Real backend: merchant/KYB models and migrations (`DRAFT`, new fields), draft/save, submit/resubmit, status, ANAE search, duplicate checks against real partners, server-side schema validation (share `src/shared/` or port it).
- Account creation with real OTP (email/SMS) and sandbox/live API-key issuance and activation (and whether the platform has sandbox environments at all: unknown, flag for backend team).
- File upload/storage service, virus scan, retention.
- Email/notification templates: approval, rejection with reason, AE 80% warning, volume-above-band.
- Audit logging in the existing admin pattern; admin RBAC ("KYB review rights").
- Limit enforcement at transaction time; AE annual-volume accumulation job; monthly volume vs band check; AE cap FLAG/BLOCK enforcement; payment-category restriction on links/invoices.
- Compliance/Risk answers to the 7 open questions and all TBD values.
- ANAE verification (manual by default).
- Enterprise contract process (manual; admin only marks signed).

## 11. Decisions I need from you

1. Approve the stack in §3 (or name changes).
2. Confirm frontend-only scope includes the **Admin UI** (assumed yes, with mock data).
3. Should the language default be FR, with AR/EN switchable? (assumed yes)
4. Fonts via Google Fonts `<link>` OK, or self-host?
