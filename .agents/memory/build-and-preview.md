---
name: Build and preview constraints
description: Durable workspace constraints for declaration builds and artifact preview workflows.
---

The workspace's library declaration outputs must be regenerated before app typechecking, and artifact Vite dev commands must honor injected PORT/BASE_PATH values rather than hardcoding a port.

**Why:** Vercel typechecking could see tracked build-info but no generated api-zod declarations, and the managed web workflow timed out when Vite ignored its injected port.

**How to apply:** Keep the root library typecheck forced before recursive app checks, and use the artifact workflow's injected environment in frontend dev/build commands.