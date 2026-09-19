begin;

-- =========================================================
-- 004 EXTENSIONS
-- Products
-- Deal Items
-- Tags
-- Custom Fields
-- Notifications
-- Automation
-- Audit Logs
-- =========================================================


-- =========================================================
-- PRODUCTS
-- Inventory quantity is NOT part of MVP.
-- =========================================================

create table public.products (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  sku text,

  image_url text,
  unit text,

  price numeric(18,2) not null default 0,
  currency text not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_name_not_empty
    check (length(trim(name)) > 0),

  constraint products_price_non_negative
    check (price >= 0),

  constraint products_currency_not_empty
    check (length(trim(currency)) > 0),

  constraint products_workspace_id_id_unique
    unique (workspace_id, id)
);


-- SKU unique inside one workspace when supplied.
create unique index products_workspace_sku_ci_unique
  on public.products (
    workspace_id,
    lower(sku)
  )
  where sku is not null
    and length(trim(sku)) > 0;


-- =========================================================
-- DEAL ITEMS
--
-- name_snapshot and price are stored independently from
-- Product so historical Deals do not change if Product
-- information is edited later.
--
-- discount and tax are MONEY AMOUNTS in MVP.
-- =========================================================

create table public.deal_items (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  deal_id uuid not null,
  product_id uuid,

  name_snapshot text not null,

  price numeric(18,2) not null,
  quantity numeric(18,4) not null default 1,

  discount numeric(18,2) not null default 0,
  tax numeric(18,2) not null default 0,

  total numeric(18,2)
    generated always as (
      round(
        (
          (price * quantity)
          - discount
          + tax
        )::numeric,
        2
      )
    ) stored,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint deal_items_name_snapshot_not_empty
    check (length(trim(name_snapshot)) > 0),

  constraint deal_items_price_non_negative
    check (price >= 0),

  constraint deal_items_quantity_positive
    check (quantity > 0),

  constraint deal_items_discount_non_negative
    check (discount >= 0),

  constraint deal_items_tax_non_negative
    check (tax >= 0),

  constraint deal_items_discount_not_over_subtotal
    check (
      discount <= (price * quantity)
    ),

  constraint deal_items_deal_same_workspace_fk
    foreign key (
      workspace_id,
      deal_id
    )
    references public.deals(
      workspace_id,
      id
    )
    on delete cascade,

  constraint deal_items_product_same_workspace_fk
    foreign key (
      workspace_id,
      product_id
    )
    references public.products(
      workspace_id,
      id
    )
    on delete restrict
);


-- =========================================================
-- TAGS
-- =========================================================

create table public.tags (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,
  color text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tags_name_not_empty
    check (length(trim(name)) > 0),

  constraint tags_workspace_id_id_unique
    unique (workspace_id, id)
);


create unique index tags_workspace_name_ci_unique
  on public.tags (
    workspace_id,
    lower(name)
  );


-- =========================================================
-- LEAD TAGS
-- =========================================================

create table public.lead_tags (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  lead_id uuid not null,
  tag_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    workspace_id,
    lead_id,
    tag_id
  ),

  constraint lead_tags_lead_same_workspace_fk
    foreign key (
      workspace_id,
      lead_id
    )
    references public.leads(
      workspace_id,
      id
    )
    on delete cascade,

  constraint lead_tags_tag_same_workspace_fk
    foreign key (
      workspace_id,
      tag_id
    )
    references public.tags(
      workspace_id,
      id
    )
    on delete cascade
);


-- =========================================================
-- CONTACT TAGS
-- =========================================================

create table public.contact_tags (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  contact_id uuid not null,
  tag_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    workspace_id,
    contact_id,
    tag_id
  ),

  constraint contact_tags_contact_same_workspace_fk
    foreign key (
      workspace_id,
      contact_id
    )
    references public.contacts(
      workspace_id,
      id
    )
    on delete cascade,

  constraint contact_tags_tag_same_workspace_fk
    foreign key (
      workspace_id,
      tag_id
    )
    references public.tags(
      workspace_id,
      id
    )
    on delete cascade
);


-- =========================================================
-- COMPANY TAGS
-- =========================================================

create table public.company_tags (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  company_id uuid not null,
  tag_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    workspace_id,
    company_id,
    tag_id
  ),

  constraint company_tags_company_same_workspace_fk
    foreign key (
      workspace_id,
      company_id
    )
    references public.companies(
      workspace_id,
      id
    )
    on delete cascade,

  constraint company_tags_tag_same_workspace_fk
    foreign key (
      workspace_id,
      tag_id
    )
    references public.tags(
      workspace_id,
      id
    )
    on delete cascade
);


-- =========================================================
-- DEAL TAGS
-- =========================================================

