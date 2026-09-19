begin;

-- =========================================================
-- 005 SECURITY
--
-- Goals:
-- 1. Workspace isolation
-- 2. RBAC permissions
-- 3. Safe grants for authenticated
-- 4. No anon access
-- 5. Sensitive administration remains server/RPC controlled
-- =========================================================


-- =========================================================
-- 1. PERMISSION DEFINITIONS
-- =========================================================

insert into public.permissions (code, description)
values

  ('WORKSPACE_VIEW', 'View workspace information'),
  ('WORKSPACE_UPDATE', 'Update workspace settings'),
  ('WORKSPACE_DELETE', 'Delete workspace'),

  ('MEMBERS_VIEW', 'View workspace members'),
  ('MEMBERS_MANAGE', 'Invite, update and remove workspace members'),

  ('ROLES_VIEW', 'View roles and permissions'),
  ('ROLES_MANAGE', 'Create and manage roles'),

  ('TEAMS_VIEW', 'View teams'),
  ('TEAMS_MANAGE', 'Create and manage teams'),

  ('LEAD_SOURCES_VIEW', 'View lead sources'),
  ('LEAD_SOURCES_MANAGE', 'Create and manage lead sources'),

  ('LEADS_VIEW', 'View leads'),
  ('LEADS_MANAGE', 'Create, update and delete leads'),

  ('CONTACTS_VIEW', 'View contacts'),
  ('CONTACTS_MANAGE', 'Create, update and delete contacts'),

  ('COMPANIES_VIEW', 'View companies'),
  ('COMPANIES_MANAGE', 'Create, update and delete companies'),

  ('PIPELINES_VIEW', 'View pipelines and stages'),
  ('PIPELINES_MANAGE', 'Create and manage pipelines and stages'),

  ('DEALS_VIEW', 'View deals'),
  ('DEALS_MANAGE', 'Create, update and delete deals'),

  ('ACTIVITIES_VIEW', 'View activities'),
  ('ACTIVITIES_MANAGE', 'Create, update and delete activities'),

  ('TASKS_VIEW', 'View tasks'),
  ('TASKS_MANAGE', 'Create, update and delete tasks'),

  ('PRODUCTS_VIEW', 'View products'),
  ('PRODUCTS_MANAGE', 'Create, update and delete products'),

  ('TAGS_VIEW', 'View tags'),
  ('TAGS_MANAGE', 'Create and manage tags'),

  ('CUSTOM_FIELDS_VIEW', 'View custom field definitions'),
  ('CUSTOM_FIELDS_MANAGE', 'Create and manage custom field definitions'),

  ('AUTOMATIONS_VIEW', 'View automation rules'),
  ('AUTOMATIONS_MANAGE', 'Create and manage automation rules'),

  ('AUDIT_VIEW', 'View audit logs')

on conflict (code)
do update set
  description = excluded.description;


-- =========================================================
-- 2. SECURITY HELPER FUNCTIONS
--
-- IMPORTANT:
-- These functions live in private schema.
-- They are NOT exposed through Data API.
-- =========================================================


-- ---------------------------------------------------------
-- Is current Auth user an ACTIVE member of workspace?
-- ---------------------------------------------------------

create or replace function private.is_workspace_member(
  p_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'ACTIVE'
  );
$$;


-- ---------------------------------------------------------
-- Does current Auth user have permission in workspace?
-- ---------------------------------------------------------

create or replace function private.has_permission(
  p_workspace_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members wm

    join public.roles r
      on r.id = wm.role_id
      and r.workspace_id = wm.workspace_id

    join public.role_permissions rp
      on rp.role_id = r.id

    join public.permissions p
      on p.id = rp.permission_id

    where wm.workspace_id = p_workspace_id
      and wm.user_id = (select auth.uid())
      and wm.status = 'ACTIVE'
      and p.code = p_permission_code
  );
$$;


