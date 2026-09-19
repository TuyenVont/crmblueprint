# CRM Database Design

## 1. Principles

Database: PostgreSQL on Supabase.

The CRM is multi-tenant.

Tenant-owned business tables should contain:

- `id`
- `workspace_id`
- `created_at`
- `updated_at`

Rules:

- Never trust `workspace_id` from the client.
- Resolve the current workspace server-side.
- Enforce tenant isolation server-side and with Supabase RLS where applicable.
- Never hard-code pipeline stages.
- Use migrations for schema changes.
- Use transactions for multi-record workflows.
- Do not add tables outside MVP without a ticket.

---

## 2. Core Relationships

```text
auth.users
    │
    ▼
profiles
    │
    ▼
workspace_members ─────► workspaces
    │
    └──────────────────► roles ─► role_permissions ─► permissions

workspaces
    ├── teams
    ├── leads
    ├── contacts
    ├── companies
    ├── pipelines ─► stages ─► deals
    ├── activities
    ├── tasks
    ├── products
    ├── tags
    ├── custom_fields
    ├── notifications
    ├── automation_rules
    └── audit_logs

companies ◄── company_contacts ──► contacts

deals ─► deal_items ─► products
```

---

## 3. Authentication and Workspace

### profiles

```text
id uuid PK -> auth.users.id
full_name text
avatar_url text nullable
phone text nullable
created_at timestamptz
updated_at timestamptz
```

### workspaces

```text
id uuid PK
name text
slug text
logo_url text nullable
timezone text
currency text
language text
created_by uuid
created_at timestamptz
updated_at timestamptz
```

### workspace_members

```text
id uuid PK
workspace_id uuid FK
user_id uuid FK
role_id uuid FK
status text
created_at timestamptz
updated_at timestamptz
```

Status: `ACTIVE`, `INVITED`, `DISABLED`.

Unique: `workspace_id + user_id`.

---

## 4. Teams and RBAC

### teams

```text
id uuid PK
workspace_id uuid FK
name text
description text nullable
created_at timestamptz
updated_at timestamptz
```

### team_members

workspace_id uuid FK
team_id uuid FK
workspace_member_id uuid FK
created_at timestamptz

Unique: `team_id + workspace_member_id`.

### roles

```text
id uuid PK
workspace_id uuid FK
name text
description text nullable
is_system boolean
created_at timestamptz
updated_at timestamptz
```

Default roles: Owner, Admin, Sales Manager, Sales, CSKH.

### permissions

```text
id uuid PK
code text UNIQUE
description text
```

Examples: `CONTACT_VIEW`, `CONTACT_EDIT`, `LEAD_VIEW`, `LEAD_EDIT`, `DEAL_VIEW`, `DEAL_EDIT`, `DEAL_ASSIGN`, `TASK_VIEW`, `REPORT_VIEW`, `EXPORT_DATA`, `AUTOMATION_MANAGE`, `SETTINGS_MANAGE`.

### role_permissions

```text
role_id uuid FK
permission_id uuid FK
```

Unique: `role_id + permission_id`.

RBAC must be enforced server-side.

---

## 5. Lead Sources and Leads

### lead_sources

