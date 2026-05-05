Recovered from commit `e6305a4757f6123bf150fc4d0ffd14541a9b60e6`.

Context:
- Merge commit `50ecfaa` replaced the prior `apps/app` Vite application with a Next.js app.
- This snapshot preserves the pre-merge UI and application logic without overwriting the current tree.

Recovered root:
- `recovery/app-pre-merge/apps/app`

High-value recovered areas:
- `src/pages`
- `src/components`
- `src/services`
- `src/context`
- `src/hooks`
- `src/data`

Use this snapshot as the source of truth for restoring missing screens or porting logic into the current app.