create table public.deal_tags (
  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  deal_id uuid not null,
  tag_id uuid not null,

  created_at timestamptz not null default now(),

  primary key (
    workspace_id,
    deal_id,
    tag_id
  ),

  constraint deal_tags_deal_same_workspace_fk
    foreign key (
      workspace_id,
      deal_id
    )
    references public.deals(
      workspace_id,
      id
    )
    on delete cascade,

  constraint deal_tags_tag_same_workspace_fk
    foreign key (
      workspace_id,
      tag_id
    )
    references public.tags(
      workspace_id,
      id
    )
    on delete cascade
);


-- =========================================================
-- CUSTOM FIELDS
-- =========================================================

create table public.custom_fields (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  entity_type text not null,

  name text not null,
  field_key text not null,
  field_type text not null,

  required boolean not null default false,
  visible boolean not null default true,

  position integer not null default 0,

  options jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint custom_fields_name_not_empty
    check (length(trim(name)) > 0),

  constraint custom_fields_key_format
    check (
      field_key ~ '^[a-z][a-z0-9_]*$'
    ),

  constraint custom_fields_position_non_negative
    check (position >= 0),

  constraint custom_fields_entity_type_check
    check (
      entity_type in (
        'LEAD',
        'CONTACT',
        'COMPANY',
        'DEAL',
        'TASK'
      )
    ),

  constraint custom_fields_field_type_check
    check (
      field_type in (
        'TEXT',
        'TEXTAREA',
        'NUMBER',
        'CURRENCY',
        'DATE',
        'DATETIME',
        'BOOLEAN',
        'SELECT',
        'MULTI_SELECT',
        'USER',
        'PHONE',
        'EMAIL',
        'URL'
      )
    ),

  constraint custom_fields_workspace_entity_key_unique
    unique (
      workspace_id,
      entity_type,
      field_key
    ),

  -- Required for custom_field_values composite FK.
  constraint custom_fields_workspace_entity_id_unique
    unique (
      workspace_id,
      entity_type,
      id
    )
);


-- =========================================================
-- CUSTOM FIELD VALUES
--
-- entity_id is polymorphic.
--
-- Example:
-- entity_type = LEAD
-- entity_id   = leads.id
--
-- PostgreSQL cannot use one ordinary FK to point entity_id
-- at several different tables.
--
-- Entity existence will therefore also be validated by the
-- service layer / transaction layer.
-- =========================================================

create table public.custom_field_values (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  custom_field_id uuid not null,

  entity_type text not null,
  entity_id uuid not null,

  value jsonb not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint custom_field_values_entity_type_check
    check (
      entity_type in (
        'LEAD',
        'CONTACT',
        'COMPANY',
        'DEAL',
        'TASK'
      )
    ),

  -- Ensures Custom Field belongs to the same Workspace
  -- AND was defined for the same entity type.
  constraint custom_field_values_definition_fk
    foreign key (
      workspace_id,
      entity_type,
      custom_field_id
    )
    references public.custom_fields(
      workspace_id,
      entity_type,
      id
    )
    on delete cascade,

  constraint custom_field_values_one_value_per_field_entity
    unique (
      workspace_id,
      custom_field_id,
      entity_type,
      entity_id
    )
);


-- =========================================================
-- NOTIFICATIONS
-- MVP: in-app notifications.
-- =========================================================

create table public.notifications (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  user_id uuid not null,

  type text not null,
  title text not null,
  message text not null,

  is_read boolean not null default false,

  related_entity_type text,
  related_entity_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  read_at timestamptz,

  constraint notifications_type_not_empty
    check (length(trim(type)) > 0),

  constraint notifications_title_not_empty
    check (length(trim(title)) > 0),

  constraint notifications_related_entity_pair_check
    check (
      (
        related_entity_type is null
        and related_entity_id is null
      )
      or
      (
        related_entity_type is not null
        and related_entity_id is not null
      )
    ),

  constraint notifications_read_state_check
    check (
      (
        is_read = true
        and read_at is not null
      )
      or
      (
        is_read = false
        and read_at is null
      )
    ),

  constraint notifications_user_same_workspace_fk
    foreign key (
      workspace_id,
      user_id
    )
    references public.workspace_members(
      workspace_id,
      user_id
    )
    on delete cascade
);


-- =========================================================
-- AUTOMATION RULES
--
-- Model:
-- WHEN -> IF -> THEN
--
-- conditions and actions are JSON so the automation engine
-- can evolve without constantly changing table structure.
-- =========================================================

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  name text not null,

  is_active boolean not null default true,

  trigger_type text not null,

  conditions jsonb not null default '[]'::jsonb,
  actions jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint automation_rules_name_not_empty
    check (length(trim(name)) > 0),

  constraint automation_rules_trigger_not_empty
    check (length(trim(trigger_type)) > 0),

  constraint automation_rules_workspace_id_id_unique
    unique (workspace_id, id)
);


