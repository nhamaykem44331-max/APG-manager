# APG Manager Deployment Guardrails

This document is the source of truth for any future code change made by a human or an AI model.

If a change touches deployment, dependencies, Prisma, auth, booking UI, finance, or shared types, follow this checklist before saying the task is done.

## 1. Definition Of Done

A change is not done until all of the following are true:

- Local code builds successfully.
- The correct lockfile is committed.
- Prisma schema and migrations are in sync.
- Render API can build from the current repo state.
- Vercel web can build from the current repo state.
- The deployed web UI matches the intended change.
- The deployed API health check is reachable.

Do not mark a feature as "deployed" if only Render updated but Vercel did not, or vice versa.

## 2. Monorepo Lockfile Rules

APG Manager is an npm workspace monorepo.

Important:

- The authoritative lockfile is the root file: `package-lock.json`
- Do not keep a committed `apps/api/package-lock.json`
- Do not keep a committed `apps/web/package-lock.json`
- After changing dependencies in any workspace, always run `npm install` from the repo root
- Commit the updated root `package-lock.json`

Why this matters:

- Render builds the API from `apps/api`, but npm still resolves workspace state from the monorepo root
- If `apps/api/package.json` changes and the root lockfile is not updated, `npm ci` on Render will fail

## 3. Required Local Verification

After any dependency or build-system change:

```bash
cd <repo-root>
npm install
cd apps/api
npm ci --include=dev --dry-run
npm run build
cd ../web
npm run type-check
```

After any frontend UI change:

```bash
cd <repo-root>/apps/web
npm run type-check
```

After any backend feature or Prisma change:

```bash
cd <repo-root>/apps/api
npx prisma generate
npm run build
```

## 4. Prisma Rules

If `apps/api/prisma/schema.prisma` changes:

- Create a real migration locally
- Commit the migration directory in `apps/api/prisma/migrations`
- Run `npx prisma generate`
- Make sure the target database already supports the schema before relying on production startup

Recommended workflow:

```bash
cd apps/api
npx prisma migrate dev --name <clear_name>
npx prisma generate
```

Never claim a Prisma feature is production-ready if:

- only `schema.prisma` changed
- no migration was created
- or production DB has not been checked

## 5. Render API Rules

Current Render service assumptions:

- Root Directory: `apps/api`
- Build Command:

```bash
npm ci --include=dev && npx prisma generate && npm run build
```

- Pre-Deploy Command: empty
- Start Command:

```bash
node dist/main
```

- Health Check Path:

```txt
/api/v1/system/health
```

Do not add automatic Prisma migrate steps to Render start or pre-deploy unless production connectivity and migration safety are both verified.

If `render.yaml` changes, make sure the actual Render dashboard settings are also updated. Existing manual services do not always auto-sync from the file.

## 6. Vercel Web Rules

The APG web UI is deployed separately from the API.

If a change affects UI, the Render deployment alone is not enough.

Required Vercel environment variables:

```env
NEXTAUTH_URL=https://manager.tanphuapg.com
NEXTAUTH_SECRET=<secret>
NEXT_PUBLIC_API_URL=https://<api-domain>/api/v1
API_INTERNAL_URL=https://<api-domain>/api/v1
```

Before closing a UI task:

- Confirm the newest Vercel deployment uses the expected commit
- Confirm the custom domain `manager.tanphuapg.com` points to that deployment
- Hard refresh the page and verify the actual UI

## 7. Supabase Rules

APG Manager uses Supabase Postgres as the database, not Supabase Auth for the main login flow.

Backend login depends on the Nest API.

Minimum backend env:

```env
DATABASE_URL=<supabase connection string>
DIRECT_URL=<supabase direct or session connection string>
JWT_SECRET=<secret>
FRONTEND_URL=https://manager.tanphuapg.com
NODE_ENV=production
PORT=10000
```

Do not assume "data exists in Supabase" means login will work.
Login also requires:

- reachable API
- correct JWT secret
- correct CORS frontend URL
- correct Vercel API URL

## 8. Deployment Verification Checklist

Before pushing:

- `git status` is understood
- root `package-lock.json` is updated if dependencies changed
- no accidental per-app lockfiles are committed
- Prisma migrations are committed if schema changed

After pushing:

- Render API deployment is green
- `GET /api/v1/system/health` returns `status: ok`
- Vercel web deployment is green
- If the task changes UI, the visible page matches the change

## 9. Common Failure Patterns To Avoid

- Changing `apps/api/package.json` without updating root `package-lock.json`
- Creating only Prisma schema changes without migrations
- Deploying API and assuming the web UI will update automatically
- Fixing `render.yaml` but forgetting the live Render dashboard still has old commands
- Changing auth or API URLs without updating Vercel envs
- Saying a feature is done after checking code only, without checking the deployed screen

## 10. Mandatory Notes For Any AI Model

If you are an AI assistant editing this repo, you must:

- read this file before changing deploy-sensitive code
- treat the root lockfile as authoritative
- verify both backend and frontend deploy paths when relevant
- never report deployment success from local code alone
- state clearly what was verified and what still needs a manual redeploy

