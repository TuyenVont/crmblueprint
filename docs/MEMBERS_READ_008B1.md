# Phase 008B.1 — Members read API

Apply `supabase/migrations/20260915190000_members_read_api.sql` after 008A,
before deploying the updated Members page. Migrations 001–008A, existing RLS,
table grants, and mutation RPCs are unchanged. No dependency was added.

## Contracts

- `get_my_workspace_permissions(p_workspace_id uuid)` returns rows containing
  `permission_code`. Requires `auth.uid()` and ACTIVE membership. Uses the
  existing `private.has_permission` definition. Accepts no user or role ID and
  does not require `ROLES_VIEW` or `MEMBERS_VIEW`.
- `list_workspace_members(p_workspace_id uuid, p_search text default null,
  p_limit integer default 50, p_offset integer default 0)` requires ACTIVE
  membership and `MEMBERS_VIEW`. Returns a JSON object with `members` and
  `total` (the filtered count, including when the page is empty).
  Each member contains `workspace_member_id`, `user_id`, `display_name`,
  `email`, `role_id`, `role_name`, `role_is_system`, `status`, and `joined_at`.
  Only the requested workspace's memberships are joined to Auth users.
  Email can be null for accounts without an email address.

Both functions are STABLE SECURITY DEFINER with an empty search path and
schema-qualified object references. PUBLIC/anon execution is revoked;
authenticated execution is granted. No Auth password, token, metadata or
other user's role permission mappings are returned.

Search is a case-insensitive literal substring of profile name or email;
whitespace is trimmed. Limit must be 1–100, offset nonnegative, and trimmed
search at most 200 characters. Null pagination arguments are rejected.
Ordering is joined date then membership ID. Authorization and results use
the same database statement snapshot.

The page uses these RPCs through the existing session-bound server client.
Workspace resolution retains the existing first ACTIVE membership behavior.
Role labels and Owner protection come from the list response, independently
of `ROLES_VIEW`. The role selector still uses the existing roles table read
policy and is shown only when role options are accessible. Other management
buttons use `MEMBERS_MANAGE`; mutation RPCs remain authoritative.

## Verification

Against a disposable database with all migrations applied, as migration owner:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008b1_members_read.sql
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008a_rbac_admin.sql
node --test tests/members.test.mjs
npm run typecheck
npm run lint
npm run build
```

The SQL tests roll back fixtures. They cover access without ROLES_VIEW,
caller-only permissions across two workspaces, zero-permission roles,
unauthorized/outsider/disabled/invited/anonymous rejection, email and field
isolation, search, pagination, grants, and function configuration.

Local verification passed on PostgreSQL 14 using the existing minimal Supabase
Auth stub. This validates SQL behavior, not hosted JWT/PostgREST integration.
Apply the migration to hosted Supabase and verify the Members page with an
Owner and a MEMBERS_VIEW-only user before final acceptance. Hosted deployment
and authenticated browser verification were not performed in this change.
