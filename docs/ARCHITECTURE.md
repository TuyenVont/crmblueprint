# CRM System Architecture

## 1. Goal

Build a simple, maintainable multi-tenant SaaS CRM.

Priority order:

1. Data security.
2. Tenant isolation.
3. Correct business behavior.
4. Maintainability.
5. Simplicity.
6. Development speed.
7. Performance optimization.

Do not introduce premature infrastructure complexity.

---

## 2. High-Level Architecture

```text
Browser
   │
   ▼
Next.js App
   │
   ├── UI
   ├── Server Actions / Route Handlers
   ├── Authentication
   ├── Authorization
   ├── Business Services
   └── Data Access
           │
           ▼
       Supabase
           ├── PostgreSQL
           ├── Auth
           └── Storage
```

MVP uses one Next.js app and one Supabase project. No microservices.

---

## 3. Project Structure

```text
src/
├── app/
├── components/
├── features/
├── lib/
├── server/
├── types/
└── config/
```

Responsibilities:

- `app/`: routes, layouts, page composition.
- `components/`: shared reusable UI.
- `features/`: CRM business modules.
- `lib/`: shared utilities and external clients.
- `server/`: server-only business logic and data access.
- `types/`: shared TypeScript types.
- `config/`: application configuration.

Create folders only when a feature actually needs them.

---

## 4. Feature Modules

Typical modules:

```text
features/
├── auth/
├── workspace/
├── users/
├── teams/
├── leads/
├── contacts/
├── companies/
├── deals/
├── pipelines/
├── activities/
├── tasks/
├── products/
├── tags/
├── custom-fields/
├── notifications/
├── automation/
├── dashboard/
└── reports/
```

---

## 5. Request Security Flow

Every tenant-owned business operation follows:

```text
User Request
↓
Authenticate User
↓
Resolve Current Workspace
↓
Verify Workspace Membership
↓
Check Permission
↓
Validate Input
↓
Business Service
↓
Database
↓
Timeline / Audit / Events
↓
Return Result
```

Never trust authorization data from the browser.

---

## 6. Multi-Tenant and RBAC

Every tenant-owned query must be scoped to the current Workspace.

Conceptually:

```text
WHERE workspace_id = currentWorkspace.id
```

The server must verify Workspace membership before access.

Supabase RLS is an additional protection layer, not a replacement for server-side authorization.

RBAC flow:

```text
User
↓
Workspace Membership
↓
Role
↓
Permissions
```

Permission checks should use reusable helpers such as `requirePermission("DEAL_EDIT")`.

---

## 7. Data Access and Business Services

UI components must not contain raw database queries.

Preferred flow:

```text
UI
↓
Server Action / Route Handler
↓
Business Service
↓
Data Access
↓
Database
```

Complex workflows belong in reusable server-side services, for example:

- `convertLead()`
- `moveDealToStage()`
- `createDealWithProducts()`
- `markDealWon()`
- `markDealLost()`
- `completeTask()`

Services may validate input, check permissions, run transactions, write Timeline/Audit data, trigger automation, and return results.

---

## 8. Transactions and Events

Use transactions when multiple records must change atomically.

Important flows:

- Lead conversion.
- Deal stage move + Timeline + Audit Log.
- Deal WON/LOST + Timeline + Audit Log.
- Deal creation + Deal Items.

Initial domain events may include:

- `LeadCreated`
- `LeadConverted`
- `DealCreated`
- `DealUpdated`
- `DealStageChanged`
- `DealWon`
- `DealLost`
- `TaskCreated`
- `TaskCompleted`

MVP does not need Kafka, RabbitMQ, or another external event broker.

---

## 9. Timeline vs Audit Log

Timeline is user-facing CRM history.

Audit Log is administrative/security history.

Do not merge both concepts into one feature.

---

## 10. Validation and Errors

All external input must be validated server-side, including forms, route params, query params, API requests, imports, and webhooks.

Use predictable error categories:

- ValidationError
- AuthenticationError
- AuthorizationError
- NotFoundError
- ConflictError
- BusinessRuleError
- InternalError

Do not expose raw database errors or secrets to users.

---

## 11. Pagination, Search and Filters

Large CRM tables use server-side pagination. Default: `page = 1`, `limit = 50`.

Filtering should use reusable infrastructure:

```text
Filter Definition
↓
Filter UI
↓
Request Params
↓
Server Query
```

Use PostgreSQL search/query for MVP. Do not add a dedicated search server without a future requirement.

---

## 12. DataTable and Kanban

Use shared DataTable infrastructure for Leads, Contacts, Companies, Deals, Tasks, and Products.

Expected capabilities: columns, sorting, search, filters, pagination, row selection, bulk actions, loading, empty, and error states.

Kanban is a Deal view:

```text
Pipeline
↓
Stages
↓
Deals
```

Moving a Deal must call a server-side business service. Never update `stage_id` directly from client logic.

---

## 13. API and State Strategy

Prefer Server Actions for internal web operations.

Use Route Handlers when a real HTTP endpoint is required for integrations, webhooks, public APIs, exports, or special HTTP behavior.

Do not duplicate business logic between Server Actions and Route Handlers.

Prefer server state as the source of truth. Do not add Redux, MobX, or Zustand without a demonstrated need.

---

## 14. Storage, Automation and Performance

Use Supabase Storage when file uploads are introduced. Private CRM files must respect Workspace permissions.

Automation flow:

```text
Domain Event
↓
Automation Engine
↓
Trigger
↓
Conditions
↓
Actions
```

Automation should reuse normal business services.

Initial performance principles:

- server-side pagination
- appropriate indexes
- avoid N+1 queries
- select only needed data
- avoid unnecessary client JavaScript

---

## 15. Testing and Secrets

Highest-priority tests:

- Tenant isolation.
- RBAC.
- Lead conversion.
- Deal stage movement.
- WON/LOST logic.
- Deal product snapshots.

Secrets belong in environment variables. Never commit passwords, service role keys, auth tokens, or database credentials. Provide `.env.example` with placeholders only.

---

## 16. MVP Exclusions

Do not add unless explicitly requested:

- Microservices.
- Kubernetes.
- Kafka.
- RabbitMQ.
- Redis cluster.
- GraphQL.
- Event sourcing.
- CQRS.
- Dedicated search server.
- Data warehouse.
- Separate frontend/backend repositories.

---

## 17. AI Coding Agent Rules

Agents must:

1. Read `AGENTS.md`.
2. Read the assigned ticket.
3. Read only relevant documentation.
4. Inspect only relevant code.
5. Make the smallest reasonable change.
6. Avoid unrelated refactors.
7. Run relevant checks.
8. Report changed files.
9. Stop after completing the ticket.

Agents must not redesign architecture without an explicit task.
