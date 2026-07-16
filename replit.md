# IIC Study App

A student exam-prep platform (school boards + competitive/government exams) with subject-wise notes, MCQ practice, revision tracking, subscriptions, and an admin content dashboard.

## Run & Operate

- `pnpm --filter @workspace/iic-study-app run dev` — run the web app (main artifact)
- `pnpm --filter @workspace/iic-study-app run typecheck` — typecheck the app
- `pnpm --filter @workspace/api-server run dev` — run the API server (currently unused by the app, see below)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Main app: React 18 + Vite (`artifacts/iic-study-app`), Tailwind v4, Framer Motion, `wouter`
- Backend/data: **Firebase** (Firestore, Realtime Database, Auth) — config is hardcoded in `artifacts/iic-study-app/src/firebase.ts`, not via env vars (this mirrors how the app was originally built)
- PWA via `vite-plugin-pwa`
- Routing is state-based (a `view`/tab field drives rendering), not URL-based — there is no client-side router for app navigation

## Where things live

- `artifacts/iic-study-app/src/components/StudentDashboard.tsx` — main student experience (huge file, most student-facing flows live here)
- `artifacts/iic-study-app/src/components/AdminDashboard.tsx` — admin content/user management
- `artifacts/iic-study-app/src/components/RevisionHubScreen.tsx` / `RevisionHubV2.tsx` — Revision Hub (MCQ practice + spaced-repetition revision + performance tabs)
- `artifacts/iic-study-app/src/constants.ts` — `getSubjectsList()`, the static subject catalog used across notes/admin/challenge flows
- `artifacts/iic-study-app/src/firebase.ts` — Firebase config + data access helpers

## Architecture decisions

- The app is **frontend-only against Firebase** — the scaffolded `artifacts/api-server` and its DB/OpenAPI codegen pipeline are pre-existing workspace boilerplate, not used by this app. Don't wire new features to `api-server` unless explicitly asked to migrate off Firebase.
- Revision Hub's MCQ subject list (`RevisionHubScreen.tsx`) is derived dynamically from real `mcq_lessons` data in Firebase (subjects only appear once content exists) — this intentionally does NOT use `constants.ts`'s static `getSubjectsList()`, unlike the rest of the app (notes browsing, admin dashboard, challenge generator), which still uses the static catalog by design.

## Product

- Students pick a class/board/stream, browse subject notes and video lectures, practice MCQs, and track revision via spaced repetition and performance analytics.
- Subscription tiers gate premium notes/videos; a credit system charges for certain actions (starting MCQ sessions, opening lessons).
- Admins manage content (notes, MCQs, videos), users, subscriptions, and app settings from a separate Admin Dashboard.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Firestore permission-denied errors in the browser console when not logged in / in anonymous mode are expected — the app still renders the auth screen correctly.
- `artifacts/api-server` and `artifacts/mockup-sandbox` workflows don't need to run for this app to work; only `artifacts/iic-study-app: web` matters.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
