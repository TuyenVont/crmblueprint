begin;

-- =========================================================
-- 002 CRM CORE
-- =========================================================


-- =========================================================
-- LEAD SOURCES
-- Dynamic per workspace. Do not hard-code source names.
-- =========================================================

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint lead_sources_name_not_empty
    check (length(trim(name)) > 0),

  -- Allows other tables to enforce same-workspace FK.
  constraint lead_sources_workspace_id_id_unique
    unique (workspace_id, id)
);

-- Avoid "Facebook" + "facebook" duplicates in one workspace.
create unique index lead_sources_workspace_name_ci_unique
  on public.lead_sources (
    workspace_id,
    lower(name)
  );


-- =========================================================
-- CONTACTS
-- =========================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  first_name text not null,
  last_name text,

  phone text,
  email text,
  birthday date,
  address text,

  source_id uuid,
  owner_user_id uuid,

  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contacts_first_name_not_empty
    check (length(trim(first_name)) > 0),

  constraint contacts_workspace_id_id_unique
    unique (workspace_id, id),

  constraint contacts_source_same_workspace_fk
    foreign key (workspace_id, source_id)
    references public.lead_sources(workspace_id, id)
    on delete restrict,

  constraint contacts_owner_same_workspace_fk
    foreign key (workspace_id, owner_user_id)
    references public.workspace_members(workspace_id, user_id)
    deferrable initially deferred
);


-- =========================================================
-- COMPANIES
-- =========================================================

create table public.companies (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,

  tax_id text,
  phone text,
  email text,
  website text,
  address text,
  industry text,
  size text,

  owner_user_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint companies_name_not_empty
    check (length(trim(name)) > 0),

  constraint companies_workspace_id_id_unique
    unique (workspace_id, id),

  constraint companies_owner_same_workspace_fk
    foreign key (workspace_id, owner_user_id)
    references public.workspace_members(workspace_id, user_id)
    deferrable initially deferred
);


-- =========================================================
-- COMPANY CONTACTS
--
-- workspace_id is intentionally stored here.
-- This prevents linking:
--
-- Company from Workspace A
--      +
-- Contact from Workspace B
-- =========================================================

create table public.company_contacts (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  company_id uuid not null,
  contact_id uuid not null,

  job_title text,
  is_primary boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_contacts_company_same_workspace_fk
    foreign key (workspace_id, company_id)
    references public.companies(workspace_id, id)
    on delete cascade,

  constraint company_contacts_contact_same_workspace_fk
    foreign key (workspace_id, contact_id)
    references public.contacts(workspace_id, id)
    on delete cascade,

  constraint company_contacts_company_contact_unique
    unique (
      workspace_id,
      company_id,
      contact_id
    )
);


-- =========================================================
-- LEADS
-- =========================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  first_name text not null,
  last_name text,

  phone text,
  email text,

  company_name text,

  source_id uuid,

  status text not null default 'NEW',

  owner_user_id uuid,

  notes text,

  converted_at timestamptz,
  converted_contact_id uuid,
  converted_company_id uuid,

  -- Deal table is created in migration 003.
  -- FK will be added there.
  converted_deal_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint leads_first_name_not_empty
    check (length(trim(first_name)) > 0),

  constraint leads_status_check
    check (
      status in (
        'NEW',
        'ASSIGNED',
        'CONTACTED',
        'QUALIFIED',
        'CONVERTED',
        'UNQUALIFIED'
      )
    ),

  constraint leads_conversion_status_check
    check (
      (
        status = 'CONVERTED'
        and converted_at is not null
      )
      or
      (
        status <> 'CONVERTED'
        and converted_at is null
      )
    ),

  constraint leads_workspace_id_id_unique
    unique (workspace_id, id),

  constraint leads_source_same_workspace_fk
    foreign key (workspace_id, source_id)
    references public.lead_sources(workspace_id, id)
    on delete restrict,

  constraint leads_owner_same_workspace_fk
    foreign key (workspace_id, owner_user_id)
    references public.workspace_members(workspace_id, user_id)
    deferrable initially deferred,

  constraint leads_converted_contact_same_workspace_fk
    foreign key (
      workspace_id,
      converted_contact_id
    )
    references public.contacts(workspace_id, id)
    deferrable initially deferred,

  constraint leads_converted_company_same_workspace_fk
    foreign key (
      workspace_id,
      converted_company_id
    )
    references public.companies(workspace_id, id)
    deferrable initially deferred
);


comment on column public.leads.converted_deal_id is
  'Deal created during Lead Conversion. FK is added in migration 003 after deals table exists.';


-- =========================================================
-- INDEXES
-- =========================================================

create index lead_sources_workspace_active_idx
  on public.lead_sources (
    workspace_id,
    is_active
  );


create index contacts_workspace_owner_idx
  on public.contacts (
    workspace_id,
    owner_user_id
  );


create index contacts_workspace_source_idx
  on public.contacts (
    workspace_id,
    source_id
  );


create index contacts_workspace_email_idx
  on public.contacts (
    workspace_id,
    email
  );


create index contacts_workspace_phone_idx
  on public.contacts (
    workspace_id,
    phone
  );


create index companies_workspace_owner_idx
  on public.companies (
    workspace_id,
    owner_user_id
  );


create index companies_workspace_name_idx
  on public.companies (
    workspace_id,
    name
  );


create index companies_workspace_tax_id_idx
  on public.companies (
    workspace_id,
    tax_id
  );


create index company_contacts_workspace_company_idx
  on public.company_contacts (
    workspace_id,
    company_id
  );


create index company_contacts_workspace_contact_idx
  on public.company_contacts (
    workspace_id,
    contact_id
  );


create index leads_workspace_status_idx
  on public.leads (
    workspace_id,
    status
  );


create index leads_workspace_owner_idx
  on public.leads (
    workspace_id,
    owner_user_id
  );


create index leads_workspace_source_idx
  on public.leads (
    workspace_id,
    source_id
  );


create index leads_workspace_email_idx
  on public.leads (
    workspace_id,
    email
  );


create index leads_workspace_phone_idx
  on public.leads (
    workspace_id,
    phone
  );


create index leads_workspace_created_at_idx
  on public.leads (
    workspace_id,
    created_at desc
  );


-- =========================================================
-- UPDATED_AT TRIGGERS
-- Reuse private.set_updated_at() from migration 001.
-- =========================================================

create trigger lead_sources_set_updated_at
before update on public.lead_sources
for each row
execute function private.set_updated_at();


create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function private.set_updated_at();


create trigger companies_set_updated_at
before update on public.companies
for each row
execute function private.set_updated_at();


create trigger company_contacts_set_updated_at
before update on public.company_contacts
for each row
execute function private.set_updated_at();


create trigger leads_set_updated_at
before update on public.leads
for each row
execute function private.set_updated_at();


-- =========================================================
-- SECURITY BASELINE
--
-- RLS ON immediately.
-- No policies yet.
-- Therefore application access remains deny-by-default
-- until migration 005.
-- =========================================================

alter table public.lead_sources
  enable row level security;

alter table public.contacts
  enable row level security;

alter table public.companies
  enable row level security;

alter table public.company_contacts
  enable row level security;

alter table public.leads
  enable row level security;


revoke all privileges
on table public.lead_sources
from anon, authenticated;

revoke all privileges
on table public.contacts
from anon, authenticated;

revoke all privileges
on table public.companies
from anon, authenticated;

revoke all privileges
on table public.company_contacts
from anon, authenticated;

revoke all privileges
on table public.leads
from anon, authenticated;


commit;