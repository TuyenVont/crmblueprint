\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Failed: %', label; end if; end; $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$ begin begin execute statement; exception when others then if sqlerrm not like '%' || expected || '%' then raise exception 'Expected %, got %', expected, sqlerrm; end if; return; end; raise exception 'Expected rejection: %', statement; end; $$;
insert into auth.users(id,email,raw_user_meta_data) values
('010b0000-0000-0000-0000-000000000001','owner010b@example.invalid','{}'),
('010b0000-0000-0000-0000-000000000002','actor010b@example.invalid','{}'),
('010b0000-0000-0000-0000-000000000003','outsider010b@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','010b0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Companies Write A','companies-010b-a') as wa \gset
select public.create_workspace('Companies Write B','companies-010b-b') as wb \gset
reset role;
insert into public.roles(workspace_id,name) values (:'wa','Custom company operator') returning id as actor_role \gset
insert into public.role_permissions(role_id,permission_id) select :'actor_role',id from public.permissions where code='COMPANIES_MANAGE';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values (:'wa','010b0000-0000-0000-0000-000000000002',:'actor_role','ACTIVE');
insert into public.companies(workspace_id,name,owner_user_id) values (:'wa','Existing company','010b0000-0000-0000-0000-000000000001') returning id as company_id \gset
insert into public.companies(workspace_id,name) values (:'wb','Foreign secret') returning id as foreign_id \gset
insert into public.contacts(workspace_id,first_name) values (:'wa','Linked contact') returning id as contact_id \gset
insert into public.company_contacts(workspace_id,company_id,contact_id,job_title,is_primary) values (:'wa',:'company_id',:'contact_id','Director',true);
create temp table before_company as select * from public.companies where id=:'company_id';
create temp table before_links as select * from public.company_contacts where company_id=:'company_id';
set local role authenticated;
select set_config('request.jwt.claim.sub','010b0000-0000-0000-0000-000000000002',true);
-- A manage-only insert must not request RETURNING: view RLS intentionally denies it.
insert into public.companies(workspace_id,name) values (:'wa','Manage-only created');
select pg_temp.check_true(not exists(select 1 from public.companies),'manage-only still cannot read');
-- UPDATE without WHERE/RETURNING may not invoke a SELECT policy at all.
do $$ declare affected integer; begin
  update public.companies set name='Forbidden bulk edit';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Manage-only bulk UPDATE bypassed view permission'; end if;
end $$;
with changed as (update public.companies set name='Forbidden edit' where id=:'company_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'manage-only cannot edit existing rows');
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wb','Forged workspace'),'row-level security');
reset role;
select pg_temp.check_true((select count(*)=1 from public.companies where workspace_id=:'wa' and name='Manage-only created'),'manage-only insert persisted');
insert into public.role_permissions(role_id,permission_id) select :'actor_role',id from public.permissions where code='COMPANIES_VIEW';
set local role authenticated;
insert into public.companies(workspace_id,name,email) values (:'wa','New company','new@example.invalid') returning id as new_id \gset
update public.companies set name='Edited company',tax_id='TAX-1',phone='123',email='edit@example.invalid',website='https://example.invalid',address='Address',industry='Software',size='10' where workspace_id=:'wa' and id=:'company_id';
select pg_temp.check_true((select name='Edited company' and tax_id='TAX-1' and industry='Software' and size='10' from public.companies where id=:'company_id'),'view/manage can edit');
with changed as (update public.companies set name='Foreign changed' where id=:'foreign_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'RLS blocks foreign update without application workspace filter');
with changed as (update public.companies set name='Missing changed' where id='010b0000-9999-9999-9999-999999999999' returning id) select pg_temp.check_true((select count(*)=0 from changed),'missing and foreign update identical');
select pg_temp.expect_error(format('update public.companies set workspace_id=%L where id=%L',:'wb',:'new_id'),'row-level security');
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wa',' '),'companies_name_not_empty');
reset role;
select pg_temp.check_true((select c.workspace_id=b.workspace_id and c.owner_user_id=b.owner_user_id and c.created_at=b.created_at from public.companies c join before_company b on c.id=b.id),'allowlisted edit preserved protected columns');
select pg_temp.check_true(not exists((select * from public.company_contacts where company_id=:'company_id' except select * from before_links) union all (select * from before_links except select * from public.company_contacts where company_id=:'company_id')),'company mutations preserve relationships exactly');
delete from public.role_permissions where role_id=:'actor_role' and permission_id=(select id from public.permissions where code='COMPANIES_MANAGE');
set local role authenticated;
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wa','Reader denied'),'row-level security');
with changed as (update public.companies set name='Reader denied' where id=:'company_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'view-only update blocked directly by RLS');
select set_config('request.jwt.claim.sub','010b0000-0000-0000-0000-000000000003',true);
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wa','Outsider denied'),'row-level security');
with changed as (update public.companies set name='Outsider denied' where id=:'company_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'outsider update blocked');
reset role;
insert into public.role_permissions(role_id,permission_id) select :'actor_role',id from public.permissions where code='COMPANIES_MANAGE';
update public.workspace_members set status='DISABLED' where workspace_id=:'wa' and user_id='010b0000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','010b0000-0000-0000-0000-000000000002',true);
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wa','Disabled denied'),'row-level security');
with changed as (update public.companies set name='Disabled denied' where id=:'company_id' returning id) select pg_temp.check_true((select count(*)=0 from changed),'disabled update blocked');
set local role anon;
select pg_temp.expect_error(format('insert into public.companies(workspace_id,name) values (%L,%L)',:'wa','Anonymous denied'),'permission denied');
select pg_temp.expect_error(format('update public.companies set name=%L where id=%L','Anonymous denied',:'company_id'),'permission denied');
rollback;
