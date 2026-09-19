# Phase 010 - Contacts

Implementation is complete locally. Hosted migration deployment and authenticated browser acceptance remain pending.

## Inspection and schema

Read AGENTS.md, DATABASE.md, ARCHITECTURE.md, UI.md, RBAC_ADMIN_008A.md and MEMBERS_READ_008B1.md. The user request is the Phase 010 task; tasks/ only contained the foundation ticket.
Inspected Phase 009 app-context, layout, navigation, desktop/mobile shell and existing Supabase/session patterns.
Inspected migration-defined contacts, companies, company_contacts, security permission seeds, grants, RLS, composite foreign keys, indexes and updated_at triggers. Applied all migrations to disposable PostgreSQL 14 with a minimal Supabase Auth stub and exercised the resulting schema. Hosted schema drift was not inspected.

Actual contact fields: id, workspace_id, first_name, last_name, email, phone, birthday, address, source_id, owner_user_id, notes, created_at, updated_at. There is no contact status or direct company_id. Company links are many-to-many through company_contacts, with job_title and is_primary. Companies have name. Existing composite foreign keys prevent cross-workspace owners, sources and company/contact links. Existing contact indexes cover workspace with owner, source, email and phone; link indexes cover workspace with company/contact. No table or column was added.

Actual permissions: CONTACTS_VIEW, CONTACTS_MANAGE, and COMPANIES_VIEW for displaying company links. No role-name checks. Relationship writes currently require both COMPANIES_MANAGE and CONTACTS_MANAGE under existing RLS.

## New migration

Apply supabase/migrations/20260916001000_contacts_view_guard.sql before deploying the module. Existing contacts_manage_authorized is permissive FOR ALL and therefore grants SELECT to a manage-only role. A new restrictive policy requires CONTACTS_VIEW for contact access, including writes. It composes with existing policies: view-only still cannot write, and mutations require manage plus view. No old migration, permission definition, table grant or existing policy is edited. No new RPC or service-role client is used.

## Behavior

- /app/contacts: server-side case-insensitive literal substring search across first_name, last_name, email and phone. Trimmed search, maximum 200 characters. Query syntax and LIKE wildcard characters are escaped. Default 50 rows per page, exact filtered total, stable created_at descending then id ascending. Search persists in pagination links; a new search resets page. Empty pages offer return navigation. Desktop table and mobile cards.
- /app/contacts/new: server-derived workspace and explicit editable-field allowlist. First name required, bounded text, email and real calendar date validation. Nullable blank fields become null. Ownership and source default to null. Successful save redirects to detail; failures preserve entered values and show feedback.
- /app/contacts/[id]/edit: same allowlist and validation; preserves ownership, source, workspace, IDs, timestamps and company relations. The database maintains updated_at.
- /app/contacts/[id]: actual contact data, owner/source IDs, timestamps, company names and link metadata when permitted. No profile/email lookup that bypasses Members permissions.
- All service entry points resolve the shared app context, require effective view/manage permissions, and scope reads/writes to its workspace. Foreign, absent and malformed IDs produce unavailable/not-found behavior. Protected form values are ignored. RLS is authoritative for revoked permissions and membership.
- Existing shell/navigation and auth resolution are reused unchanged. Loading, empty, error, form pending and unavailable states are included.

## Limitations

No delete/archive: the schema has no established safe contact deletion strategy.
Company relations are displayed read-only and require COMPANIES_VIEW. Editing is deferred because preserving multiple existing links and metadata while saving a contact requires an atomic multi-table operation and additional company manage permission; no parallel relation model or Companies CRUD was introduced.
Owner/source IDs are shown rather than inventing profile visibility or building assignment/source management.
No dependencies were added. No later phase was started.
No authenticated browser session or browser automation tool was available. Visual layout, browser console, hosted JWT/PostgREST behavior, create/edit browser journeys and hosted schema parity remain unverified. Local SQL tests use an Auth stub, not hosted Supabase.

## Files created

- src/features/contacts/types.ts
- src/features/contacts/validation.ts
- src/server/contacts.ts
- src/components/contacts/contacts-table.tsx
- src/components/contacts/contact-form.tsx
- src/components/ui/data-table.tsx
- src/components/ui/list-controls.tsx
- src/app/app/contacts/actions.ts
- src/app/app/contacts/new/page.tsx
- src/app/app/contacts/[id]/page.tsx
- src/app/app/contacts/[id]/edit/page.tsx
- src/app/app/contacts/loading.tsx
- src/app/app/contacts/error.tsx
- src/app/app/contacts/not-found.tsx
- supabase/migrations/20260916001000_contacts_view_guard.sql
- supabase/tests/010_contacts.sql
- tests/contacts.test.mjs
- docs/CONTACTS_010.md

## Files modified

- src/app/app/contacts/page.tsx: replace Phase 009 placeholder.
- tests/members.test.mjs: repair stale pre-Phase-009 test imports to follow shared app-context. Members production behavior unchanged.
- tsconfig.tsbuildinfo: generated by typecheck, if retained locally.

## Validation

- npm run typecheck: passed.
- npm run lint: passed.
- npm run build: passed, all four Contacts routes included.
- node --test tests/contacts.test.mjs tests/members.test.mjs: 13 tests passed.
- supabase/tests/010_contacts.sql: passed on disposable PostgreSQL 14; authorized create/edit/read, read-only write rejection, manage-only view rejection, outsiders, disabled/anonymous actors, forged foreign workspace, foreign contact IDs, search/pagination and cross-workspace company FK rejection.
- supabase/tests/008a_rbac_admin.sql and 008b1_members_read.sql: passed on the same database with the new migration applied.
- App Shell navigation permission filtering covered by application regression test.

Phase 010 code and local validation are complete. Production acceptance is pending migration deployment and authenticated browser verification.
