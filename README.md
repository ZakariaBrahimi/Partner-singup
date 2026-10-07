# Mizaniya Pay – Partner signup (frontend + mock API)

Tiered Partner signup by partner type. Frontend only; the backend is a mock (`src/api/mock`, localStorage-backed).
Plan: `docs/partner-tiered-signup/PLAN.md`.

```
npm install
npm run dev      # app
npm test         # vitest
npm run build
```

- `src/shared/` – framework-free config, validators, flow and schema. The partner types live in `src/shared/config/partnerTypes.ts`; adding a type = adding one config entry (+ i18n strings).
- Every TBD value (Risk/Compliance) is in `src/shared/config/tbd.ts` with a `TODO(compliance)` comment.
- UI components follow shadcn/ui conventions (`components.json`, `src/components/ui`). They are authored by hand because the shadcn CLI registry is not reachable from the build environment.

## More

- QA checklist, demo accounts, mock triggers: `docs/partner-tiered-signup/QA.md`
- Plan and build notes: `docs/partner-tiered-signup/PLAN.md`
- Open `/signup?dev=1` for QA tools (simulate AE cap / volume, reset data). Admin: `/admin`.
- `src/api/types.ts` is the contract the real backend must implement; `src/api/index.ts` is the single place to swap the mock for it.
