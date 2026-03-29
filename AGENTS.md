# APG Manager Agent Notes

Before making changes in this repo, read:

- `docs/deployment-guardrails.md`

Follow these non-negotiable rules:

- This is an npm workspace monorepo. The root `package-lock.json` is authoritative.
- Do not commit `apps/api/package-lock.json` or `apps/web/package-lock.json`.
- If a workspace dependency changes, run `npm install` at the repo root and commit the updated root lockfile.
- If `schema.prisma` changes, create and commit a real migration.
- A task that affects UI is not complete until the Vercel web deployment is considered.
- A task that affects API is not complete until the Render API health check is considered.
- Do not call a feature "deployed" unless the visible production behavior matches the requested change.

