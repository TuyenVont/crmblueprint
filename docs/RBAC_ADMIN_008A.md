# Phase 008A: RBAC administration security core

## Migration and compatibility

Migration: `supabase/migrations/20260915180000_rbac_admin.sql`.
Apply after migrations 001-007 using the normal migration owner. No previous
migration, table grant, or RLS policy is changed. No application dependency is added.

Review of existing migrations:

- 001: same-workspace role assignment already has a composite foreign key.
  Owner identity is `roles.is_system = true AND roles.name = 'Owner'`; there is
  no separate role code. System names are therefore preserved by these RPCs.
- 002-004: CRM ownership and authorship foreign keys can prevent membership
  deletion. Removal rejects known references with `MEMBER_REFERENCED_USE_DISABLE`.
  Existing foreign keys remain the final protection against concurrent CRM writes;
  a deferred foreign-key error may still occur at transaction commit. Existing
  team membership and notification rows cascade on successful member removal.
- 005: authenticated RBAC table writes were intentionally withheld. The new
  SECURITY DEFINER RPCs fill that gap without granting direct writes.
  Actual permission codes are `MEMBERS_MANAGE` / `ROLES_MANAGE`, consistent with
  this task; older conceptual examples in docs use different singular codes.
- 006: Auth profile creation is compatible. The 001 Auth membership cascade could
  otherwise remove a last Owner, so the new member trigger also guards that path.
- 007: onboarding atomically creates an active Owner and the five default roles.
  Owner receives all existing permissions; Admin excludes `WORKSPACE_DELETE`.
  Onboarding is unchanged and passes the regression test with the new trigger.

## RPC contracts

All UUID parameters use the `p_` prefix, matching `create_workspace`. In particular,
`p_member_id` means `workspace_members.id`, **not** an Auth user ID. Every public
RPC derives its actor through `auth.uid()` in the shared authorization helper.
All operations are atomic, including their audit entry.

| RPC | Permission | Behavior / return |
| --- | --- | --- |
| `change_member_role(p_workspace_id, p_member_id, p_role_id)` | `MEMBERS_MANAGE` | Changes the member's role; returns void. Checks both current and destination roles against the actor's permission ceiling. Only an Owner can assign Owner. |
| `disable_workspace_member(p_workspace_id, p_member_id)` | `MEMBERS_MANAGE` | Sets ACTIVE to DISABLED; DISABLED is idempotent. INVITED is rejected. Returns void. |
| `enable_workspace_member(p_workspace_id, p_member_id)` | `MEMBERS_MANAGE` | Sets DISABLED to ACTIVE; ACTIVE is idempotent. INVITED is rejected. Rechecks the role's permissions before restoring access. Returns void. |
| `remove_workspace_member(p_workspace_id, p_member_id)` | `MEMBERS_MANAGE` | Deletes an unreferenced membership. Preserves CRM references by rejecting removal; use disable when history must retain membership. Returns void. |
| `create_workspace_role(p_workspace_id, p_name, p_description)` | `ROLES_MANAGE` | Creates a non-system role with **zero permissions**; returns its UUID. |
| `update_workspace_role(p_workspace_id, p_role_id, p_name, p_description)` | `ROLES_MANAGE` | Updates custom role name/description or non-Owner system role description. Returns void. |
| `update_role_permissions(p_workspace_id, p_role_id, p_permission_codes text[])` | `ROLES_MANAGE` | Atomically replaces the entire permission set. Empty array clears it, duplicates collapse, null arrays/elements and unknown codes fail. Returns void. |
| `delete_workspace_role(p_workspace_id, p_role_id)` | `ROLES_MANAGE` | Deletes only a custom role with no members in **any** status. Permission mappings cascade. Returns void. |

Descriptions may be null. Names are trimmed, nonempty, unique ignoring case and
surrounding spaces within the workspace. `Owner` is reserved ignoring case/spaces.
System role names cannot change; the Owner system role cannot be edited at all.

## Security invariants and review

1. Authentication and ACTIVE membership are required. No actor user ID is accepted.
   A disabled actor cannot re-enable themselves. Authorization is checked before
   locking and again after waiting for the lock.
2. Every role/member lookup is workspace-scoped; composite foreign keys remain
   enabled. An ID from another tenant is rejected as not found after authorization.
3. Non-Owners cannot change, disable, enable, or remove any Owner, including an
   inactive Owner. Matching the Owner's permissions does not grant Owner identity.
4. Both current and proposed role permissions must be subsets of the actor's
   existing effective permissions. This also prevents lower-privileged managers
   from disabling/removing stronger members or editing stronger roles.
5. Permission replacement validates the entire proposed set against the actor's
   **pre-change** permissions. Editing one's own role can reduce permissions but
   cannot add a permission the actor lacks. There is no Owner bypass of the ceiling.
6. `WORKSPACE_DELETE` cannot be granted to any editable role, even by an Owner.
   Owner mappings are immutable through this API. No workspace deletion RPC is added.
7. System roles cannot be deleted. Assigned custom roles cannot be deleted even
   when their members are disabled or invited.
8. A member trigger rejects removing, disabling, moving, or demoting the last
   ACTIVE Owner. A disabled Owner does not count. It also protects Auth-user deletion
   cascades. Workspace deletion itself does not require a surviving membership.
