begin;

-- =========================================================
-- 003 SALES CORE
-- =========================================================


-- =========================================================
-- PIPELINES
-- =========================================================

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  is_default boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint pipelines_name_not_empty
    check (length(trim(name)) > 0),

  constraint pipelines_workspace_id_id_unique
    unique (workspace_id, id)
);


-- Pipeline names should not duplicate inside one workspace.
create unique index pipelines_workspace_name_ci_unique
  on public.pipelines (
    workspace_id,
    lower(name)
  );


-- Only one default pipeline per workspace.
create unique index pipelines_one_default_per_workspace
  on public.pipelines (workspace_id)
  where is_default = true;


-- =========================================================
-- STAGES
--
-- Stage names are configurable.
-- WON / LOST must be determined by type, never by name.
-- =========================================================

create table public.stages (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  pipeline_id uuid not null,

  name text not null,
  position integer not null,

  type text not null default 'OPEN',

  color text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stages_name_not_empty
    check (length(trim(name)) > 0),

  constraint stages_position_non_negative
    check (position >= 0),

  constraint stages_type_check
    check (
      type in (
        'OPEN',
        'WON',
        'LOST'
      )
    ),

  constraint stages_pipeline_same_workspace_fk
    foreign key (workspace_id, pipeline_id)
    references public.pipelines(workspace_id, id)
    on delete cascade,

  -- Used by deals to guarantee:
  -- stage belongs to the selected pipeline + workspace.
  constraint stages_workspace_pipeline_id_unique
    unique (
      workspace_id,
      pipeline_id,
      id
    ),

  constraint stages_workspace_pipeline_position_unique
    unique (
      workspace_id,
      pipeline_id,
      position
    )
);


create unique index stages_pipeline_name_ci_unique
  on public.stages (
    workspace_id,
    pipeline_id,
    lower(name)
  );


-- =========================================================
-- DEALS
-- =========================================================

create table public.deals (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,

  amount numeric not null default 0,
  currency text not null,

  pipeline_id uuid not null,
  stage_id uuid not null,

  owner_user_id uuid,

  contact_id uuid,
  company_id uuid,
  source_id uuid,

  expected_close_date date,

  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deals_name_not_empty
    check (length(trim(name)) > 0),

  constraint deals_amount_non_negative
    check (amount >= 0),

  constraint deals_currency_not_empty
    check (length(trim(currency)) > 0),

  constraint deals_not_won_and_lost
    check (
      not (
        won_at is not null
        and lost_at is not null
      )
    ),

  constraint deals_lost_reason_requires_lost_at
    check (
      lost_reason is null
      or lost_at is not null
    ),

  constraint deals_workspace_id_id_unique
    unique (workspace_id, id),

  constraint deals_pipeline_same_workspace_fk
    foreign key (workspace_id, pipeline_id)
    references public.pipelines(workspace_id, id)
    on delete restrict,

  -- Very important:
  -- prevents using a stage from another pipeline.
  constraint deals_stage_same_pipeline_workspace_fk
    foreign key (
      workspace_id,
      pipeline_id,
      stage_id
    )
    references public.stages(
      workspace_id,
      pipeline_id,
      id
    )
    on delete restrict,

  constraint deals_owner_same_workspace_fk
    foreign key (
      workspace_id,
      owner_user_id
    )
    references public.workspace_members(
      workspace_id,
      user_id
    )
    deferrable initially deferred,

  constraint deals_contact_same_workspace_fk
    foreign key (
      workspace_id,
      contact_id
    )
    references public.contacts(
      workspace_id,
      id
    )
    on delete restrict,

  constraint deals_company_same_workspace_fk
    foreign key (
      workspace_id,
      company_id
    )
    references public.companies(
      workspace_id,
      id
    )
    on delete restrict,

  constraint deals_source_same_workspace_fk
    foreign key (
      workspace_id,
      source_id
    )
    references public.lead_sources(
      workspace_id,
      id
    )
    on delete restrict
);


-- =========================================================
-- COMPLETE LEAD -> DEAL RELATION
--
-- Migration 002 created converted_deal_id before deals existed.
-- We can now add the real FK.
-- =========================================================

alter table public.leads
add constraint leads_converted_deal_same_workspace_fk
foreign key (
  workspace_id,
  converted_deal_id
)
references public.deals(
  workspace_id,
  id
)
deferrable initially deferred;


-- =========================================================
-- ACTIVITIES
--
-- Used for CRM Timeline.
-- =========================================================

