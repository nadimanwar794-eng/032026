# IIC — Ideal Inspiration Classes

Multi-platform education app (web + mobile) for students and coaching centres. Includes a learning platform with lessons, MCQs, AI chat, and a full coaching management ecosystem.

## Run & Operate

- `pnpm --filter @workspace/iic-app run dev` — run the web app (port varies, check workflow)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required env: `DATABASE_URL` — Postgres connection string (for api-server / db packages)
- Firebase config is embedded in `artifacts/iic-app/src/firebase.ts` (no separate env needed for web app)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React 19 + Vite + Tailwind CSS + Radix UI + Wouter
- Mobile: React Native + Expo 54
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth + Realtime: Firebase (Firestore + RTDB + Auth)
- Validation: Zod, drizzle-zod
- Build: esbuild

## Where things live

- `artifacts/iic-app/src/` — main web app source
  - `App.tsx` — root component; view routing (SCHOOL_ECOSYSTEM, COACHING_ECOSYSTEM, STUDENT_DASHBOARD, ADMIN_DASHBOARD, etc.)
  - `firebase.ts` / `school-firebase.ts` / `coaching-firebase.ts` — Firebase helpers
  - `school-types.ts` / `coaching-types.ts` — domain types
  - `components/school/` — School Ecosystem (Firestore-backed, multi-tenant)
  - `components/coaching/` — Coaching Ecosystem (Firestore-backed, multi-tenant)
  - `components/AdminDashboard.tsx` — IIC platform admin panel
  - `components/StudentDashboard.tsx` — main student-facing dashboard
- `lib/db/` — Drizzle schema + migrations (PostgreSQL)
- `lib/api-spec/` — OpenAPI spec; run codegen to regenerate hooks/schemas
- `artifacts/iic-app-mobile/` — Expo mobile app

## Architecture decisions

- **Dual database strategy**: Firestore for metadata (schools, coachings, users, lessons) and RTDB for high-frequency realtime data (homework entries, manager records). This keeps Firestore costs low while RTDB handles rapid updates.
- **Multi-tenant by coachingId/schoolId scoping**: All RTDB paths are prefixed with the entity ID (`coaching_homework/{coachingId}/`, `coaching_manager/{coachingId}/`). Never use global paths for coaching/school data.
- **UI-layer access control + Firebase Rules**: Subscription and lock checks gate RTDB listener registration in CoachingAdminPanel. Firebase Security Rules must be the authoritative enforcement layer (see follow-up task #2).
- **Lazy-loaded heavy components**: AdminDashboard, SchoolEcosystem, CoachingEcosystem, WeeklyTestView are all lazy-loaded to keep initial bundle small.
- **`// @ts-nocheck` convention**: Large legacy components use this to avoid blocking builds; new components should prefer typed code.

## Product

- **Student learning platform**: Board/class/subject selection, AI-generated lessons, MCQs, weekly tests, subscription tiers (₹49/week to ₹2499 lifetime)
- **School Ecosystem**: Multi-tenant school management — super admin creates schools, assigns teachers/admins, manages lessons with reading/writing/PDF/MCQ modes; students join via school code
- **Coaching Ecosystem**: Multi-tenant coaching management — super admin creates coaching centres at ₹500/month subscription; coaching admin manages batches, students, fees, tests, and homework entries from one panel
- **Admin Dashboard**: IIC platform admin panel for content management, user management, coaching homework, and access to both ecosystems

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The web app runs via the `artifacts/iic-app: web` workflow (Vite), NOT the `IIC App` workflow (which is stale)
- RTDB coaching paths: `coaching_manager/{coachingId}/` for manager data, `coaching_homework/{coachingId}/` for homework. Old global path `coaching_homework/` is used by legacy StudentDashboard code — do not delete it
- Firebase Firestore permissions error on initial load is expected for unauthenticated users (school/coaching snapshots fail gracefully)
- `pnpm install` must be run before any workflow will start (node_modules missing = all workflows fail)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Coaching Ecosystem entry: `state.view === 'COACHING_ECOSYSTEM'` in `App.tsx` → `CoachingEcosystem` → `CoachingSuperAdminPanel` (for ADMIN/SUB_ADMIN) or `CoachingAdminPanel` (for COACHING_ADMIN/COACHING_SUB_ADMIN)