9. Every administration RPC writes/locks the workspace row before reading mutable
   authorization state. Calls in the same workspace serialize. The real row write
   makes stale REPEATABLE READ / SERIALIZABLE transactions abort rather than use
   an old Owner count or old permissions. Callers must retry whole transactions on
   serialization/deadlock errors. Successful calls update workspace `updated_at`.
10. All new functions use `search_path = ''`, qualified application objects, static
    SQL, and no client-controlled dynamic SQL. Only the eight public RPCs grant
    EXECUTE to authenticated. Internal helpers revoke EXECUTE from PUBLIC, anon,
    and authenticated, despite authenticated's existing private-schema USAGE.
11. Successful RPCs write existing `audit_logs` with the Auth actor and old/new
    values. Errors roll back the mutation and audit together. RLS stays intact.

These guarantees cover the authenticated RPC boundary and the membership trigger.
Privileged SQL administrators can still alter roles, permission mappings, triggers,
or grants; future trusted writers must preserve these invariants and use the same
workspace serialization protocol. A pre-existing ownerless workspace is rejected
by administration RPCs and requires deliberate operator repair.

## Verification

Run `supabase/tests/008a_rbac_admin.sql` using psql as the migration owner on a
disposable database with migrations 001-008A applied. It creates test Auth users,
switches to authenticated/anon for checks, and rolls back all fixture changes:

```sh
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/008a_rbac_admin.sql
```

The concurrency spec is input for PostgreSQL's `isolationtester` utility:

```sh
isolationtester "$TEST_DATABASE_URL" < supabase/tests/008a_rbac_concurrency.spec
```

Expected: the second Owner's disable waits, then fails `LAST_ACTIVE_OWNER` at READ
COMMITTED, or `could not serialize access due to concurrent update` at REPEATABLE
READ. The utility displays expected errors; inspect output, not just its exit code.
The third permutation demotes the waiting actor and expects `FORBIDDEN` after the
first transaction commits, verifying authorization is refreshed after locking.

Local verification used PostgreSQL 14 with a minimal `auth.users` / `auth.uid()`
stub. It validates PostgreSQL behavior but does not exercise hosted Supabase JWT
verification or PostgREST exposure. Repeat against a disposable Supabase project.

## Manual SQL / security tests on Supabase

Use separate test users: Owner, second Owner, Admin, Sales, restricted custom
manager, disabled member, invited member, and an outsider; create two workspaces.
For SQL impersonation use a transaction as a trusted test operator:

```sql
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '<actor-auth-uuid>', true);
select public.change_member_role('<workspace-uuid>', '<member-row-uuid>', '<role-uuid>');
rollback;
```

Run rejected cases separately or under savepoints because exceptions abort the
transaction. Also test actual Supabase SDK calls with each user's session token.

1. Call **each RPC** as anon, an authenticated outsider, a disabled member, and
   Sales without manage permissions. All must fail with no mutation or audit.
2. For **each scoped parameter**, substitute a role/member/workspace from the
   other tenant. Verify rejection and no cross-tenant data returned or changed.
3. As Admin, try assigning Owner to yourself/others and changing, enabling,
   disabling, or removing active and disabled Owners. All must fail.
4. As restricted manager, assign yourself a stronger role, enable a stronger
   disabled member, edit a stronger role, and add an absent permission to your
   own role. All must fail; permitted subset assignments must succeed.
5. As Owner and Admin, attempt to grant `WORKSPACE_DELETE` to Admin/custom roles.
   Try renaming a role to `Owner`, `owner`, and ` Owner `. All must fail.
6. Try every Owner role metadata/permission modification and system role deletion.
   Try deleting custom roles assigned to ACTIVE, DISABLED, and INVITED members.
7. With one active Owner and one disabled Owner, attempt demotion, disable, removal,
   and Auth deletion of the active Owner. All must fail. Activate the second Owner;
   a legitimate Owner handoff must then succeed.
8. In two SQL sessions, concurrently demote/remove/disable the two active Owners.
   Keep the first transaction uncommitted while starting the second. At least one
   active Owner must remain. Repeat at REPEATABLE READ and SERIALIZABLE.
9. Race an Owner revoking an Admin's permission or disabling the Admin against
   that Admin assigning a role/updating permissions. A waiting Admin must observe
   the revocation or receive a serialization failure, never commit stale authority.
10. Test null/unknown/duplicate/empty permission arrays, blank/duplicate names,
    missing IDs, and INVITED enable/disable attempts. Verify atomic rollback.
11. Remove a member referenced by contacts, companies, leads, deals, activities,
    and tasks. Verify rejection without deleting CRM history. Test an unreferenced
    member removal and existing team/notification cascade behavior.
12. Attempt direct INSERT/UPDATE/DELETE on all three RBAC tables and direct calls
    to every new private helper as authenticated. Verify permission denial.
13. Check audit actor/old/new values for each successful operation; verify failed
    calls add no success audit. Check existing tenant RLS queries after disable.
14. Run `create_workspace()` after applying 008A and confirm five system roles,
    original default permissions, and one ACTIVE Owner are still created.
