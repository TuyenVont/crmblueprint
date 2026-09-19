\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Failed: %', label; end if; end; $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$ begin begin execute statement; exception when others then if sqlerrm not like '%' || expected || '%' then raise exception 'Expected %, got %', expected, sqlerrm; end if; return; end; raise exception 'Expected rejection: %', statement; end; $$;
insert into auth.users(id,email,raw_user_meta_data) values
('01000000-0000-0000-0000-000000000001','owner010@example.invalid','{}'),
('01000000-0000-0000-0000-000000000002','reader010@example.invalid','{}'),
('01000000-0000-0000-0000-000000000003','manager010@example.invalid','{}'),
('01000000-0000-0000-0000-000000000004','outsider010@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000001',true);
select public.create_workspace('Contacts A','contacts-010-a') as wa \gset
select public.create_workspace('Contacts B','contacts-010-b') as wb \gset
reset role;
insert into public.roles(workspace_id,name) values (:'wa','Contact reader') returning id as reader_role \gset
insert into public.roles(workspace_id,name) values (:'wa','Manage without view') returning id as manager_role \gset
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='CONTACTS_VIEW';
insert into public.role_permissions(role_id,permission_id) select :'manager_role',id from public.permissions where code='CONTACTS_MANAGE';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values
(:'wa','01000000-0000-0000-0000-000000000002',:'reader_role','ACTIVE'),
(:'wa','01000000-0000-0000-0000-000000000003',:'manager_role','ACTIVE');
insert into public.contacts(workspace_id,first_name,email) select :'wa','Alice '||n,'alice'||n||'@example.invalid' from generate_series(1,55) n;
insert into public.contacts(workspace_id,first_name) values (:'wb','Foreign secret') returning id as foreign_contact \gset
insert into public.companies(workspace_id,name) values (:'wb','Foreign company') returning id as foreign_company \gset
set local role authenticated;
insert into public.contacts(workspace_id,first_name) values (:'wa','Created contact') returning id as contact_id \gset
update public.contacts set phone='123' where workspace_id=:'wa' and id=:'contact_id';
select pg_temp.check_true((select phone='123' from public.contacts where workspace_id=:'wa' and id=:'contact_id'),'authorized create and edit');
select pg_temp.check_true(not exists(select 1 from public.contacts where workspace_id=:'wa' and id=:'foreign_contact'),'foreign ID scoped out even for member of both workspaces');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,contact_id,company_id) values (%L,%L,%L)',:'wa',:'contact_id',:'foreign_company'),'company_contacts_company_same_workspace_fk');
select set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)=56 from public.contacts where workspace_id=:'wa'),'reader lists contacts');
select pg_temp.check_true(not exists(select 1 from public.contacts where id=:'foreign_contact'),'RLS hides foreign ID');
select pg_temp.check_true((select count(*)=55 from public.contacts where workspace_id=:'wa' and (first_name ilike '%alice%' or email ilike '%alice%')),'scoped search');
select pg_temp.check_true((select count(*)=6 from (select id from public.contacts where workspace_id=:'wa' order by created_at desc,id limit 50 offset 50) p),'scoped second page');
select pg_temp.expect_error(format('insert into public.contacts(workspace_id,first_name) values (%L,%L)',:'wa','Denied'),'row-level security');
with changed as (update public.contacts set first_name='Denied' where id=:'contact_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'read-only update denied');
select pg_temp.expect_error(format('insert into public.contacts(workspace_id,first_name) values (%L,%L)',:'wb','Forged workspace'),'row-level security');
select set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000003',true);
select pg_temp.check_true(not exists(select 1 from public.contacts),'manage-only cannot bypass view permission');
select pg_temp.expect_error(format('insert into public.contacts(workspace_id,first_name) values (%L,%L)',:'wa','No view'),'row-level security');
select set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000004',true);
select pg_temp.check_true(not exists(select 1 from public.contacts),'outsider sees no contacts');
reset role;
update public.workspace_members set status='DISABLED' where workspace_id=:'wa' and user_id='01000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','01000000-0000-0000-0000-000000000002',true);
select pg_temp.check_true(not exists(select 1 from public.contacts),'disabled reader sees no contacts');
set local role anon;
select pg_temp.expect_error('select * from public.contacts','permission denied');
rollback;
