begin;

-- 008A: RBAC administration. Existing table grants and RLS stay unchanged.
-- Owner identity is the immutable system role named Owner (migration 007).

create function private.lock_rbac_workspace(p_workspace_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  -- A real row write serializes administration and forces a serialization
  -- failure for stale REPEATABLE READ / SERIALIZABLE transactions too.
  update public.workspaces w set updated_at = pg_catalog.now()
  where w.id = p_workspace_id;
  if not found then
    raise exception 'WORKSPACE_NOT_FOUND';
  end if;
end;
$$;

create function private.require_rbac_admin(p_workspace_id uuid, p_permission text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner boolean;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  -- Reject outsiders before acquiring the workspace lock, then re-authorize
  -- after waiting: permissions or membership may have changed meanwhile.
  if not private.has_permission(p_workspace_id, p_permission) then
    raise exception 'FORBIDDEN';
  end if;
  perform private.lock_rbac_workspace(p_workspace_id);
  if not private.has_permission(p_workspace_id, p_permission) then
    raise exception 'FORBIDDEN';
  end if;
  select r.is_system and r.name = 'Owner' into v_owner
  from public.workspace_members m
  join public.roles r on r.id = m.role_id and r.workspace_id = m.workspace_id
  where m.workspace_id = p_workspace_id and m.user_id = auth.uid()
    and m.status = 'ACTIVE';
  if not exists (
    select 1 from public.workspace_members m
    join public.roles r on r.id = m.role_id and r.workspace_id = m.workspace_id
    where m.workspace_id = p_workspace_id and m.status = 'ACTIVE'
      and r.is_system and r.name = 'Owner'
  ) then raise exception 'WORKSPACE_HAS_NO_ACTIVE_OWNER'; end if;
  return coalesce(v_owner, false);
end;
$$;

create function private.require_role_ceiling(p_workspace_id uuid, p_role_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.roles r
    where r.id = p_role_id and r.workspace_id = p_workspace_id) then
    raise exception 'ROLE_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.role_permissions rp
    join public.permissions p on p.id = rp.permission_id
    where rp.role_id = p_role_id
      and not private.has_permission(p_workspace_id, p.code)
  ) then raise exception 'ROLE_EXCEEDS_ACTOR_PERMISSIONS'; end if;
end;
$$;

-- Also protects membership loss caused by auth.users ON DELETE CASCADE.
create function private.guard_active_owner()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.status <> 'ACTIVE' or not exists (
    select 1 from public.roles r where r.id = old.role_id
      and r.workspace_id = old.workspace_id and r.is_system and r.name = 'Owner'
  ) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'UPDATE' then
    if new.workspace_id = old.workspace_id and new.role_id = old.role_id
      and new.status = 'ACTIVE' then return new; end if;
  end if;
  -- A deleted workspace itself does not need a surviving Owner.
  if not exists (select 1 from public.workspaces w where w.id = old.workspace_id) then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  perform private.lock_rbac_workspace(old.workspace_id);
  if not exists (
    select 1 from public.workspace_members m
    join public.roles r on r.id = m.role_id and r.workspace_id = m.workspace_id
    where m.workspace_id = old.workspace_id and m.id <> old.id
      and m.status = 'ACTIVE' and r.is_system and r.name = 'Owner'
  ) then raise exception 'LAST_ACTIVE_OWNER'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger workspace_members_guard_active_owner
before update or delete on public.workspace_members
for each row execute function private.guard_active_owner();

create function private.mutate_workspace_member(
  p_workspace_id uuid, p_member_id uuid, p_action text, p_role_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_owner boolean;
  v_member public.workspace_members%rowtype;
  v_role public.roles%rowtype;
begin
  v_owner := private.require_rbac_admin(p_workspace_id, 'MEMBERS_MANAGE');
  select m.* into v_member from public.workspace_members m
  where m.workspace_id = p_workspace_id and m.id = p_member_id;
  if not found then raise exception 'MEMBER_NOT_FOUND'; end if;
  select r.* into v_role from public.roles r
  where r.workspace_id = p_workspace_id and r.id = v_member.role_id;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if v_role.is_system and v_role.name = 'Owner' and not v_owner then
    raise exception 'OWNER_PROTECTED';
  end if;
  -- Prevent lower-privileged administrators from controlling stronger members.
  perform private.require_role_ceiling(p_workspace_id, v_member.role_id);

  if p_action = 'CHANGE_ROLE' then
    select r.* into v_role from public.roles r
    where r.workspace_id = p_workspace_id and r.id = p_role_id;
    if not found then raise exception 'ROLE_NOT_FOUND'; end if;
    if v_role.is_system and v_role.name = 'Owner' and not v_owner then
      raise exception 'OWNER_PROTECTED';
    end if;
    perform private.require_role_ceiling(p_workspace_id, p_role_id);
    update public.workspace_members m set role_id = p_role_id
    where m.workspace_id = p_workspace_id and m.id = p_member_id;
  elsif p_action = 'DISABLE' then
    if v_member.status = 'INVITED' then raise exception 'INVALID_MEMBER_STATUS'; end if;
    update public.workspace_members m set status = 'DISABLED'
    where m.workspace_id = p_workspace_id and m.id = p_member_id;
  elsif p_action = 'ENABLE' then
    -- Invitation acceptance is deliberately not implemented by this RPC.
    if v_member.status = 'INVITED' then raise exception 'INVALID_MEMBER_STATUS'; end if;
    update public.workspace_members m set status = 'ACTIVE'
    where m.workspace_id = p_workspace_id and m.id = p_member_id;
  elsif p_action = 'REMOVE' then
    if exists (select 1 from public.contacts x where x.workspace_id = p_workspace_id and x.owner_user_id = v_member.user_id)
      or exists (select 1 from public.companies x where x.workspace_id = p_workspace_id and x.owner_user_id = v_member.user_id)
      or exists (select 1 from public.leads x where x.workspace_id = p_workspace_id and x.owner_user_id = v_member.user_id)
      or exists (select 1 from public.deals x where x.workspace_id = p_workspace_id and x.owner_user_id = v_member.user_id)
      or exists (select 1 from public.activities x where x.workspace_id = p_workspace_id and x.created_by = v_member.user_id)
      or exists (select 1 from public.tasks x where x.workspace_id = p_workspace_id and (x.created_by = v_member.user_id or x.assignee_user_id = v_member.user_id)) then
      raise exception 'MEMBER_REFERENCED_USE_DISABLE';
    end if;
    delete from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.id = p_member_id;
  else raise exception 'INVALID_MEMBER_ACTION';
  end if;
  insert into public.audit_logs(workspace_id, actor_user_id, entity_type, entity_id, action, old_values, new_values)
  values (p_workspace_id, auth.uid(), 'WORKSPACE_MEMBER', p_member_id, p_action,
    pg_catalog.to_jsonb(v_member),
    (select pg_catalog.to_jsonb(m) from public.workspace_members m
      where m.workspace_id = p_workspace_id and m.id = p_member_id));
end;
$$;

create function public.change_member_role(p_workspace_id uuid, p_member_id uuid, p_role_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  perform private.mutate_workspace_member(p_workspace_id, p_member_id, 'CHANGE_ROLE', p_role_id);
end; $$;

create function public.disable_workspace_member(p_workspace_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  perform private.mutate_workspace_member(p_workspace_id, p_member_id, 'DISABLE');
end; $$;

create function public.enable_workspace_member(p_workspace_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  perform private.mutate_workspace_member(p_workspace_id, p_member_id, 'ENABLE');
end; $$;

create function public.remove_workspace_member(p_workspace_id uuid, p_member_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$ begin
  perform private.mutate_workspace_member(p_workspace_id, p_member_id, 'REMOVE');
end; $$;

create function private.require_editable_role(p_workspace_id uuid, p_role_id uuid)
returns public.roles
language plpgsql security definer set search_path = ''
as $$
declare v_role public.roles%rowtype;
begin
  perform private.require_rbac_admin(p_workspace_id, 'ROLES_MANAGE');
  select r.* into v_role from public.roles r
  where r.workspace_id = p_workspace_id and r.id = p_role_id;
  if not found then raise exception 'ROLE_NOT_FOUND'; end if;
  if v_role.is_system and v_role.name = 'Owner' then raise exception 'OWNER_ROLE_PROTECTED'; end if;
  perform private.require_role_ceiling(p_workspace_id, p_role_id);
  return v_role;
end;
$$;

create function private.validate_role_name(p_workspace_id uuid, p_name text, p_role_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_name is null or pg_catalog.btrim(p_name) = '' then raise exception 'INVALID_ROLE_NAME'; end if;
  if pg_catalog.lower(pg_catalog.btrim(p_name)) = 'owner' then raise exception 'OWNER_NAME_RESERVED'; end if;
  if exists (select 1 from public.roles r where r.workspace_id = p_workspace_id
    and (p_role_id is null or r.id <> p_role_id)
    and pg_catalog.lower(pg_catalog.btrim(r.name)) = pg_catalog.lower(pg_catalog.btrim(p_name))) then
    raise exception 'ROLE_NAME_EXISTS';
  end if;
end;
$$;

create function public.create_workspace_role(p_workspace_id uuid, p_name text, p_description text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_role public.roles%rowtype;
begin
  perform private.require_rbac_admin(p_workspace_id, 'ROLES_MANAGE');
  perform private.validate_role_name(p_workspace_id, p_name);
  insert into public.roles(workspace_id, name, description, is_system)
  values (p_workspace_id, pg_catalog.btrim(p_name), p_description, false) returning * into v_role;
  insert into public.audit_logs(workspace_id, actor_user_id, entity_type, entity_id, action, new_values)
  values (p_workspace_id, auth.uid(), 'ROLE', v_role.id, 'CREATE', pg_catalog.to_jsonb(v_role));
  return v_role.id;
end; $$;

create function public.update_workspace_role(p_workspace_id uuid, p_role_id uuid, p_name text, p_description text)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role public.roles%rowtype;
begin
  v_role := private.require_editable_role(p_workspace_id, p_role_id);
  perform private.validate_role_name(p_workspace_id, p_name, p_role_id);
  -- Preserve system identities used by onboarding and future administration.
  if v_role.is_system and pg_catalog.btrim(p_name) <> v_role.name then
    raise exception 'SYSTEM_ROLE_NAME_PROTECTED';
  end if;
  update public.roles r set name = pg_catalog.btrim(p_name), description = p_description
  where r.workspace_id = p_workspace_id and r.id = p_role_id;
  insert into public.audit_logs(workspace_id, actor_user_id, entity_type, entity_id, action, old_values, new_values)
  values (p_workspace_id, auth.uid(), 'ROLE', p_role_id, 'UPDATE', pg_catalog.to_jsonb(v_role),
    pg_catalog.jsonb_build_object('name', pg_catalog.btrim(p_name), 'description', p_description));
end; $$;

create function public.update_role_permissions(p_workspace_id uuid, p_role_id uuid, p_permission_codes text[])
returns void language plpgsql security definer set search_path = ''
as $$
declare v_old jsonb;
begin
  perform private.require_editable_role(p_workspace_id, p_role_id);
  if p_permission_codes is null or exists (
    select 1 from pg_catalog.unnest(p_permission_codes) c(code)
    where c.code is null or not exists (select 1 from public.permissions p where p.code = c.code)
  ) then raise exception 'INVALID_PERMISSION_CODES'; end if;
  if 'WORKSPACE_DELETE' = any(p_permission_codes) then raise exception 'WORKSPACE_DELETE_OWNER_ONLY'; end if;
  if exists (select 1 from pg_catalog.unnest(p_permission_codes) c(code)
    where not private.has_permission(p_workspace_id, c.code)) then
    raise exception 'PERMISSIONS_EXCEED_ACTOR';
  end if;
  -- Validate against the actor's OLD permissions before replacing any rows,
  -- including when the actor is assigned to the role being edited.
  select coalesce(pg_catalog.jsonb_agg(p.code order by p.code), '[]'::jsonb) into v_old
  from public.role_permissions rp join public.permissions p on p.id = rp.permission_id
  where rp.role_id = p_role_id;
  delete from public.role_permissions rp where rp.role_id = p_role_id;
  insert into public.role_permissions(role_id, permission_id)
  select p_role_id, p.id from public.permissions p where p.code = any(p_permission_codes);
  insert into public.audit_logs(workspace_id, actor_user_id, entity_type, entity_id, action, old_values, new_values)
  values (p_workspace_id, auth.uid(), 'ROLE', p_role_id, 'UPDATE_PERMISSIONS', v_old,
    pg_catalog.to_jsonb(p_permission_codes));
end; $$;

create function public.delete_workspace_role(p_workspace_id uuid, p_role_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_role public.roles%rowtype;
begin
  v_role := private.require_editable_role(p_workspace_id, p_role_id);
  if v_role.is_system then raise exception 'SYSTEM_ROLE_PROTECTED'; end if;
  if exists (select 1 from public.workspace_members m
    where m.workspace_id = p_workspace_id and m.role_id = p_role_id) then
    raise exception 'ROLE_IN_USE';
  end if;
  delete from public.roles r where r.workspace_id = p_workspace_id and r.id = p_role_id;
  insert into public.audit_logs(workspace_id, actor_user_id, entity_type, entity_id, action, old_values)
  values (p_workspace_id, auth.uid(), 'ROLE', p_role_id, 'DELETE', pg_catalog.to_jsonb(v_role));
end; $$;

revoke all on function private.lock_rbac_workspace(uuid),
  private.require_rbac_admin(uuid, text), private.require_role_ceiling(uuid, uuid),
  private.guard_active_owner(), private.mutate_workspace_member(uuid, uuid, text, uuid),
  private.require_editable_role(uuid, uuid), private.validate_role_name(uuid, text, uuid)
from public, anon, authenticated;

revoke all on function public.change_member_role(uuid, uuid, uuid),
  public.disable_workspace_member(uuid, uuid), public.enable_workspace_member(uuid, uuid),
  public.remove_workspace_member(uuid, uuid), public.create_workspace_role(uuid, text, text),
  public.update_workspace_role(uuid, uuid, text, text), public.update_role_permissions(uuid, uuid, text[]),
  public.delete_workspace_role(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.change_member_role(uuid, uuid, uuid),
  public.disable_workspace_member(uuid, uuid), public.enable_workspace_member(uuid, uuid),
  public.remove_workspace_member(uuid, uuid), public.create_workspace_role(uuid, text, text),
  public.update_workspace_role(uuid, uuid, text, text), public.update_role_permissions(uuid, uuid, text[]),
  public.delete_workspace_role(uuid, uuid)
to authenticated;

commit;
