# APG Manager Agent Notes

Before making changes in this repo, read:

- `docs/deployment-guardrails.md`
- `DEPLOY_CHECKLIST.md` for the short release flow

Follow these non-negotiable rules:

- This is an npm workspace monorepo. The root `package-lock.json` is authoritative.
- Do not commit `apps/api/package-lock.json` or `apps/web/package-lock.json`.
- If a workspace dependency changes, run `npm install` at the repo root and commit the updated root lockfile.
- If `schema.prisma` changes, create and commit a real migration.
- A task that affects UI is not complete until the Vercel web deployment is considered.
- A task that affects API is not complete until the Render API health check is considered.
- Do not call a feature "deployed" unless the visible production behavior matches the requested change.

<!-- KARPATHY_GUIDELINES_START -->

# Coding Guidelines (Karpathy-Inspired)

These coding guidelines are mandatory for APG Manager RMS. Apply them to every change in this repository.

Tradeoff: These principles prioritize care over speed. For very small tasks such as typo fixes or one-line changes, use judgment, but still preserve the user's intent.

## 1. Think Before Coding

Do not guess. Do not hide ambiguity. Explain tradeoffs.

Before implementing:

- State your assumptions. If you are unsure and the decision is risky, ask.
- If there are multiple possible interpretations, describe the main interpretations instead of silently choosing one.
- If there is a simpler approach, say so. Push back when a request may overcomplicate the code or damage the architecture.
- If something confusing could affect financial data, authentication, or production behavior, stop and clarify.

## 2. Simplicity First

Write the smallest amount of code that solves the problem. Do not speculate.

- Do not add features beyond the request.
- Do not create abstractions for code that is used only once.
- Do not add flexibility or configurability before it is requested.
- Do not handle impossible error scenarios if doing so makes the code harder to understand.
- If a clear 50-line solution is enough, do not write 200 lines.

Ask yourself: "Would a senior engineer call this overcomplicated?" If yes, simplify it.

## 3. Surgical Changes

Only change what must be changed. Only clean up the mess created by your own change.

When editing existing code:

- Do not "improve" adjacent code, comments, or formatting that is unrelated to the request.
- Do not refactor working code unless the user requested it.
- Match the existing style, even if you would choose a different style in a new project.
- If you notice unrelated dead code, mention it in the report instead of deleting it.

When your change creates orphaned code:

- Remove imports, variables, and functions that your own change made unused.
- Do not remove pre-existing dead code unless explicitly requested.

Check: every changed line must trace directly back to the user's request.

## 4. Goal-Driven Execution

Define success criteria. Keep looping until verification is complete.

Turn tasks into verifiable goals:

- "Add validation" -> write or run checks for invalid inputs, then make them pass.
- "Fix bug" -> reproduce the failing case with concrete data, then verify that case is fixed.
- "Refactor X" -> ensure behavior before and after is unchanged using appropriate type-checks, tests, or manual smoke checks.

For multi-step tasks, write a short plan:

1. [Step] -> verify: [check]
2. [Step] -> verify: [check]
3. [Step] -> verify: [check]

## Project-Specific: APG Manager RMS

### Tech Stack

- Monorepo: npm workspaces + Turborepo.
- Frontend: Next.js App Router, React 18, Tailwind, TanStack Query, and Zustand in `apps/web/`.
- Backend: NestJS 10, Prisma 5, and PostgreSQL in `apps/api/`.
- Auth: JWT + RBAC.
- Deploy: Vercel or the frontend domain, Render backend, and Supabase database.
- A shared package workspace is declared in `package.json`, but the repo currently has no `packages/` directory. Do not create a new shared package unless explicitly requested.

### Mandatory Rules

- Use strict TypeScript. Avoid `any`; if it is unavoidable, explain why and keep the scope narrow.
- Keep UI copy in Vietnamese, with mobile-first layouts and dark mode support.
- Components that fetch async data must include loading, error, and empty states.
- Add short Vietnamese or English code comments only when logic is hard to read. Do not comment the obvious.
- Do not change the Prisma schema without creating an appropriate migration file.
- Do not change the JWT/RBAC auth flow unless explicitly requested.
- Do not commit secrets, API keys, database URLs, or tokens.
- Preserve the module structure in `apps/web` and `apps/api`.
- n8n webhooks live on a separate VPS. The backend should expose endpoints or trigger webhooks, not absorb large automation workflows into NestJS unless explicitly requested.

### Conventions

- API endpoints use REST and the `/api/v1/` prefix.
- Frontend data/state: TanStack Query for server state and Zustand for client state.
- Component names use PascalCase. File names use kebab-case.
- Prisma models use PascalCase. Database tables and columns use snake_case through Prisma mapping when needed.
- For UI changes, check both desktop and mobile behavior.
- For finance changes, clearly distinguish "debt recorded" from "real money collected/paid".

### Verification Expectations

- Frontend change: prefer `npm run type-check --workspace @apg-manager/web`.
- Backend change: prefer `npm run type-check --workspace @apg-manager/api`; if the API already has unrelated legacy errors, state which errors are unrelated.
- Finance or booking change: verify with a concrete data case such as a PNR or booking id when possible.
- Production or deployment change: do not call it deployed until the production URL shows the requested behavior.

<!-- KARPATHY_GUIDELINES_END -->
