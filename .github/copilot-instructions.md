# APG Manager Copilot Instructions

Read `docs/deployment-guardrails.md` before changing code that affects dependencies, Prisma, auth, deployment, or UI.

Critical repo rules:

- This repo uses npm workspaces.
- The only lockfile that should be committed is the root `package-lock.json`.
- After dependency changes in any workspace, run `npm install` from the repo root.
- If `apps/api/prisma/schema.prisma` changes, create and commit a migration.
- Render deploys the API from `apps/api`, but npm still relies on the monorepo lockfile state.
- Vercel deploys the web separately; a frontend change is not complete until the deployed page matches the change.

Minimum verification for deploy-sensitive changes:

```bash
cd apps/api
npm ci --include=dev --dry-run
npm run build

cd ../web
npm run type-check
```