create table public.activities (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  type text not null,

  title text,
  content text,

  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  deal_id uuid,

  created_by uuid not null,

  activity_at timestamptz not null default now(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint activities_type_check
    check (
      type in (
        'CALL',
        'EMAIL',
        'MEETING',
        'NOTE',
        'TASK',
        'SMS',
        'MESSAGE',
        'FILE',
        'SYSTEM'
      )
    ),

  constraint activities_creator_same_workspace_fk
    foreign key (
      workspace_id,
      created_by
    )
    references public.workspace_members(
      workspace_id,
      user_id
    )
    on delete restrict,

  constraint activities_lead_same_workspace_fk
    foreign key (
      workspace_id,
      lead_id
    )
    references public.leads(
      workspace_id,
      id
    )
    on delete restrict,

  constraint activities_contact_same_workspace_fk
    foreign key (
      workspace_id,
      contact_id
    )
    references public.contacts(
      workspace_id,
      id
    )
    on delete restrict,

  constraint activities_company_same_workspace_fk
    foreign key (
      workspace_id,
      company_id
    )
    references public.companies(
      workspace_id,
      id
    )
    on delete restrict,

  constraint activities_deal_same_workspace_fk
    foreign key (
      workspace_id,
      deal_id
    )
    references public.deals(
      workspace_id,
      id
    )
    on delete restrict
);


-- =========================================================
-- TASKS
-- =========================================================

create table public.tasks (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  title text not null,
  description text,

  assignee_user_id uuid,
  created_by uuid not null,

  deadline timestamptz,

  priority text not null default 'NORMAL',
  status text not null default 'TODO',

  lead_id uuid,
  contact_id uuid,
  company_id uuid,
  deal_id uuid,

  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_title_not_empty
    check (length(trim(title)) > 0),

  constraint tasks_priority_check
    check (
      priority in (
        'LOW',
        'NORMAL',
        'HIGH',
        'URGENT'
      )
    ),

  constraint tasks_status_check
    check (
      status in (
        'TODO',
        'IN_PROGRESS',
        'DONE',
        'CANCELLED'
      )
    ),

  constraint tasks_completed_status_check
    check (
      (
        status = 'DONE'
        and completed_at is not null
      )
      or
      (
        status <> 'DONE'
        and completed_at is null
      )
    ),

  constraint tasks_creator_same_workspace_fk
    foreign key (
      workspace_id,
      created_by
    )
    references public.workspace_members(
      workspace_id,
      user_id
    )
    on delete restrict,

  constraint tasks_assignee_same_workspace_fk
    foreign key (
      workspace_id,
      assignee_user_id
    )
    references public.workspace_members(
      workspace_id,
      user_id
    )
    on delete restrict,

  constraint tasks_lead_same_workspace_fk
    foreign key (
      workspace_id,
      lead_id
    )
    references public.leads(
      workspace_id,
      id
    )
    on delete restrict,

  constraint tasks_contact_same_workspace_fk
    foreign key (
      workspace_id,
      contact_id
    )
    references public.contacts(
      workspace_id,
      id
    )
    on delete restrict,

  constraint tasks_company_same_workspace_fk
    foreign key (
      workspace_id,
      company_id
    )
    references public.companies(
      workspace_id,
      id
    )
    on delete restrict,

  constraint tasks_deal_same_workspace_fk
    foreign key (
      workspace_id,
      deal_id
    )
    references public.deals(
      workspace_id,
      id
    )
    on delete restrict
);


-- =========================================================
-- INDEXES
-- =========================================================

create index pipelines_workspace_idx
  on public.pipelines(workspace_id);


create index stages_workspace_pipeline_position_idx
  on public.stages(
    workspace_id,
    pipeline_id,
    position
  );


create index deals_workspace_stage_idx
  on public.deals(
    workspace_id,
    stage_id
  );


create index deals_workspace_pipeline_idx
  on public.deals(
    workspace_id,
    pipeline_id
  );


create index deals_workspace_owner_idx
  on public.deals(
    workspace_id,
    owner_user_id
  );


create index deals_workspace_contact_idx
  on public.deals(
    workspace_id,
    contact_id
  );


create index deals_workspace_company_idx
  on public.deals(
    workspace_id,
    company_id
  );


create index deals_workspace_created_at_idx
  on public.deals(
    workspace_id,
    created_at desc
  );


create index activities_workspace_activity_at_idx
  on public.activities(
    workspace_id,
    activity_at desc
  );


create index activities_workspace_lead_idx
  on public.activities(
    workspace_id,
    lead_id
  );


create index activities_workspace_contact_idx
  on public.activities(
    workspace_id,
    contact_id
  );


create index activities_workspace_company_idx
  on public.activities(
    workspace_id,
    company_id
  );


create index activities_workspace_deal_idx
  on public.activities(
    workspace_id,
    deal_id
  );


create index tasks_workspace_assignee_status_idx
  on public.tasks(
    workspace_id,
    assignee_user_id,
    status
  );


create index tasks_workspace_deadline_idx
  on public.tasks(
    workspace_id,
    deadline
  );


create index tasks_workspace_lead_idx
  on public.tasks(
    workspace_id,
    lead_id
  );


create index tasks_workspace_contact_idx
  on public.tasks(
    workspace_id,
    contact_id
  );


create index tasks_workspace_company_idx
  on public.tasks(
    workspace_id,
    company_id
  );


create index tasks_workspace_deal_idx
  on public.tasks(
    workspace_id,
    deal_id
  );


-- =========================================================
-- UPDATED_AT
-- =========================================================

create trigger pipelines_set_updated_at
before update on public.pipelines
for each row
execute function private.set_updated_at();


create trigger stages_set_updated_at
before update on public.stages
for each row
execute function private.set_updated_at();


create trigger deals_set_updated_at
before update on public.deals
for each row
execute function private.set_updated_at();


create trigger activities_set_updated_at
before update on public.activities
for each row
execute function private.set_updated_at();


create trigger tasks_set_updated_at
before update on public.tasks
for each row
execute function private.set_updated_at();


-- =========================================================
-- SECURITY BASELINE
-- =========================================================

alter table public.pipelines
  enable row level security;

alter table public.stages
  enable row level security;

alter table public.deals
  enable row level security;

alter table public.activities
  enable row level security;

alter table public.tasks
  enable row level security;


revoke all privileges
on table public.pipelines
from anon, authenticated;

revoke all privileges
on table public.stages
from anon, authenticated;

revoke all privileges
on table public.deals
from anon, authenticated;

revoke all privileges
on table public.activities
from anon, authenticated;

revoke all privileges
on table public.tasks
from anon, authenticated;


commit;