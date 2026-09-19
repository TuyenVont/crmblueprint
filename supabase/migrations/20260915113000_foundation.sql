begin;

-- =========================================================
-- 001 FOUNDATION
-- =========================================================


-- =========================================================
-- PRIVATE SCHEMA
-- Used later for internal database helpers and RLS helpers.
-- =========================================================

create schema if not exists private;

revoke all on schema private from public;


-- =========================================================
-- UPDATED_AT HELPER
-- =========================================================

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- =========================================================
-- PROFILES
-- One profile per Supabase Auth user.
-- =========================================================

create table public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  full_name text not null,
  avatar_url text,
  phone text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);


-- =========================================================
-- WORKSPACES
-- Tenant root.
-- =========================================================

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  slug text not null unique,
  logo_url text,

  timezone text not null,
  currency text not null,
  language text not null,

  created_by uuid not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspaces_name_not_empty
    check (length(trim(name)) > 0),

  constraint workspaces_slug_format
    check (
      slug = lower(slug)
      and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    )
);


-- =========================================================
-- ROLES
-- Roles belong to one workspace.
-- =========================================================

create table public.roles (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  description text,

  is_system boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint roles_workspace_name_unique
    unique (workspace_id, name),

  -- Used by composite FK to enforce same-workspace relationships.
  constraint roles_workspace_id_id_unique
    unique (workspace_id, id)
);


-- =========================================================
-- PERMISSIONS
-- Global permission definitions.
-- Not owned by an individual workspace.
-- =========================================================

create table public.permissions (
  id uuid primary key default gen_random_uuid(),

  code text not null unique,
  description text not null,

  constraint permissions_code_format
    check (code ~ '^[A-Z][A-Z0-9_]*$')
);


-- =========================================================
-- ROLE PERMISSIONS
-- =========================================================

create table public.role_permissions (
  role_id uuid not null
    references public.roles(id)
    on delete cascade,

  permission_id uuid not null
    references public.permissions(id)
    on delete restrict,

  primary key (role_id, permission_id)
);


-- =========================================================
-- WORKSPACE MEMBERS
-- Connects Auth users to Workspaces and Roles.
-- =========================================================

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role_id uuid not null,

  status text not null default 'ACTIVE',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workspace_members_status_check
    check (
      status in (
        'ACTIVE',
        'INVITED',
        'DISABLED'
      )
    ),

  constraint workspace_members_workspace_user_unique
    unique (workspace_id, user_id),

  constraint workspace_members_workspace_id_id_unique
    unique (workspace_id, id),

  constraint workspace_members_role_same_workspace_fk
    foreign key (workspace_id, role_id)
    references public.roles(workspace_id, id)
    on delete restrict
);


-- =========================================================
-- TEAMS
-- =========================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint teams_workspace_name_unique
    unique (workspace_id, name),

  constraint teams_workspace_id_id_unique
    unique (workspace_id, id)
);


-- =========================================================
-- TEAM MEMBERS
-- workspace_id is intentionally stored here so PostgreSQL
-- itself can prevent cross-workspace membership mistakes.
-- =========================================================

create table public.team_members (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  team_id uuid not null,
  workspace_member_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    workspace_id,
    team_id,
    workspace_member_id
  ),

  constraint team_members_team_same_workspace_fk
    foreign key (workspace_id, team_id)
    references public.teams(workspace_id, id)
    on delete cascade,

  constraint team_members_member_same_workspace_fk
    foreign key (workspace_id, workspace_member_id)
    references public.workspace_members(workspace_id, id)
    on delete cascade
);


-- =========================================================
-- INDEXES
-- =========================================================

create index workspaces_created_by_idx
  on public.workspaces(created_by);


create index workspace_members_user_id_idx
  on public.workspace_members(user_id);


create index workspace_members_workspace_role_idx
  on public.workspace_members(workspace_id, role_id);


create index role_permissions_permission_id_idx
  on public.role_permissions(permission_id);


create index team_members_workspace_member_idx
  on public.team_members(workspace_id, workspace_member_id);


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function private.set_updated_at();


create trigger workspaces_set_updated_at
before update on public.workspaces
for each row
execute function private.set_updated_at();


create trigger roles_set_updated_at
before update on public.roles
for each row
execute function private.set_updated_at();


create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row
execute function private.set_updated_at();


create trigger teams_set_updated_at
before update on public.teams
for each row
execute function private.set_updated_at();


-- =========================================================
-- SECURITY BASELINE
--
-- RLS is enabled now, but policies are intentionally NOT
-- created until migration 005.
--
-- Therefore these tables are deny-by-default.
-- =========================================================

alter table public.profiles
  enable row level security;

alter table public.workspaces
  enable row level security;

alter table public.roles
  enable row level security;

alter table public.permissions
  enable row level security;

alter table public.role_permissions
  enable row level security;

alter table public.workspace_members
  enable row level security;

alter table public.teams
  enable row level security;

alter table public.team_members
  enable row level security;


-- Remove accidental Data API access until migration 005
-- explicitly grants only the required privileges.

revoke all privileges
on table public.profiles
from anon, authenticated;

revoke all privileges
on table public.workspaces
from anon, authenticated;

revoke all privileges
on table public.roles
from anon, authenticated;

revoke all privileges
on table public.permissions
from anon, authenticated;

revoke all privileges
on table public.role_permissions
from anon, authenticated;

revoke all privileges
on table public.workspace_members
from anon, authenticated;

revoke all privileges
on table public.teams
from anon, authenticated;

revoke all privileges
on table public.team_members
from anon, authenticated;


commit;