-- ---------------------------------------------------------
-- Check permission for a Role's workspace.
--
-- Needed because role_permissions does not contain
-- workspace_id directly.
-- ---------------------------------------------------------

create or replace function private.has_role_scope(
  p_role_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.roles r
    where r.id = p_role_id
      and private.has_permission(
        r.workspace_id,
        p_permission_code
      )
  );
$$;


-- ---------------------------------------------------------
-- Can current user view target profile?
--
-- User can always see own profile.
-- Other profiles require MEMBERS_VIEW in at least one
-- shared workspace.
-- ---------------------------------------------------------

create or replace function private.can_view_profile(
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_target_user_id = (select auth.uid())

    or exists (
      select 1
      from public.workspace_members target_member

      where target_member.user_id = p_target_user_id
        and target_member.status = 'ACTIVE'

        and private.has_permission(
          target_member.workspace_id,
          'MEMBERS_VIEW'
        )
    );
$$;


-- =========================================================
-- 3. LOCK DOWN HELPER FUNCTIONS
-- =========================================================

revoke all
on function private.is_workspace_member(uuid)
from public;

revoke all
on function private.has_permission(uuid, text)
from public;

revoke all
on function private.has_role_scope(uuid, text)
from public;

revoke all
on function private.can_view_profile(uuid)
from public;


grant usage
on schema private
to authenticated;


grant execute
on function private.is_workspace_member(uuid)
to authenticated;

grant execute
on function private.has_permission(uuid, text)
to authenticated;

grant execute
on function private.has_role_scope(uuid, text)
to authenticated;

grant execute
on function private.can_view_profile(uuid)
to authenticated;


-- =========================================================
-- 4. RESET PUBLIC API GRANTS
--
-- Start from deny-by-default.
-- =========================================================

revoke all privileges
on table

  public.profiles,
  public.workspaces,
  public.roles,
  public.permissions,
  public.role_permissions,
  public.workspace_members,
  public.teams,
  public.team_members,

  public.lead_sources,
  public.leads,
  public.contacts,
  public.companies,
  public.company_contacts,

  public.pipelines,
  public.stages,
  public.deals,
  public.activities,
  public.tasks,

  public.products,
  public.deal_items,

  public.tags,
  public.lead_tags,
  public.contact_tags,
  public.company_tags,
  public.deal_tags,

  public.custom_fields,
  public.custom_field_values,

  public.notifications,
  public.automation_rules,
  public.audit_logs

from anon, authenticated;


-- =========================================================
-- 5. SAFE AUTHENTICATED GRANTS
-- =========================================================


-- ---------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------

grant select
on public.profiles
to authenticated;


grant insert (
  id,
  full_name,
  avatar_url,
  phone
)
on public.profiles
to authenticated;


grant update (
  full_name,
  avatar_url,
  phone
)
on public.profiles
to authenticated;


-- ---------------------------------------------------------
-- Workspace
--
-- Workspace creation/deletion will later go through a
-- secure onboarding/admin RPC.
-- ---------------------------------------------------------

grant select
on public.workspaces
to authenticated;


grant update (
  name,
  slug,
  logo_url,
  timezone,
  currency,
  language
)
on public.workspaces
to authenticated;


-- ---------------------------------------------------------
-- Sensitive RBAC tables
--
-- Read allowed by RLS.
--
-- Direct writes intentionally NOT granted.
-- Member/Role mutations will later use secure RPCs to avoid
-- privilege escalation such as Admin assigning Owner.
-- ---------------------------------------------------------

grant select
on public.roles
to authenticated;

grant select
on public.permissions
to authenticated;

grant select
on public.role_permissions
to authenticated;

grant select
on public.workspace_members
to authenticated;


-- ---------------------------------------------------------
-- Standard tenant CRUD
-- ---------------------------------------------------------

grant select, insert, update, delete
on table

  public.teams,
  public.team_members,

  public.lead_sources,
  public.leads,
  public.contacts,
  public.companies,
  public.company_contacts,

  public.pipelines,
  public.stages,
  public.deals,
  public.activities,
  public.tasks,

  public.products,
  public.deal_items,

  public.tags,
  public.lead_tags,
  public.contact_tags,
  public.company_tags,
  public.deal_tags,

  public.custom_fields,
  public.custom_field_values,

  public.automation_rules

to authenticated;


-- ---------------------------------------------------------
-- Notifications
--
-- User can read notifications and only modify read state.
-- ---------------------------------------------------------

grant select
on public.notifications
to authenticated;


grant update (
  is_read,
  read_at
)
on public.notifications
to authenticated;


-- ---------------------------------------------------------
-- Audit logs
--
-- Client can NEVER insert/update/delete Audit Logs.
-- ---------------------------------------------------------

grant select
on public.audit_logs
to authenticated;


-- =========================================================
-- 6. PROFILES RLS
-- =========================================================

create policy "profiles_select_allowed"
on public.profiles
for select
to authenticated
using (
  private.can_view_profile(id)
);


create policy "profiles_insert_self"
on public.profiles
for insert
to authenticated
with check (
  id = (select auth.uid())
);


create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);


