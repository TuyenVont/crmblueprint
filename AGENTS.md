# CRM Development Rules

## Product

Multi-tenant SaaS CRM.

Core flow:

Lead → Contact/Company → Deal → Pipeline → Won/Lost.

## Stack

- Next.js
- TypeScript
- PostgreSQL
- Supabase
- Tailwind CSS
- shadcn/ui

## Architecture

- workspace_id on all tenant-owned business entities
- never hard-code pipeline stages
- reusable DataTable
- reusable Filter system
- RBAC enforced server-side
- server-side pagination
- tenant isolation must be enforced server-side
- database changes must use migrations

## Coding Rules

- TypeScript strict
- no `any` unless justified
- no duplicate components
- no unrelated refactors
- do not add dependencies without reason
- keep components and functions focused
- do not create speculative features
- prefer existing reusable components

## Workflow

Before coding:

1. Read this file.
2. Read the assigned task file.
3. Inspect only files relevant to the task.
4. State a short implementation plan.
5. Do not scan the whole repository unless necessary.

After coding:

1. Run typecheck.
2. Run relevant tests.
3. Report changed files.
4. Report database migrations if any.
5. Report remaining issues.
6. Do not start another ticket automatically.

## Scope

Do NOT implement unless a future ticket explicitly requests it:

- telephony
- inventory
- internal chat
- HR
- payment gateway
- AI copilot
- website builder
- native mobile app
- marketplace