```text
id uuid PK
workspace_id uuid FK
name text
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Sources are dynamic, not hard-coded.

### leads

```text
id uuid PK
workspace_id uuid FK
first_name text
last_name text nullable
phone text nullable
email text nullable
company_name text nullable
source_id uuid nullable FK
status text
owner_user_id uuid nullable
notes text nullable
converted_at timestamptz nullable
converted_contact_id uuid nullable
converted_company_id uuid nullable
converted_deal_id uuid nullable
created_at timestamptz
updated_at timestamptz
```

Statuses: `NEW`, `ASSIGNED`, `CONTACTED`, `QUALIFIED`, `CONVERTED`, `UNQUALIFIED`.

Lead conversion may create Contact, optional Company, and Deal. It must run in one transaction.

---

## 6. Contacts and Companies

### contacts

```text
id uuid PK
workspace_id uuid FK
first_name text
last_name text nullable
phone text nullable
email text nullable
birthday date nullable
address text nullable
source_id uuid nullable FK
owner_user_id uuid nullable
notes text nullable
created_at timestamptz
updated_at timestamptz
```

### companies

```text
id uuid PK
workspace_id uuid FK
name text
tax_id text nullable
phone text nullable
email text nullable
website text nullable
address text nullable
industry text nullable
size text nullable
owner_user_id uuid nullable
created_at timestamptz
updated_at timestamptz
```

### company_contacts

```text
id uuid PK
workspace_id uuid FK
company_id uuid FK
contact_id uuid FK
job_title text nullable
is_primary boolean
created_at timestamptz
updated_at timestamptz
```

Unique: `company_id + contact_id`.

---

## 7. Pipelines, Stages and Deals

### pipelines

```text
id uuid PK
workspace_id uuid FK
name text
is_default boolean
created_at timestamptz
updated_at timestamptz
```

### stages

```text
id uuid PK
workspace_id uuid FK
pipeline_id uuid FK
name text
position integer
type text
color text nullable
created_at timestamptz
updated_at timestamptz
```

Stage types: `OPEN`, `WON`, `LOST`.

Stage names are user-configurable. Never determine WON/LOST from stage names.

### deals

```text
id uuid PK
workspace_id uuid FK
name text
amount numeric
currency text
pipeline_id uuid FK
stage_id uuid FK
owner_user_id uuid nullable
contact_id uuid nullable FK
company_id uuid nullable FK
source_id uuid nullable FK
expected_close_date date nullable
won_at timestamptz nullable
lost_at timestamptz nullable
lost_reason text nullable
created_at timestamptz
updated_at timestamptz
```

Rules:

- `stage_id` must belong to `pipeline_id`.
- Stage changes create Timeline history.
- Important changes create Audit Logs.
- WON/LOST is determined by `stage.type`.

---

## 8. Activities and Tasks

### activities

```text
id uuid PK
workspace_id uuid FK
type text
title text nullable
content text nullable
lead_id uuid nullable FK
contact_id uuid nullable FK
company_id uuid nullable FK
deal_id uuid nullable FK
created_by uuid
activity_at timestamptz
created_at timestamptz
updated_at timestamptz
```

Types: `CALL`, `EMAIL`, `MEETING`, `NOTE`, `TASK`, `SMS`, `MESSAGE`, `FILE`, `SYSTEM`.

Activities are used to build CRM Timeline history.

### tasks

```text
id uuid PK
workspace_id uuid FK
title text
description text nullable
assignee_user_id uuid nullable
created_by uuid
deadline timestamptz nullable
priority text
status text
lead_id uuid nullable FK
contact_id uuid nullable FK
company_id uuid nullable FK
deal_id uuid nullable FK
completed_at timestamptz nullable
created_at timestamptz
updated_at timestamptz
```

Priorities: `LOW`, `NORMAL`, `HIGH`, `URGENT`.

Statuses: `TODO`, `IN_PROGRESS`, `DONE`, `CANCELLED`.

---

## 9. Products and Deal Items

### products

```text
id uuid PK
workspace_id uuid FK
name text
sku text nullable
image_url text nullable
unit text nullable
price numeric
currency text
is_active boolean
created_at timestamptz
updated_at timestamptz
```

Inventory quantity is not part of MVP.

### deal_items

```text
id uuid PK
workspace_id uuid FK
deal_id uuid FK
product_id uuid nullable FK
name_snapshot text
price numeric
quantity numeric
discount numeric
tax numeric
total numeric
created_at timestamptz
updated_at timestamptz
```

Product name and price are snapshotted so historical Deals do not change when Product data changes.

---

## 10. Tags and Custom Fields

### tags

```text
id uuid PK
workspace_id uuid FK
name text
color text nullable
created_at timestamptz
updated_at timestamptz
```

Assignments may use `lead_tags`, `contact_tags`, `company_tags`, and `deal_tags`.

### custom_fields

```text
id uuid PK
workspace_id uuid FK
entity_type text
name text
field_key text
field_type text
required boolean
visible boolean
position integer
options jsonb nullable
created_at timestamptz
updated_at timestamptz
```

Entities: `LEAD`, `CONTACT`, `COMPANY`, `DEAL`, `TASK`.

Field types: `TEXT`, `TEXTAREA`, `NUMBER`, `CURRENCY`, `DATE`, `DATETIME`, `BOOLEAN`, `SELECT`, `MULTI_SELECT`, `USER`, `PHONE`, `EMAIL`, `URL`.

### custom_field_values

```text
id uuid PK
workspace_id uuid FK
custom_field_id uuid FK
entity_type text
entity_id uuid
value jsonb
created_at timestamptz
updated_at timestamptz
```

---

## 11. Notifications, Automation and Audit

### notifications

```text
id uuid PK
workspace_id uuid FK
user_id uuid
type text
title text
message text
is_read boolean
related_entity_type text nullable
related_entity_id uuid nullable
created_at timestamptz
updated_at timestamptz
read_at timestamptz nullable
```

MVP uses in-app notifications.

### automation_rules

```text
id uuid PK
workspace_id uuid FK
name text
is_active boolean
trigger_type text
conditions jsonb
actions jsonb
created_at timestamptz
updated_at timestamptz
```

Model: `WHEN -> IF -> THEN`.

Initial actions: `CREATE_TASK`, `NOTIFY_USER`, `ASSIGN_USER`, `CHANGE_STAGE`, `UPDATE_FIELD`, `ADD_TAG`.

### audit_logs

```text
id uuid PK
workspace_id uuid FK
actor_user_id uuid nullable
entity_type text
entity_id uuid
action text
old_values jsonb nullable
new_values jsonb nullable
created_at timestamptz
```

Examples: `CREATE`, `UPDATE`, `DELETE`, `ASSIGN`, `STAGE_CHANGE`, `LEAD_CONVERT`, `EXPORT`.

Timeline and Audit Log are different concepts.

---

## 12. Pagination and Indexing

Large tables use server-side pagination. Default: `page = 1`, `limit = 50`.

Important index candidates:

- `workspace_id`
- `owner_user_id`
- `pipeline_id`
- `stage_id`
- `contact_id`
- `company_id`
- `deal_id`
- `source_id`
- `status`
- `created_at`

Useful compound indexes may include:

- `workspace_id + created_at`
- `workspace_id + owner_user_id`
- `workspace_id + stage_id`

Only add indexes based on real query needs.

---

## 13. Transactions and Delete Rules

Transactions are required for:

- Lead conversion.
- Deal stage move + Timeline + Audit Log.
- Deal WON/LOST + Timeline + Audit Log.
- Deal creation + Deal Items.

Do not blindly cascade-delete CRM history. Be careful with Contact, Company, Deal, Product, User, Pipeline, and Stage deletion.

---

## 14. MVP Scope

Included: Auth, Workspace, Users, Teams, RBAC, Leads, Contacts, Companies, Pipelines, Stages, Deals, Activities, Timeline, Tasks, Products, Deal Items, Tags, Custom Fields, Notifications, Basic Automation, Audit Logs.

Excluded: Telephony, Inventory, Warehouse, Internal Chat, HR, Payments, AI Copilot, Website Builder, Marketplace.

---

## 15. Golden Flow

```text
Login
↓
Create Lead
↓
Assign Lead
↓
Add Activity / Follow-up Task
↓
Qualify and Convert Lead
↓
Contact + optional Company + Deal
↓
Deal enters Pipeline
↓
Move Deal through Stages
↓
Add Product / Activities / Tasks
↓
Run Automation
↓
Deal WON / LOST
↓
Timeline and Audit Log updated
↓
Dashboard / Reports use CRM data
```
