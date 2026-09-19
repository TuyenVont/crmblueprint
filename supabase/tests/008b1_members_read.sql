-- Disposable database only, migrations 001-008B.1 applied. All fixtures roll back.
\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text)
returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'Failed: %', label; end if;
end;
$$;
create function pg_temp.expect_error(statement text, expected text)
returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlerrm not like '%' || expected || '%' then
      raise exception 'Expected %, got %', expected, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected rejection: %', statement;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
 ('008b1000-0000-0000-0000-000000000001', 'owner@example.invalid', '{}'),
 ('008b1000-0000-0000-0000-000000000002', 'reader@example.invalid', '{}'),
 ('008b1000-0000-0000-0000-000000000003', 'denied@example.invalid', '{}'),
 ('008b1000-0000-0000-0000-000000000004', 'disabled@example.invalid', '{}'),
 ('008b1000-0000-0000-0000-000000000005', 'invited@example.invalid', '{}'),
 ('008b1000-0000-0000-0000-000000000006', 'foreign@example.invalid', '{}');
set local role authenticated;
select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000001', true);
select public.create_workspace('Read API A', 'read-api-008b1-a') as wa \gset
select public.create_workspace('Read API B', 'read-api-008b1-b') as wb \gset
reset role;
insert into public.roles(workspace_id, name) values (:'wa', 'Reader') returning id as reader_role \gset
insert into public.roles(workspace_id, name) values (:'wa', 'No permissions') returning id as denied_role \gset
insert into public.roles(workspace_id, name) values (:'wb', 'Other permissions') returning id as other_role \gset
insert into public.role_permissions(role_id, permission_id)
select :'reader_role', p.id from public.permissions p where p.code = 'MEMBERS_VIEW';
insert into public.role_permissions(role_id, permission_id)
select :'other_role', p.id from public.permissions p where p.code = 'CONTACTS_VIEW';
insert into public.workspace_members(workspace_id, user_id, role_id, status) values
 (:'wa', '008b1000-0000-0000-0000-000000000002', :'reader_role', 'ACTIVE'),
 (:'wa', '008b1000-0000-0000-0000-000000000003', :'denied_role', 'ACTIVE'),
 (:'wa', '008b1000-0000-0000-0000-000000000004', :'reader_role', 'DISABLED'),
 (:'wa', '008b1000-0000-0000-0000-000000000005', :'reader_role', 'INVITED'),
 (:'wb', '008b1000-0000-0000-0000-000000000002', :'other_role', 'ACTIVE'),
 (:'wb', '008b1000-0000-0000-0000-000000000006', :'other_role', 'ACTIVE');
update public.profiles set full_name = 'Searchable Person'
where id = '008b1000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000002', true);
select pg_temp.check_true(not exists(select 1 from public.roles where workspace_id = :'wa'), 'reader cannot directly read roles');
select pg_temp.check_true(not exists(select 1 from public.role_permissions where role_id = :'reader_role'), 'reader cannot directly read mappings');
select pg_temp.check_true((select array_agg(permission_code) = array['MEMBERS_VIEW'] from public.get_my_workspace_permissions(:'wa')), 'only caller permissions, no Owner leakage');
select pg_temp.check_true((select array_agg(permission_code) = array['CONTACTS_VIEW'] from public.get_my_workspace_permissions(:'wb')), 'permissions scoped to requested workspace');
select pg_temp.check_true((public.list_workspace_members(:'wa')->>'total')::int = 5, 'MEMBERS_VIEW works without ROLES_VIEW');
select pg_temp.check_true((select count(*) = 5 and bool_and(x->>'email' <> 'foreign@example.invalid')
  from jsonb_array_elements(public.list_workspace_members(:'wa')->'members') x), 'emails scoped to workspace');
select pg_temp.check_true((select x->>'email' = 'disabled@example.invalid' and x->>'role_name' = 'Reader'
  from jsonb_array_elements(public.list_workspace_members(:'wa', 'searchable person')->'members') x), 'name search and disabled member email');
