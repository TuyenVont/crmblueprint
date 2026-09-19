# CRM-001 — Project Foundation

## Goal

Initialize the CRM web application in the current repository.

## Read

- AGENTS.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md

Do not read unrelated documentation unless required.

## Requirements

- Next.js with App Router
- TypeScript strict mode
- Tailwind CSS
- npm only
- use `src/` directory
- keep existing `docs/`, `tasks/`, `AGENTS.md` and README files
- create a minimal working home page
- create `.env.example`
- do not add real secrets
- add a `typecheck` npm script using `tsc --noEmit`

## Do Not Implement

- Supabase database schema
- authentication
- CRM modules
- dashboard
- sidebar
- RBAC
- API endpoints
- ORM
- extra libraries not required for this ticket

## Acceptance Criteria

The following commands must pass:

```text
npm run typecheck
npm run lint
npm run build
```

The app must start successfully with:

```text
npm run dev
```

## Completion

Report:

- files created or changed
- packages installed
- commands executed
- any remaining issues

Stop after CRM-001.
