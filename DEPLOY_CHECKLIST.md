# APG Manager Release Checklist

Use this file every time before calling a change "released" or "deployed".

## Before Push

- [ ] Read `docs/deployment-guardrails.md`
- [ ] `git status` is understood and only intended files changed
- [ ] If dependencies changed, run `npm install` at the repo root
- [ ] The committed lockfile is the root `package-lock.json`
- [ ] No per-app lockfiles are committed in `apps/api` or `apps/web`
- [ ] If `apps/api/prisma/schema.prisma` changed, a real migration was created and committed
- [ ] `cd apps/api && npm ci --include=dev --dry-run && npm run build`
- [ ] `cd apps/web && npm run type-check`

## Deploy

- [ ] Push to GitHub
- [ ] Render API latest deployment is green
- [ ] `GET /api/v1/system/health` returns `status: ok`
- [ ] Vercel web latest deployment is green
- [ ] If UI changed, hard refresh `manager.tanphuapg.com` and confirm the visible page matches the request
- [ ] If auth or API routing changed, verify `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `NEXT_PUBLIC_API_URL`, and `API_INTERNAL_URL`
- [ ] If DB-related logic changed, verify production Supabase schema/data path works as expected

## Do Not Close The Task Until

- [ ] Both Render and Vercel are updated when relevant
- [ ] The production UI/API behavior matches the requested change
- [ ] You can state exactly what was verified and what still needs manual action