-- =========================================================
-- 7. WORKSPACE RLS
-- =========================================================

create policy "workspaces_select_member"
on public.workspaces
for select
to authenticated
using (
  private.is_workspace_member(id)
);


create policy "workspaces_update_authorized"
on public.workspaces
for update
to authenticated
using (
  private.has_permission(
    id,
    'WORKSPACE_UPDATE'
  )
)
with check (
  private.has_permission(
    id,
    'WORKSPACE_UPDATE'
  )
);


-- =========================================================
-- 8. PERMISSIONS / ROLES / MEMBERS
-- =========================================================


-- Global permission definitions are safe for signed-in users
-- to read.

create policy "permissions_select_authenticated"
on public.permissions
for select
to authenticated
using (true);


create policy "roles_select_authorized"
on public.roles
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'ROLES_VIEW'
  )
);


create policy "role_permissions_select_authorized"
on public.role_permissions
for select
to authenticated
using (
  private.has_role_scope(
    role_id,
    'ROLES_VIEW'
  )
);


create policy "workspace_members_select_authorized"
on public.workspace_members
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'MEMBERS_VIEW'
  )
);


-- =========================================================
-- 9. TEAMS
-- =========================================================

create policy "teams_select_authorized"
on public.teams
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TEAMS_VIEW'
  )
);


create policy "teams_manage_authorized"
on public.teams
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TEAMS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'TEAMS_MANAGE'
  )
);


create policy "team_members_select_authorized"
on public.team_members
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TEAMS_VIEW'
  )
);


create policy "team_members_manage_authorized"
on public.team_members
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TEAMS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'TEAMS_MANAGE'
  )
);


-- =========================================================
-- 10. LEAD SOURCES
-- =========================================================

create policy "lead_sources_select_authorized"
on public.lead_sources
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEAD_SOURCES_VIEW'
  )
);


create policy "lead_sources_manage_authorized"
on public.lead_sources
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEAD_SOURCES_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'LEAD_SOURCES_MANAGE'
  )
);


-- =========================================================
-- 11. LEADS
-- =========================================================

create policy "leads_select_authorized"
on public.leads
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEADS_VIEW'
  )
);


create policy "leads_manage_authorized"
on public.leads
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEADS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'LEADS_MANAGE'
  )
);


-- =========================================================
-- 12. CONTACTS
-- =========================================================

create policy "contacts_select_authorized"
on public.contacts
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CONTACTS_VIEW'
  )
);


create policy "contacts_manage_authorized"
on public.contacts
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
);


-- =========================================================
-- 13. COMPANIES
-- =========================================================

create policy "companies_select_authorized"
on public.companies
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_VIEW'
  )
);


create policy "companies_manage_authorized"
on public.companies
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )
);


-- =========================================================
-- 14. COMPANY CONTACTS
-- =========================================================

