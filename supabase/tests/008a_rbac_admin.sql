-- Run with psql as postgres against a disposable database after migrations 001-008A.
-- Fixtures and all changes are rolled back. Never run on production.
\set ON_ERROR_STOP on
begin;

create function pg_temp.expect_error(p_sql text, p_error text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm not like '%' || p_error || '%' then
      raise exception 'Expected %, got %', p_error, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected failure: %', p_sql;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
 ('008a0000-0000-0000-0000-000000000001', '008a-owner@example.invalid', '{}'),
 ('008a0000-0000-0000-0000-000000000002', '008a-admin@example.invalid', '{}'),
 ('008a0000-0000-0000-0000-000000000003', '008a-sales@example.invalid', '{}'),
 ('008a0000-0000-0000-0000-000000000004', '008a-owner2@example.invalid', '{}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000001', true);
select public.create_workspace('RBAC test A', 'rbac-008a-test-a') as wa \gset
select public.create_workspace('RBAC test B', 'rbac-008a-test-b') as wb \gset
reset role;
select id as owner_role from public.roles where workspace_id = :'wa' and name = 'Owner' \gset
select id as admin_role from public.roles where workspace_id = :'wa' and name = 'Admin' \gset
select id as sales_role from public.roles where workspace_id = :'wa' and name = 'Sales' \gset
select id as foreign_role from public.roles where workspace_id = :'wb' and name = 'Sales' \gset
select id as owner_member from public.workspace_members where workspace_id = :'wa' \gset
select id as foreign_member from public.workspace_members where workspace_id = :'wb' \gset
insert into public.workspace_members(workspace_id, user_id, role_id) values
 (:'wa', '008a0000-0000-0000-0000-000000000002', :'admin_role') returning id as admin_member \gset
insert into public.workspace_members(workspace_id, user_id, role_id) values
 (:'wa', '008a0000-0000-0000-0000-000000000003', :'sales_role') returning id as sales_member \gset
insert into public.workspace_members(workspace_id, user_id, role_id, status) values
 (:'wa', '008a0000-0000-0000-0000-000000000004', :'owner_role', 'DISABLED') returning id as owner2_member \gset

set local role authenticated;
select pg_temp.expect_error(format('select public.disable_workspace_member(%L,%L)', :'wa', :'owner_member'), 'LAST_ACTIVE_OWNER');
select pg_temp.expect_error(format('select public.remove_workspace_member(%L,%L)', :'wa', :'owner_member'), 'LAST_ACTIVE_OWNER');
select pg_temp.expect_error(format('select public.change_member_role(%L,%L,%L)', :'wa', :'owner_member', :'admin_role'), 'LAST_ACTIVE_OWNER');
select pg_temp.expect_error(format('select public.update_workspace_role(%L,%L,''Renamed'',null)', :'wa', :'owner_role'), 'OWNER_ROLE_PROTECTED');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,ARRAY[]::text[])', :'wa', :'owner_role'), 'OWNER_ROLE_PROTECTED');
select pg_temp.expect_error(format('select public.delete_workspace_role(%L,%L)', :'wa', :'admin_role'), 'SYSTEM_ROLE_PROTECTED');
select pg_temp.expect_error(format('select public.create_workspace_role(%L,'' owner '',null)', :'wa'), 'OWNER_NAME_RESERVED');

select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000002', true);
select pg_temp.expect_error(format('select public.change_member_role(%L,%L,%L)', :'wa', :'admin_member', :'owner_role'), 'OWNER_PROTECTED');
select pg_temp.expect_error(format('select public.disable_workspace_member(%L,%L)', :'wa', :'owner_member'), 'OWNER_PROTECTED');
select pg_temp.expect_error(format('select public.enable_workspace_member(%L,%L)', :'wa', :'owner2_member'), 'OWNER_PROTECTED');
select pg_temp.expect_error(format('select public.remove_workspace_member(%L,%L)', :'wa', :'owner_member'), 'OWNER_PROTECTED');
select pg_temp.expect_error(format('select public.change_member_role(%L,%L,%L)', :'wa', :'sales_member', :'foreign_role'), 'ROLE_NOT_FOUND');
select pg_temp.expect_error(format('select public.disable_workspace_member(%L,%L)', :'wa', :'foreign_member'), 'MEMBER_NOT_FOUND');
select public.create_workspace_role(:'wa', 'Restricted admin', null) as custom_role \gset
select public.update_workspace_role(:'wa', :'custom_role', 'Restricted admin renamed', 'test');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,ARRAY[''WORKSPACE_DELETE''])', :'wa', :'custom_role'), 'WORKSPACE_DELETE_OWNER_ONLY');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,ARRAY[''NO_SUCH_PERMISSION''])', :'wa', :'custom_role'), 'INVALID_PERMISSION_CODES');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,null)', :'wa', :'custom_role'), 'INVALID_PERMISSION_CODES');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,ARRAY[null]::text[])', :'wa', :'custom_role'), 'INVALID_PERMISSION_CODES');
select public.update_role_permissions(:'wa', :'custom_role', ARRAY['MEMBERS_MANAGE', 'ROLES_MANAGE', 'ROLES_MANAGE']);
select public.change_member_role(:'wa', :'sales_member', :'custom_role');
select pg_temp.expect_error(format('select public.delete_workspace_role(%L,%L)', :'wa', :'custom_role'), 'ROLE_IN_USE');
select public.disable_workspace_member(:'wa', :'sales_member');
reset role;
do $$ begin
  if (select status from public.workspace_members where user_id = '008a0000-0000-0000-0000-000000000003') <> 'DISABLED' then
    raise exception 'Disable did not persist';
  end if;