select pg_temp.check_true((public.list_workspace_members(:'wa', 'READER@')->>'total')::int = 1, 'case-insensitive email search');
select pg_temp.check_true((public.list_workspace_members(:'wa', '%')->>'total')::int = 0, 'literal search wildcard');
select pg_temp.check_true((public.list_workspace_members(:'wa', ''' OR true --')->>'total')::int = 0, 'search does not execute SQL');
select pg_temp.check_true(jsonb_array_length(public.list_workspace_members(:'wa', null, 1, 0)->'members') = 1, 'bounded page');
select pg_temp.check_true(public.list_workspace_members(:'wa', null, 1, 0)->'members' <> public.list_workspace_members(:'wa', null, 1, 1)->'members', 'stable distinct pages');
select pg_temp.check_true(public.list_workspace_members(:'wa', null, 1, 99) = '{"members":[],"total":5}'::jsonb, 'empty page retains total');
select pg_temp.check_true(not exists(
  select 1 from jsonb_array_elements(public.list_workspace_members(:'wa')->'members') x,
    jsonb_object_keys(x) k
  where k <> all(array['workspace_member_id','user_id','display_name','email','role_id','role_name','role_is_system','status','joined_at'])
), 'no auth metadata or role permission leakage');
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wb'), 'FORBIDDEN');
select pg_temp.expect_error(format('select public.list_workspace_members(%L,null,101,0)', :'wa'), 'INVALID_LIST_PARAMETERS');
select pg_temp.expect_error(format('select public.list_workspace_members(%L,null,50,-1)', :'wa'), 'INVALID_LIST_PARAMETERS');
select pg_temp.expect_error(format('select public.list_workspace_members(%L,null,null,0)', :'wa'), 'INVALID_LIST_PARAMETERS');
select pg_temp.expect_error(format('select public.list_workspace_members(%L,%L)', :'wa', repeat('x',201)), 'INVALID_LIST_PARAMETERS');
select pg_temp.expect_error('select email from auth.users', 'permission denied');

select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000003', true);
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'FORBIDDEN');
select pg_temp.check_true(not exists(select 1 from public.get_my_workspace_permissions(:'wa')), 'empty role returns no permissions');
select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000004', true);
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'FORBIDDEN');
select pg_temp.expect_error(format('select public.get_my_workspace_permissions(%L)', :'wa'), 'FORBIDDEN');
select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000005', true);
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'FORBIDDEN');
select pg_temp.expect_error(format('select public.get_my_workspace_permissions(%L)', :'wa'), 'FORBIDDEN');
select set_config('request.jwt.claim.sub', '008b1000-0000-0000-0000-000000000006', true);
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'FORBIDDEN');
select pg_temp.expect_error(format('select public.get_my_workspace_permissions(%L)', :'wa'), 'FORBIDDEN');
select pg_temp.expect_error('select public.get_my_workspace_permissions(null)', 'FORBIDDEN');
select set_config('request.jwt.claim.sub', '', true);
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'AUTH_REQUIRED');
select pg_temp.expect_error(format('select public.get_my_workspace_permissions(%L)', :'wa'), 'AUTH_REQUIRED');
set local role anon;
select pg_temp.expect_error(format('select public.list_workspace_members(%L)', :'wa'), 'permission denied');
select pg_temp.expect_error(format('select public.get_my_workspace_permissions(%L)', :'wa'), 'permission denied');
reset role;
select pg_temp.check_true(not has_function_privilege('anon', 'public.list_workspace_members(uuid,text,integer,integer)', 'EXECUTE'), 'anon list grant revoked');
select pg_temp.check_true(not has_function_privilege('anon', 'public.get_my_workspace_permissions(uuid)', 'EXECUTE'), 'anon permissions grant revoked');
select pg_temp.check_true((select count(*) = 2 and bool_and(p.prosecdef and p.provolatile = 's' and 'search_path=""' = any(p.proconfig))
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('list_workspace_members','get_my_workspace_permissions')), 'definer functions have empty search path and stable snapshots');
rollback;
\echo '008B.1 members read security tests passed'
