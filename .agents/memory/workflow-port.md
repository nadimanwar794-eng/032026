---
name: Artifact workflow ports
description: Vite artifact previews must receive the workflow-provided port or wait on the actual dev-server port.
---

Artifact metadata can reserve a port while a manually configured workflow may not inject PORT. Prefer the managed artifact workflow; if registration is unavailable, configure the workflow to wait on the Vite port it actually opens and keep host 0.0.0.0.

**Why:** A workflow waiting on the reserved artifact port timed out even though Vite was healthy on its default port.

**How to apply:** Check workflow logs for the real listening port before changing application code or retrying a failed port restart.