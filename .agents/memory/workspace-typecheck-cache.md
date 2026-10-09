---
name: Workspace TypeScript build cache
description: Deployment builds can reuse stale project-reference outputs before artifact typechecks.
---

Force-rebuild TypeScript project references before running recursive artifact typechecks. Cached declaration files and build metadata can appear current while downstream `tsc --noEmit` reports TS6305.

**Why:** The deployment cache produced a project-reference declaration error even though the source was valid; rebuilding references first made the API package typecheck pass.

**How to apply:** Keep the root `typecheck:libs` step on `tsc --build --force` before the workspace package typechecks.