create policy "company_contacts_select_authorized"
on public.company_contacts
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_VIEW'
  )

  and

  private.has_permission(
    workspace_id,
    'CONTACTS_VIEW'
  )
);


create policy "company_contacts_manage_authorized"
on public.company_contacts
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )

  and

  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )

  and

  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
);


-- =========================================================
-- 15. PIPELINES + STAGES
-- =========================================================

create policy "pipelines_select_authorized"
on public.pipelines
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PIPELINES_VIEW'
  )
);


create policy "pipelines_manage_authorized"
on public.pipelines
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PIPELINES_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'PIPELINES_MANAGE'
  )
);


create policy "stages_select_authorized"
on public.stages
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PIPELINES_VIEW'
  )
);


create policy "stages_manage_authorized"
on public.stages
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PIPELINES_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'PIPELINES_MANAGE'
  )
);


-- =========================================================
-- 16. DEALS
-- =========================================================

create policy "deals_select_authorized"
on public.deals
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_VIEW'
  )
);


create policy "deals_manage_authorized"
on public.deals
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
);


-- =========================================================
-- 17. ACTIVITIES
-- =========================================================

create policy "activities_select_authorized"
on public.activities
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'ACTIVITIES_VIEW'
  )
);


create policy "activities_manage_authorized"
on public.activities
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'ACTIVITIES_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'ACTIVITIES_MANAGE'
  )
);


-- =========================================================
-- 18. TASKS
-- =========================================================

create policy "tasks_select_authorized"
on public.tasks
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TASKS_VIEW'
  )
);


create policy "tasks_manage_authorized"
on public.tasks
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TASKS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'TASKS_MANAGE'
  )
);


-- =========================================================
-- 19. PRODUCTS
-- =========================================================

create policy "products_select_authorized"
on public.products
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PRODUCTS_VIEW'
  )
);


create policy "products_manage_authorized"
on public.products
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'PRODUCTS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'PRODUCTS_MANAGE'
  )
);


-- =========================================================
-- 20. DEAL ITEMS
-- =========================================================

create policy "deal_items_select_authorized"
on public.deal_items
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_VIEW'
  )
);


create policy "deal_items_manage_authorized"
on public.deal_items
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
);


-- =========================================================
-- 21. TAG DEFINITIONS
-- =========================================================

create policy "tags_select_authorized"
on public.tags
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


create policy "tags_manage_authorized"
on public.tags
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'TAGS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'TAGS_MANAGE'
  )
);


-- =========================================================
-- 22. LEAD TAGS
-- =========================================================

create policy "lead_tags_select_authorized"
on public.lead_tags
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEADS_VIEW'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


create policy "lead_tags_manage_authorized"
on public.lead_tags
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'LEADS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'LEADS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


-- =========================================================
-- 23. CONTACT TAGS
-- =========================================================

create policy "contact_tags_select_authorized"
on public.contact_tags
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CONTACTS_VIEW'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


create policy "contact_tags_manage_authorized"
on public.contact_tags
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'CONTACTS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


-- =========================================================
-- 24. COMPANY TAGS
-- =========================================================

create policy "company_tags_select_authorized"
on public.company_tags
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_VIEW'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


create policy "company_tags_manage_authorized"
on public.company_tags
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'COMPANIES_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


-- =========================================================
-- 25. DEAL TAGS
-- =========================================================

create policy "deal_tags_select_authorized"
on public.deal_tags
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_VIEW'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


create policy "deal_tags_manage_authorized"
on public.deal_tags
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'DEALS_MANAGE'
  )
  and
  private.has_permission(
    workspace_id,
    'TAGS_VIEW'
  )
);


-- =========================================================
-- 26. CUSTOM FIELD DEFINITIONS
-- =========================================================

create policy "custom_fields_select_authorized"
on public.custom_fields
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_VIEW'
  )
);


create policy "custom_fields_manage_authorized"
on public.custom_fields
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_MANAGE'
  )
);


