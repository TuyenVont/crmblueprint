\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Failed: %', label; end if; end; $$;
insert into auth.users(id,email,raw_user_meta_data) values
('010a0000-0000-0000-0000-000000000001','owner010a@example.invalid','{}'),
('010a0000-0000-0000-0000-000000000002','reader010a@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','010a0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Companies A','companies-010a-a') as wa \gset
select public.create_workspace('Companies B','companies-010a-b') as wb \gset
reset role;
insert into public.roles(workspace_id,name) values (:'wa','Custom company reader') returning id as reader_role \gset
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='COMPANIES_VIEW';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values (:'wa','010a0000-0000-0000-0000-000000000002',:'reader_role','ACTIVE');
insert into public.companies(workspace_id,name) select :'wa','Company '||n from generate_series(1,55) n;
insert into public.companies(workspace_id,name) values (:'wa','Linked company') returning id as company_id \gset
insert into public.companies(workspace_id,name) values (:'wb','Foreign company') returning id as foreign_id \gset
insert into public.contacts(workspace_id,first_name) values (:'wa','Sensitive contact') returning id as contact_id \gset
insert into public.company_contacts(workspace_id,company_id,contact_id,job_title) values (:'wa',:'company_id',:'contact_id','Director');
set local role authenticated;
select pg_temp.check_true(not exists(select 1 from public.companies where workspace_id=:'wa' and id=:'foreign_id'),'workspace filter excludes foreign IDs even with membership in both');
select set_config('request.jwt.claim.sub','010a0000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)=56 from public.companies),'company reader sees own workspace only');
select pg_temp.check_true(not exists(select 1 from public.companies where id=:'foreign_id'),'foreign detail hidden by RLS');
select pg_temp.check_true(not exists(select 1 from public.contacts),'contacts hidden without view');
select pg_temp.check_true(not exists(select 1 from public.company_contacts),'relationships hidden without contacts view');
select pg_temp.check_true((select count(*)=6 from (select id from public.companies order by created_at desc,id limit 50 offset 50) p),'second page');
select pg_temp.check_true((select count(*)=55 from public.companies where name ilike 'Company %'),'search');
reset role;
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='CONTACTS_VIEW';
set local role authenticated;
select pg_temp.check_true((select count(*)=1 from public.company_contacts cc join public.contacts c on c.workspace_id=cc.workspace_id and c.id=cc.contact_id where cc.company_id=:'company_id'),'both view permissions reveal linked contact');
reset role;
delete from public.role_permissions where role_id=:'reader_role';
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code in ('COMPANIES_MANAGE','CONTACTS_MANAGE');
set local role authenticated;
select pg_temp.check_true(not exists(select 1 from public.companies),'manage-only company SELECT blocked');
select pg_temp.check_true(not exists(select 1 from public.company_contacts),'manage-only relationship SELECT blocked');
reset role;
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='COMPANIES_VIEW';
set local role authenticated;
select pg_temp.check_true(not exists(select 1 from public.company_contacts),'both manage plus company view cannot expose contact link metadata');
reset role;
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='CONTACTS_VIEW';
update public.workspace_members set status='DISABLED' where workspace_id=:'wa' and user_id='010a0000-0000-0000-0000-000000000002';
set local role authenticated;
select pg_temp.check_true(not exists(select 1 from public.companies),'disabled membership blocks companies');
select pg_temp.check_true(not exists(select 1 from public.company_contacts),'disabled membership blocks relationships');
rollback;
