# R3F v8 → v9 + React 18 → 19 Migration

## Why
Next.js 16 strips `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` from its vendored React in the client bundle. `@react-three/fiber@8.x` reads `ReactCurrentOwner` from that path at module-eval time, so Car3DInspector crashes on load with:

```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
  at ./node_modules/@react-three/fiber/dist/events-*.esm.js
```

R3F v9 was rewritten for React 19 and doesn't read internals — it's the supported fix for Next 16.

## Safety net
Pre-migration checkpoint: commit `b6017e8` ("Security remediation: tighten RLS, harden API routes, lock receipts").

Roll back at any time with:
```powershell
git reset --hard b6017e8
npm install
```

Supabase migrations are already applied LIVE and are independent of this — they stay regardless.

## Stack target

| Package | From | To |
| --- | --- | --- |
| `@react-three/fiber` | 8.18.0 | ^9.6.1 |
| `@react-three/drei` | 9.122.0 | ^10.7.7 |
| `react` | ^18 | ^19 |
| `react-dom` | ^18 | ^19 |
| `@types/react` | ^18 | ^19 |
| `@types/react-dom` | ^18 | ^19 |
| `three` | ^0.184.0 | unchanged (>=0.159 required, we're well above) |

## Phases (interruptible)

Each phase ends in a verifiable, committable state. If a session ends, the next session resumes from the next pending phase.

- [x] **Phase A** — Bump dependency versions, `npm install`, lockfile clean
  - Installed: react@19.2.6, react-dom@19.2.6, @types/react@19.2.14, @types/react-dom@19.2.3, @react-three/fiber@9.6.1, @react-three/drei@10.7.7, three@0.184.0 (unchanged), next@16.2.6 (unchanged)
  - Required clean install (rm -rf node_modules package-lock.json) because old drei v9 pinned in lockfile conflicted with React 19 peer

- [x] **Phase B** — Run `npx tsc --noEmit`
  - Result: **exit 0, zero type errors**. Codebase was already type-compatible with React 19 + R3F v9.

- [x] **Phase C** — Patch type errors / R3F v9 API renames
  - **Skipped — nothing to patch.** Phase B produced no errors.

- [x] **Phase D** — `npm run build`
  - Result: PASS. Compiled successfully in 7.0s, all 14 static pages generated, all routes (including new /api/rentals + /api/rentals/[id]/return) emitted.
  - Only warning: middleware→proxy deprecation (separate cleanup, tracked elsewhere).

- [x] **Phase E** — User verified 3D viewer renders and damage pins work end-to-end.

## Post-migration cleanup (done same session)
- Renamed `src/middleware.ts` → `src/proxy.ts` (Next 16 file convention)
- Restored `next dev` (Turbopack) — R3F v9 no longer reads React internals so the original block is gone
- Deleted local SQL files now superseded by live Supabase migrations:
  - `supabase/schema.sql`
  - `supabase/seed.sql`
  - `supabase/2026_05_10_costs_overhaul.sql`
- Refreshed README (Next.js 16, dropped the "run schema.sql" setup step)

## Known harmless warnings still present
- `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead` — emitted by R3F v9 internals, upstream issue, not patchable from app code. Console-only, no functional impact.

## Known constraints / gotchas
- R3F v9 requires React 19, not React 18 — package combo is locked
- Drei v10's `useGLTF`, `OrbitControls`, `Html`, `Environment` APIs unchanged in shape, but TS event types may differ
- React 19 deprecates `forwardRef` (legacy still works) — no codebase action required if tsc passes
- Next 16 + React 19 should be fine (Next 16 peer-supports React 19)
- Webpack mode currently forced in `package.json` (`next dev --webpack`) — once migration completes, can experiment with restoring Turbopack

## Type errors found
_(populated after Phase B)_

## Files likely touched
- `package.json` (Phase A)
- `package-lock.json` (Phase A)
- `src/components/Car3DInspector.tsx` (Phase C — event handler types)
- `src/components/CarDamageInspector.tsx` (Phase C — possible Damage3DPin type ripple)
- Possibly any `forwardRef` usage anywhere in `src/` (Phase C — only if tsc complains)

## Resume instructions for a fresh session

1. `cd c:\Users\filip\Desktop\vtz-rentacar`
2. Read this file first
3. `git status` — confirm working tree state
4. `git log --oneline -5` — confirm `b6017e8` (safety) is reachable
5. Check the phase checkboxes above for the next `[ ]` pending phase
6. Resume from there