end; $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000003', true);
select pg_temp.expect_error(format('select public.enable_workspace_member(%L,%L)', :'wa', :'sales_member'), 'FORBIDDEN');
select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000002', true);
select public.enable_workspace_member(:'wa', :'sales_member');
reset role;
update public.workspace_members set status = 'INVITED' where id = :'sales_member';
set local role authenticated;
select pg_temp.expect_error(format('select public.enable_workspace_member(%L,%L)', :'wa', :'sales_member'), 'INVALID_MEMBER_STATUS');
select pg_temp.expect_error(format('select public.disable_workspace_member(%L,%L)', :'wa', :'sales_member'), 'INVALID_MEMBER_STATUS');
reset role;
update public.workspace_members set status = 'ACTIVE' where id = :'sales_member';
insert into public.contacts(workspace_id, first_name, owner_user_id)
values (:'wa', 'Referenced member', '008a0000-0000-0000-0000-000000000003') returning id as contact_id \gset
set local role authenticated;
select pg_temp.expect_error(format('select public.remove_workspace_member(%L,%L)', :'wa', :'sales_member'), 'MEMBER_REFERENCED_USE_DISABLE');
reset role;
delete from public.contacts where id = :'contact_id';
set local role authenticated;
select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000003', true);
select pg_temp.expect_error(format('select public.change_member_role(%L,%L,%L)', :'wa', :'sales_member', :'admin_role'), 'ROLE_EXCEEDS_ACTOR_PERMISSIONS');
select pg_temp.expect_error(format('select public.update_role_permissions(%L,%L,ARRAY[''ROLES_MANAGE'',''DEALS_MANAGE''])', :'wa', :'custom_role'), 'PERMISSIONS_EXCEED_ACTOR');
select pg_temp.expect_error(format('select public.disable_workspace_member(%L,%L)', :'wa', :'admin_member'), 'ROLE_EXCEEDS_ACTOR_PERMISSIONS');
select pg_temp.expect_error(format('select public.create_workspace_role(%L,''Cross tenant'',null)', :'wb'), 'FORBIDDEN');
select pg_temp.expect_error(format('update public.roles set name = ''Hacked'' where id = %L', :'custom_role'), 'permission denied');
select pg_temp.expect_error(format('select private.lock_rbac_workspace(%L)', :'wa'), 'permission denied');

select set_config('request.jwt.claim.sub', '008a0000-0000-0000-0000-000000000001', true);
select public.enable_workspace_member(:'wa', :'owner2_member');
select public.change_member_role(:'wa', :'sales_member', :'owner_role');
select public.change_member_role(:'wa', :'sales_member', :'custom_role');
select public.change_member_role(:'wa', :'owner_member', :'admin_role');
select public.remove_workspace_member(:'wa', :'sales_member');
select public.delete_workspace_role(:'wa', :'custom_role');
reset role;
select pg_temp.expect_error('delete from auth.users where id = ''008a0000-0000-0000-0000-000000000004''', 'LAST_ACTIVE_OWNER');
set local role authenticated;
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error(format('select public.create_workspace_role(%L,''No auth'',null)', :'wa'), 'AUTH_REQUIRED');
set local role anon;
select pg_temp.expect_error(format('select public.create_workspace_role(%L,''Anon'',null)', :'wa'), 'permission denied');
reset role;
do $$ begin
  if not exists (select 1 from public.audit_logs where entity_type = 'ROLE' and action = 'UPDATE_PERMISSIONS') then
    raise exception 'Missing permission audit';
  end if;
  if exists (select 1 from public.workspaces w where not exists (
    select 1 from public.workspace_members m join public.roles r on r.id = m.role_id
    where m.workspace_id = w.id and m.status = 'ACTIVE' and r.is_system and r.name = 'Owner'
  )) then raise exception 'Workspace without active Owner'; end if;
end; $$;
rollback;
\echo '008A RBAC regression tests passed'
