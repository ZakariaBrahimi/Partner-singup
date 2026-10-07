# QA checklist – tiered Partner signup (frontend + mock API)

Everything below runs against the **mock backend** (data lives in the browser's `localStorage`).
Story: ClickUp 869fcne3g. Plan and deviations: `PLAN.md`.

## Setup

```
npm install
npm run dev          # http://localhost:5173
npm test             # automated suite (unit, API, UI flows)
```

- Portal: `/signup` (signup), `/login`, `/status`. Admin: `/admin` (no login in the mock).
- Open any page with `?dev=1` to get the **QA tools** button (bottom corner): simulate AE annual turnover (0 / 79 / 80 / 100 %), monthly volume above/within the declared band, and reset all mock data. `?dev=0` hides it.
- Language switcher (FR / AR / EN) is in the sidebar (portal) and header (admin). Arabic switches the page to RTL.
- To start over: QA tools → *Reset all mock data*.

## Mock triggers

| What | How |
|---|---|
| OTP code (email and phone) | `123456`. Anything else shows "This code is not correct" |
| Upload failure | Upload a file whose name contains `fail` (e.g. `fail.jpg`) |
| Upload too big / wrong type | A file over 5 MB, or anything that is not JPG/PNG/PDF (shown before upload) |
| Camera | Selfie tile has "Take a selfie" (camera) and "Choose file". Without camera access the dialog falls back to the file picker |
| Latency | ~350 ms per call, ~160 ms per upload step, so loading states are visible |

### Values that are already registered (duplicate errors)

| Field | Type this value | Expected inline error |
|---|---|---|
| Email | `taken@mizaniya.dz` | This email is already registered. |
| Phone | `550000001` (also `0550 00 00 01`) | This phone number is already registered. |
| NIN | `100000000000000001` | This NIN is already registered. |
| RC | `RC-DEMO-0001` (any spacing/case) | This RC is already registered. |
| NIF | `NIF-DEMO-0001` | This NIF is already registered. |
| NIS | `NIS-DEMO-0001` | This NIS is already registered. |
| ANAE card | `AE-DEMO-0001` | This ANAE card is already registered. |
| RIB | `00799999000000000001` | This RIB is already registered. |
| CCP | `00000001` | This CCP is already registered. |

The error must appear **under the field on blur**, with a red 2px border + icon, and be repeated in the error summary on Continue. There must be no toast anywhere.

## Demo accounts (password `Demo1234!`, also listed on `/login`)

| Email | State |
|---|---|
| `ae.demo@mizaniya.dz` | AE, approved (annual turnover 1,000,000 DZD) |
| `company.approved@mizaniya.dz` | Company, approved, declared band B2 |
| `enterprise.approved@mizaniya.dz` | Enterprise, approved, **contract signature pending**, live key inactive |
| `trader.rejected@mizaniya.dz` | Individual trader, **rejected** (flags: RC photo, selfie) |
| `trader.pending@mizaniya.dz` | Individual trader, pending review (online, `.com.dz` site) |
| `ae.draft@mizaniya.dz` | AE draft, last completed step: Account → login resumes at step 3 |
| `company.draft@mizaniya.dz` | Company draft (admin "incomplete signups") |
| `taken@mizaniya.dz` | Company, pending review (admin: review / approve / reject) |
| `enterprise.pending@mizaniya.dz` | Enterprise, pending review (admin, KYC Level 3) |

## 1 · Partner type selection (step 1)

- [ ] Four cards: Auto-entrepreneur, Individual trader or artisan, Company, Enterprise. Each has a one-line description, "You'll need: …" and product chips.
- [ ] Selecting a card: yellow ring + "Selected" badge. Continue reads "Continue as {type}". Continue is disabled until a card is selected.
- [ ] Keyboard: arrow keys move between cards, Space/Enter select.
- [ ] Stepper and "Step N of M" follow the type: 5 steps for AE / trader / company, 6 for Enterprise (extra "Enterprise documents").
- [ ] Links: Help me choose · No registered business yet? · Already a partner? Log in.
- [ ] Sidebar footer: "Your progress is saved after every step."

### Help me choose
- [ ] RC = Yes → back on step 1 with Individual trader preselected + notice; can pick another type.
- [ ] RC no, RAM yes → Individual trader. RC no, RAM no, ANAE yes → Auto-entrepreneur.
- [ ] No / No / No → "A legal status is required". Links: Mizaniya Pay app, anae.dz (new tab). **No Continue button**, no route to the signup (try `/signup/business` directly: it redirects to step 1).

### Changing type mid-signup
- [ ] After step 2, go back to step 1, pick another type, Continue → confirmation popup with the number of values that will be reset.
- [ ] Cancel keeps the old type. Confirm keeps account, identity and settlement data; type-specific fields are reset (business step is empty of old-type fields; same-named fields like address/activity are kept).

## 2 · Account & legal representative
- [ ] Email and phone each need Send code → 6-digit code → Verified. Wrong code shows an inline error. Editing a verified value un-verifies it.
- [ ] Phone shows a fixed +213 prefix. Password shows a strength meter (4 levels) and a show/hide toggle.
- [ ] Continue with a missing/unverified item: error summary at the top (focus moves to it), each item links to its field.
- [ ] Role field: **hidden** for AE and trader, shown for Company and Enterprise.
- [ ] ID type toggle: CNI → front + back uploads; Passport → front only.
- [ ] Upload tile states: empty → uploading (progress bar) → uploaded (filename + Replace) → error (message + Retry). Test the `fail` trigger, a 6 MB file, a `.exe`.
- [ ] On success: green "Your account was created and sandbox API keys are ready" on the next step. Sandbox key visible later on `/status`.

## 3 · Business details
**AE:** ANAE number (monospace) + photo · activity from the ANAE list (search by code `001` or name `soutien`; no free text; removable chip) · "What you'll be able to accept" summary · 5,000,000 DZD cap notice · physical goods notice with a link back to step 1 · trade name, wilaya, commune, address · channels.
**Trader:** RC / RAM toggle + number + photo · NIF + certificate · same address/activity/channels.
**Company / Enterprise:** company name, legal form (EURL/SARL/SNC/SPA/Other + specify), RC + photo, NIF, NIS, statuts (PDF only), address, company phone/email · "Is the legal representative the registered manager?" (No → delegation + manager ID uploads; Enterprise collects the delegation in its own step) · beneficial owners.
- [ ] Sales channel Online/Both → website required. `https://shop.example.com` shows exactly: "Online sales must run on a site hosted in Algeria with a .com.dz address." `shop.example.com.dz` passes. In person hides the field.
- [ ] Beneficial owners: add/remove rows, ID-verified / ID-missing badges, row-level errors, total ownership ≤ 100 %, at least one owner.
- [ ] Format errors appear on blur (e.g. NIF `!`).

## 4 · Settlement & expected volume
- [ ] Bank (RIB) / Algérie Poste (CCP) toggle changes the validator and the duplicate check.
- [ ] Holder name mismatch: **warning** for AE/trader (name on ID); for Company/Enterprise a blocking error "…must use an account in the company's name" on Continue.
- [ ] Volume bands from config. For a Company, picking the top band shows the live Enterprise note and **adds the Enterprise documents step before Review**.

## 4b · Enterprise documents
- [ ] Contract notice (a signed contract is required before go-live).
- [ ] Delegation of signing authority, latest financial statements (PDF), AML questionnaire (Not started → In progress → Done; must be Done), technical contact, sub-merchants yes/no.

## 5 · Review & submit
- [ ] One card per step with an Edit link back to that step (data is kept).
- [ ] Documents list with Uploaded / Missing statuses.
- [ ] Submitting without the declaration shows an inline error + summary.
- [ ] After submit: confirmation with expected review time (48 h placeholder) and next steps (+ contract line for Enterprise). Track my application → `/status`: **Under review**.

## Application status (portal)
- [ ] Timeline: Submitted → In review → Approved / Rejected.
- [ ] **Rejected** (`trader.rejected@…`): reason (predefined), message, flagged items highlighted. *Fix and resubmit* opens **only** the flagged fields; everything else is kept. After resubmitting → Under review. (Server refuses changes to unflagged items.)
- [ ] **Approved**: KYC level, limits (placeholders), products for the type, live + sandbox keys.
- [ ] **Enterprise** (`enterprise.approved@…`): "Contract signature pending", live key **Inactive** until the admin marks the contract signed.
- [ ] Test outbox lists the emails/notifications sent.

## Draft & resume
- [ ] Leave mid-signup, log in again: lands on the step after the last completed one (`ae.draft@…` → step 3).
- [ ] Back keeps typed values. Reload keeps pre-account choices (type, typed account data).
- [ ] Admin → *Incomplete signups* shows the partner with its last completed step.

## Admin (`/admin`)
- [ ] Tabs KYC Level 2 / Level 3 / Incomplete signups; Partner type filter (only types of that level), status filter.
- [ ] Detail: checklist **specific to the type** (AE: ANAE card; Company: RC/NIF/NIS/statuts/owners/…; Enterprise adds AML, financials, technical contact), declared volume band, ANAE activity code (AE), documents with **Preview popup**, submitted data, audit log.
- [ ] Approve: both statuses APPROVED, KYC level set, type/band limits applied, live keys activated (Enterprise: stay inactive), partner notified. A warning shows if the checklist is incomplete.
- [ ] Reject: reason and message **mandatory** (inline errors), flagged fields optional; partner sees it in the portal + email.
- [ ] Enterprise: *Mark contract as signed* is disabled until approved; afterwards live key becomes Active.
- [ ] Every action appears in the audit log (actor, time).

## After approval
- [ ] **Limits** per type and band from `LIMITS` (placeholders): AE shows the 5,000,000 DZD annual legal cap, Enterprise "By contract".
- [ ] **AE cap** (QA tools): 79 % no banner · 80 % warning banner + "Upgrade to Individual trader / Company" + email in outbox (sent once) · 100 % banner "flagged for review" (default FLAG) and an admin list badge. `AE_CAP_BEHAVIOUR = 'BLOCK'` in `tbd.ts` changes the banner to "blocked".
- [ ] **Activity restriction** (AE): category check allows only categories mapped to the ANAE code; admin sees the code.
- [ ] **Upgrade**: Upgrade button → pre-filled draft, lands on the first step that still needs input (AE → Trader: business step; AE → Company also asks for the role and a company-name settlement account). Current account keeps its limits (card says so). Submit → admin sees an "Upgrade" row → approve changes type, limits, products, KYC.
- [ ] **Volume above band** (QA tools → Above band, as `company.approved@…`): banner + email; *Update declared volume* clears it; limits unchanged; an Enterprise-level band for a Company is refused with "start an upgrade".

## Cross-cutting
- [ ] Trigger → loading → success/fail on every step, upload, OTP, submit, admin action (spinner + disabled button + `aria-busy`).
- [ ] Errors are inline at the field/section. No generic toast.
- [ ] Keyboard only: every control reachable, visible 3px navy focus ring, error summary takes focus.
- [ ] Screen reader: errors announced (`aria-describedby`), `aria-invalid` on bad fields, stepper uses `aria-current="step"`.
- [ ] Touch targets ≥ 44 px; inputs 48 px, buttons 52 px.
- [ ] Phone width (390 px): sidebar stacks above the content, nothing overflows horizontally.
- [ ] FR and AR copy present everywhere (AR = first-pass, needs native review); AR is RTL and mirrored.
- [ ] Contrast ≥ 4.5:1 (automated: `tests/contrast.test.ts`).

## Open questions (kept as config, not decided)
All in `src/shared/config/tbd.ts`, each with a `TODO(compliance)` question.

| # | Question | Config |
|---|---|---|
| 1 | BA Instruction 06-2025 ceilings for merchants? | `BA_INSTRUCTION_06_2025_CEILINGS_APPLY_TO_MERCHANTS` (null) |
| 2 | AE sells physical goods online? | `AE_ALLOW_PHYSICAL_GOODS_ONLINE` (false; notice only, not enforced) |
| 3 | At 100 % of AE cap: block or flag? | `AE_CAP_BEHAVIOUR` (`FLAG`) |
| 4 | ANAE card verification by API? | `ANAE_VERIFICATION` (`MANUAL`; admin checklist item) |
| 5 | Beneficial ownership threshold / data | `BENEFICIAL_OWNER_THRESHOLD_PCT` (placeholder 25) |
| 6 | Enterprise threshold, limits | `ENTERPRISE_VOLUME_THRESHOLD`, `VOLUME_BANDS`, `LIMITS` (placeholders) |
| 7 | Individuals with no legal status excluded? | `NO_LEGAL_STATUS_EXCLUDED` (null; dead end implemented) |

Identifier formats (RC, NIF, NIS, NIN, ANAE, RIB, CCP, phone, password policy) are **placeholders** in `src/shared/validators/index.ts`.
