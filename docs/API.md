# CRM API Rules

## 1. Goal

API behavior must be simple, consistent, secure, multi-tenant safe, and reusable by future integrations.

---

## 2. Server Interface

Prefer Server Actions for internal web operations.

Use Route Handlers when an actual HTTP API is required.

Do not create duplicate API layers.

---

## 3. REST Pattern

Example:

```text
GET    /api/contacts
POST   /api/contacts
GET    /api/contacts/:id
PATCH  /api/contacts/:id
DELETE /api/contacts/:id
```

The same convention may be used for Leads, Contacts, Companies, Deals, Pipelines, Stages, Activities, Tasks, and Products when HTTP endpoints are needed.

---

## 4. Security Flow

Every private operation must follow:

```text
Authenticated User
↓
Resolve Workspace
↓
Verify Membership
↓
Check Permission
↓
Validate Input
↓
Execute Business Logic
```

Never trust `workspace_id`, `user_id`, role, or permissions from the client.

---

## 5. Tenant Isolation and Authorization

Every tenant-owned database operation must be scoped to the current Workspace.

Permissions must be checked server-side. Hiding a button is not authorization.

Examples: `CONTACT_VIEW`, `CONTACT_CREATE`, `CONTACT_EDIT`, `CONTACT_DELETE`, `DEAL_VIEW`, `DEAL_CREATE`, `DEAL_EDIT`, `DEAL_DELETE`, `DEAL_ASSIGN`.

---

## 6. Pagination, Search, Sorting and Filtering

Example pagination request:

```text
GET /api/deals?page=1&limit=50
```

Response:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 0,
    "totalPages": 0
  }
}
```

Search example: `GET /api/contacts?search=nguyen`.

Sorting example: `GET /api/deals?sort=created_at&order=desc`.

Only whitelisted sort fields are allowed. Allowed order: `asc`, `desc`.

Filtering example:

```text
GET /api/deals?pipeline_id=xxx&stage_id=xxx&owner_id=xxx
```

Filtering infrastructure should be reusable.

---

## 7. Validation and Responses

Validate server-side request bodies, query params, route params, form data, imports, and webhooks.

Success response:

```json
{
  "data": {}
}
```

Error response:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input"
  }
}
```

Basic error codes:

- `VALIDATION_ERROR`
- `UNAUTHENTICATED`
- `FORBIDDEN`
- `NOT_FOUND`
- `CONFLICT`
- `BUSINESS_RULE_ERROR`
- `INTERNAL_ERROR`

Do not expose raw database errors.

---

## 8. Lead Conversion

Use one business operation: `convertLead()`.

Flow:

```text
Validate Lead
↓
Check Permission
↓
Create Contact
↓
Create optional Company
↓
Create Deal
↓
Mark Lead Converted
↓
Create Timeline Event
↓
Create Audit Log
```

Run in a transaction.

---

## 9. Deal Stage Change

Do not update `stage_id` directly from UI.

Use `moveDealToStage()`.

Flow:

```text
Validate Deal
↓
Validate Stage and Pipeline
↓
Check Permission
↓
Update Deal
↓
Create Timeline
↓
Create Audit Log
↓
Trigger Automation
```

WON/LOST must use `stage.type`: `OPEN`, `WON`, `LOST`.

---

## 10. Bulk Actions and Import/Export

Possible bulk actions: Assign Owner, Add Tag, Delete, Export.

Bulk actions must verify Workspace, verify permissions, validate records, and respect business rules.

Import must validate data, scope to Workspace, report invalid records, and not create unknown schema automatically.

Export requires an appropriate permission such as `EXPORT_DATA`.

---

## 11. Public API and Webhooks

A full public REST API is not required for MVP. Business logic should remain reusable so public APIs can use the same services later.

Potential webhook/domain events include:

- `LeadCreated`
- `LeadConverted`
- `DealCreated`
- `DealUpdated`
- `DealStageChanged`
- `DealWon`
- `DealLost`
- `TaskCreated`
- `TaskCompleted`

---

## 12. API Security Rules

Never:

- expose service role keys
- expose database credentials
- trust Workspace or permissions from the client
- bypass RBAC
- return cross-Workspace data
- return stack traces to end users

When working on API code, agents must reuse business services, validate input, resolve Workspace, check permission, stay inside ticket scope, and avoid unnecessary endpoints.