-- =========================================================
-- AUDIT LOGS
--
-- Timeline != Audit Log.
--
-- Timeline:
-- user-facing CRM activity history.
--
-- Audit:
-- security / compliance / critical mutation history.
--
-- No updated_at by design.
-- =========================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),

  workspace_id uuid not null
    references public.workspaces(id)
    on delete cascade,

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  entity_type text not null,
  entity_id uuid not null,

  action text not null,

  old_values jsonb,
  new_values jsonb,

  created_at timestamptz not null default now(),

  constraint audit_logs_entity_type_not_empty
    check (length(trim(entity_type)) > 0),

  constraint audit_logs_action_not_empty
    check (length(trim(action)) > 0)
);


-- =========================================================
-- INDEXES - PRODUCTS / DEAL ITEMS
-- =========================================================

create index products_workspace_active_idx
  on public.products(
    workspace_id,
    is_active
  );


create index products_workspace_name_idx
  on public.products(
    workspace_id,
    name
  );


create index deal_items_workspace_deal_idx
  on public.deal_items(
    workspace_id,
    deal_id
  );


create index deal_items_workspace_product_idx
  on public.deal_items(
    workspace_id,
    product_id
  );


-- =========================================================
-- INDEXES - TAGS
-- =========================================================

create index lead_tags_workspace_tag_idx
  on public.lead_tags(
    workspace_id,
    tag_id
  );


create index contact_tags_workspace_tag_idx
  on public.contact_tags(
    workspace_id,
    tag_id
  );


create index company_tags_workspace_tag_idx
  on public.company_tags(
    workspace_id,
    tag_id
  );


create index deal_tags_workspace_tag_idx
  on public.deal_tags(
    workspace_id,
    tag_id
  );


-- =========================================================
-- INDEXES - CUSTOM FIELDS
-- =========================================================

create index custom_fields_workspace_entity_idx
  on public.custom_fields(
    workspace_id,
    entity_type,
    visible,
    position
  );


create index custom_field_values_workspace_entity_idx
  on public.custom_field_values(
    workspace_id,
    entity_type,
    entity_id
  );


create index custom_field_values_workspace_field_idx
  on public.custom_field_values(
    workspace_id,
    custom_field_id
  );


-- =========================================================
-- INDEXES - NOTIFICATIONS
-- =========================================================

create index notifications_workspace_user_created_idx
  on public.notifications(
    workspace_id,
    user_id,
    created_at desc
  );


create index notifications_unread_idx
  on public.notifications(
    workspace_id,
    user_id,
    created_at desc
  )
  where is_read = false;


-- =========================================================
-- INDEXES - AUTOMATION
-- =========================================================

create index automation_rules_workspace_active_idx
  on public.automation_rules(
    workspace_id,
    is_active
  );


create index automation_rules_workspace_trigger_idx
  on public.automation_rules(
    workspace_id,
    trigger_type
  );


-- =========================================================
-- INDEXES - AUDIT LOGS
-- =========================================================

create index audit_logs_workspace_entity_created_idx
  on public.audit_logs(
    workspace_id,
    entity_type,
    entity_id,
    created_at desc
  );


create index audit_logs_workspace_actor_created_idx
  on public.audit_logs(
    workspace_id,
    actor_user_id,
    created_at desc
  );


create index audit_logs_workspace_created_idx
  on public.audit_logs(
    workspace_id,
    created_at desc
  );


-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================

create trigger products_set_updated_at
before update on public.products
for each row
execute function private.set_updated_at();


create trigger deal_items_set_updated_at
before update on public.deal_items
for each row
execute function private.set_updated_at();


create trigger tags_set_updated_at
before update on public.tags
for each row
execute function private.set_updated_at();


create trigger custom_fields_set_updated_at
before update on public.custom_fields
for each row
execute function private.set_updated_at();


create trigger custom_field_values_set_updated_at
before update on public.custom_field_values
for each row
execute function private.set_updated_at();


create trigger notifications_set_updated_at
before update on public.notifications
for each row
execute function private.set_updated_at();


create trigger automation_rules_set_updated_at
before update on public.automation_rules
for each row
execute function private.set_updated_at();


-- =========================================================
-- SECURITY BASELINE
--
-- RLS ON.
-- No policies yet.
-- Migration 005 will add real Workspace isolation / RBAC.
-- =========================================================

alter table public.products
  enable row level security;

alter table public.deal_items
  enable row level security;

alter table public.tags
  enable row level security;

alter table public.lead_tags
  enable row level security;

alter table public.contact_tags
  enable row level security;

alter table public.company_tags
  enable row level security;

alter table public.deal_tags
  enable row level security;

alter table public.custom_fields
  enable row level security;

alter table public.custom_field_values
  enable row level security;

alter table public.notifications
  enable row level security;

alter table public.automation_rules
  enable row level security;

alter table public.audit_logs
  enable row level security;


-- Application roles remain locked until migration 005.

revoke all privileges
on table
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


commit;