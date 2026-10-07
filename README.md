# Mizaniya Pay – Partner signup (frontend + mock API)

Tiered Partner signup by partner type. Frontend only; the backend is a mock (`src/api/mock`, added in phase 2).
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