-- =========================================================
-- 27. CUSTOM FIELD VALUES
--
-- Prevent a user with Custom Field permission from using the
-- polymorphic values table to bypass entity permissions.
-- =========================================================

create policy "custom_field_values_select_authorized"
on public.custom_field_values
for select
to authenticated
using (

  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_VIEW'
  )

  and

  (
    (
      entity_type = 'LEAD'
      and private.has_permission(
        workspace_id,
        'LEADS_VIEW'
      )
    )

    or

    (
      entity_type = 'CONTACT'
      and private.has_permission(
        workspace_id,
        'CONTACTS_VIEW'
      )
    )

    or

    (
      entity_type = 'COMPANY'
      and private.has_permission(
        workspace_id,
        'COMPANIES_VIEW'
      )
    )

    or

    (
      entity_type = 'DEAL'
      and private.has_permission(
        workspace_id,
        'DEALS_VIEW'
      )
    )

    or

    (
      entity_type = 'TASK'
      and private.has_permission(
        workspace_id,
        'TASKS_VIEW'
      )
    )
  )
);


create policy "custom_field_values_manage_authorized"
on public.custom_field_values
for all
to authenticated
using (

  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_VIEW'
  )

  and

  (
    (
      entity_type = 'LEAD'
      and private.has_permission(
        workspace_id,
        'LEADS_MANAGE'
      )
    )

    or

    (
      entity_type = 'CONTACT'
      and private.has_permission(
        workspace_id,
        'CONTACTS_MANAGE'
      )
    )

    or

    (
      entity_type = 'COMPANY'
      and private.has_permission(
        workspace_id,
        'COMPANIES_MANAGE'
      )
    )

    or

    (
      entity_type = 'DEAL'
      and private.has_permission(
        workspace_id,
        'DEALS_MANAGE'
      )
    )

    or

    (
      entity_type = 'TASK'
      and private.has_permission(
        workspace_id,
        'TASKS_MANAGE'
      )
    )
  )
)

with check (

  private.has_permission(
    workspace_id,
    'CUSTOM_FIELDS_VIEW'
  )

  and

  (
    (
      entity_type = 'LEAD'
      and private.has_permission(
        workspace_id,
        'LEADS_MANAGE'
      )
    )

    or

    (
      entity_type = 'CONTACT'
      and private.has_permission(
        workspace_id,
        'CONTACTS_MANAGE'
      )
    )

    or

    (
      entity_type = 'COMPANY'
      and private.has_permission(
        workspace_id,
        'COMPANIES_MANAGE'
      )
    )

    or

    (
      entity_type = 'DEAL'
      and private.has_permission(
        workspace_id,
        'DEALS_MANAGE'
      )
    )

    or

    (
      entity_type = 'TASK'
      and private.has_permission(
        workspace_id,
        'TASKS_MANAGE'
      )
    )
  )
);


-- =========================================================
-- 28. NOTIFICATIONS
-- =========================================================

create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);


create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
)
with check (
  user_id = (select auth.uid())
  and private.is_workspace_member(workspace_id)
);


-- =========================================================
-- 29. AUTOMATION RULES
-- =========================================================

create policy "automation_rules_select_authorized"
on public.automation_rules
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'AUTOMATIONS_VIEW'
  )
);


create policy "automation_rules_manage_authorized"
on public.automation_rules
for all
to authenticated
using (
  private.has_permission(
    workspace_id,
    'AUTOMATIONS_MANAGE'
  )
)
with check (
  private.has_permission(
    workspace_id,
    'AUTOMATIONS_MANAGE'
  )
);


-- =========================================================
-- 30. AUDIT LOGS
--
-- Read-only from normal authenticated client.
-- Writes happen through trusted server/database logic.
-- =========================================================

create policy "audit_logs_select_authorized"
on public.audit_logs
for select
to authenticated
using (
  private.has_permission(
    workspace_id,
    'AUDIT_VIEW'
  )
);


commit;