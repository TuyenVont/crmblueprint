begin;

-- =========================================================
-- 007 WORKSPACE ONBOARDING
--
-- Creates:
-- - Workspace
-- - Default system Roles
-- - Role permission mappings
-- - Creator as Owner
-- - Default Sales Pipeline
-- - Default Stages
--
-- All executed atomically through create_workspace().
-- =========================================================


-- =========================================================
-- CREATE WORKSPACE RPC
-- =========================================================

create or replace function public.create_workspace(
  p_name text,
  p_slug text,
  p_timezone text default 'Asia/Ho_Chi_Minh',
  p_currency text default 'VND',
  p_language text default 'vi'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare

  v_user_id uuid;

  v_workspace_id uuid;

  v_owner_role_id uuid;
  v_admin_role_id uuid;
  v_sales_manager_role_id uuid;
  v_sales_role_id uuid;
  v_cskh_role_id uuid;

  v_pipeline_id uuid;

begin

  -- =======================================================
  -- AUTH CHECK
  -- =======================================================

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;


  -- =======================================================
  -- VALIDATION
  -- =======================================================

  if p_name is null
     or length(trim(p_name)) < 2 then
    raise exception 'INVALID_WORKSPACE_NAME';
  end if;


  if p_slug is null
     or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'INVALID_WORKSPACE_SLUG';
  end if;


  if p_timezone is null
     or length(trim(p_timezone)) = 0 then
    raise exception 'INVALID_TIMEZONE';
  end if;


  if p_currency is null
     or length(trim(p_currency)) = 0 then
    raise exception 'INVALID_CURRENCY';
  end if;


  if p_language is null
     or length(trim(p_language)) = 0 then
    raise exception 'INVALID_LANGUAGE';
  end if;


  -- =======================================================
  -- CREATE WORKSPACE
  -- =======================================================

  insert into public.workspaces (
    name,
    slug,
    timezone,
    currency,
    language,
    created_by
  )
  values (
    trim(p_name),
    lower(trim(p_slug)),
    trim(p_timezone),
    upper(trim(p_currency)),
    lower(trim(p_language)),
    v_user_id
  )
  returning id
  into v_workspace_id;


  -- =======================================================
  -- CREATE SYSTEM ROLES
  -- =======================================================

  insert into public.roles (
    workspace_id,
    name,
    description,
    is_system
  )
  values (
    v_workspace_id,
    'Owner',
    'Workspace owner with full access',
    true
  )
  returning id
  into v_owner_role_id;


  insert into public.roles (
    workspace_id,
    name,
    description,
    is_system
  )
  values (
    v_workspace_id,
    'Admin',
    'Workspace administrator',
    true
  )
  returning id
  into v_admin_role_id;


  insert into public.roles (
    workspace_id,
    name,
    description,
    is_system
  )
  values (
    v_workspace_id,
    'Sales Manager',
    'Sales team manager',
    true
  )
  returning id
  into v_sales_manager_role_id;


  insert into public.roles (
    workspace_id,
    name,
    description,
    is_system
  )
  values (
    v_workspace_id,
    'Sales',
    'Sales representative',
    true
  )
  returning id
  into v_sales_role_id;


  insert into public.roles (
    workspace_id,
    name,
    description,
    is_system
  )
  values (
    v_workspace_id,
    'CSKH',
    'Customer service representative',
    true
  )
  returning id
  into v_cskh_role_id;


  -- =======================================================
  -- OWNER PERMISSIONS
  --
  -- Owner receives every permission.
  -- =======================================================

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_owner_role_id,
    p.id
  from public.permissions p;


  -- =======================================================
  -- ADMIN PERMISSIONS
  --
  -- Everything except deleting Workspace.
  -- =======================================================

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_admin_role_id,
    p.id
  from public.permissions p
  where p.code <> 'WORKSPACE_DELETE';


  -- =======================================================
  -- SALES MANAGER
  -- =======================================================

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_sales_manager_role_id,
    p.id
  from public.permissions p
  where p.code = any (
    array[
      'WORKSPACE_VIEW',

      'MEMBERS_VIEW',

      'TEAMS_VIEW',
      'TEAMS_MANAGE',

      'LEAD_SOURCES_VIEW',

      'LEADS_VIEW',
      'LEADS_MANAGE',

      'CONTACTS_VIEW',
      'CONTACTS_MANAGE',

      'COMPANIES_VIEW',
      'COMPANIES_MANAGE',

      'PIPELINES_VIEW',
      'PIPELINES_MANAGE',

      'DEALS_VIEW',
      'DEALS_MANAGE',

      'ACTIVITIES_VIEW',
      'ACTIVITIES_MANAGE',

      'TASKS_VIEW',
      'TASKS_MANAGE',

      'PRODUCTS_VIEW',

      'TAGS_VIEW',

      'CUSTOM_FIELDS_VIEW'
    ]
  );


  -- =======================================================
  -- SALES
  -- =======================================================

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_sales_role_id,
    p.id
  from public.permissions p
  where p.code = any (
    array[
      'WORKSPACE_VIEW',

      'TEAMS_VIEW',

      'LEAD_SOURCES_VIEW',

      'LEADS_VIEW',
      'LEADS_MANAGE',

      'CONTACTS_VIEW',
      'CONTACTS_MANAGE',

      'COMPANIES_VIEW',
      'COMPANIES_MANAGE',

      'PIPELINES_VIEW',

      'DEALS_VIEW',
      'DEALS_MANAGE',

      'ACTIVITIES_VIEW',
      'ACTIVITIES_MANAGE',

      'TASKS_VIEW',
      'TASKS_MANAGE',

      'PRODUCTS_VIEW',

      'TAGS_VIEW',

      'CUSTOM_FIELDS_VIEW'
    ]
  );


  -- =======================================================
  -- CSKH
  -- =======================================================

  insert into public.role_permissions (
    role_id,
    permission_id
  )
  select
    v_cskh_role_id,
    p.id
  from public.permissions p
  where p.code = any (
    array[
      'WORKSPACE_VIEW',

      'TEAMS_VIEW',

      'CONTACTS_VIEW',
      'CONTACTS_MANAGE',

      'COMPANIES_VIEW',

      'DEALS_VIEW',

      'ACTIVITIES_VIEW',
      'ACTIVITIES_MANAGE',

      'TASKS_VIEW',
      'TASKS_MANAGE',

      'PRODUCTS_VIEW',

      'TAGS_VIEW',

      'CUSTOM_FIELDS_VIEW'
    ]
  );


  -- =======================================================
  -- CREATOR BECOMES OWNER
  -- =======================================================

  insert into public.workspace_members (
    workspace_id,
    user_id,
    role_id,
    status
  )
  values (
    v_workspace_id,
    v_user_id,
    v_owner_role_id,
    'ACTIVE'
  );


  -- =======================================================
  -- DEFAULT PIPELINE
  -- =======================================================

  insert into public.pipelines (
    workspace_id,
    name,
    is_default
  )
  values (
    v_workspace_id,
    'Sales Pipeline',
    true
  )
  returning id
  into v_pipeline_id;


  -- =======================================================
  -- DEFAULT STAGES
  --
  -- Stage logic MUST use type,
  -- never stage name.
  -- =======================================================

  insert into public.stages (
    workspace_id,
    pipeline_id,
    name,
    position,
    type
  )
  values

    (
      v_workspace_id,
      v_pipeline_id,
      'New',
      0,
      'OPEN'
    ),

    (
      v_workspace_id,
      v_pipeline_id,
      'Qualification',
      1,
      'OPEN'
    ),

    (
      v_workspace_id,
      v_pipeline_id,
      'Proposal',
      2,
      'OPEN'
    ),

    (
      v_workspace_id,
      v_pipeline_id,
      'Negotiation',
      3,
      'OPEN'
    ),

    (
      v_workspace_id,
      v_pipeline_id,
      'Won',
      4,
      'WON'
    ),

    (
      v_workspace_id,
      v_pipeline_id,
      'Lost',
      5,
      'LOST'
    );


  -- =======================================================
  -- RETURN WORKSPACE ID
  -- =======================================================

  return v_workspace_id;

end;
$$;


-- =========================================================
-- RPC SECURITY
-- =========================================================

revoke all
on function public.create_workspace(
  text,
  text,
  text,
  text,
  text
)
from public;


revoke all
on function public.create_workspace(
  text,
  text,
  text,
  text,
  text
)
from anon;


grant execute
on function public.create_workspace(
  text,
  text,
  text,
  text,
  text
)
to authenticated;


commit;