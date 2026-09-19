\set ON_ERROR_STOP on
begin;

create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Failed: %', label; end if; end;
$$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlerrm not like '%' || expected || '%' then raise exception 'Expected %, got %', expected, sqlerrm; end if;
    return;
  end;
  raise exception 'Expected rejection: %', statement;
end;
$$;

insert into auth.users(id,email,raw_user_meta_data) values
('010c0000-0000-0000-0000-000000000001','owner010c@example.invalid','{}'),
('010c0000-0000-0000-0000-000000000002','manager010c@example.invalid','{}'),
('010c0000-0000-0000-0000-000000000003','manageonly010c@example.invalid','{}'),
('010c0000-0000-0000-0000-000000000004','reader010c@example.invalid','{}');

set local role authenticated;
select set_config('request.jwt.claim.sub','010c0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Relationships A','relationships-010c-a') as wa \gset
select public.create_workspace('Relationships B','relationships-010c-b') as wb \gset
reset role;

insert into public.roles(workspace_id,name) values (:'wa','Relationship manager') returning id as manager_role \gset
insert into public.role_permissions(role_id,permission_id)
select :'manager_role',id from public.permissions where code in ('COMPANIES_VIEW','CONTACTS_VIEW','COMPANIES_MANAGE','CONTACTS_MANAGE');
insert into public.roles(workspace_id,name) values (:'wa','Manage without read') returning id as manage_role \gset
insert into public.role_permissions(role_id,permission_id)
select :'manage_role',id from public.permissions where code in ('COMPANIES_MANAGE','CONTACTS_MANAGE');
insert into public.roles(workspace_id,name) values (:'wa','Relationship reader') returning id as reader_role \gset
insert into public.role_permissions(role_id,permission_id)
select :'reader_role',id from public.permissions where code in ('COMPANIES_VIEW','CONTACTS_VIEW');
insert into public.workspace_members(workspace_id,user_id,role_id,status) values
(:'wa','010c0000-0000-0000-0000-000000000002',:'manager_role','ACTIVE'),
(:'wa','010c0000-0000-0000-0000-000000000003',:'manage_role','ACTIVE'),
(:'wa','010c0000-0000-0000-0000-000000000004',:'reader_role','ACTIVE');

insert into public.companies(workspace_id,name) values (:'wa','Company A') returning id as company_a \gset
insert into public.companies(workspace_id,name) values (:'wa','Company A2') returning id as company_a2 \gset
insert into public.contacts(workspace_id,first_name) values (:'wa','Contact A') returning id as contact_a \gset
insert into public.contacts(workspace_id,first_name) values (:'wa','Contact A2') returning id as contact_a2 \gset
insert into public.companies(workspace_id,name) values (:'wb','Company B') returning id as company_b \gset
insert into public.contacts(workspace_id,first_name) values (:'wb','Contact B') returning id as contact_b \gset
insert into public.company_contacts(workspace_id,company_id,contact_id) values (:'wb',:'company_b',:'contact_b') returning id as link_b \gset

set local role authenticated;
select set_config('request.jwt.claim.sub','010c0000-0000-0000-0000-000000000002',true);
insert into public.company_contacts(workspace_id,company_id,contact_id,job_title,is_primary) values (:'wa',:'company_a',:'contact_a','Director',true) returning id as link_a \gset
insert into public.company_contacts(workspace_id,company_id,contact_id,job_title,is_primary) values (:'wa',:'company_a',:'contact_a2','Engineer',false) returning id as sibling_link \gset
insert into public.company_contacts(workspace_id,company_id,contact_id,job_title,is_primary) values (:'wa',:'company_a2',:'contact_a','Advisor',false) returning id as other_link \gset
select pg_temp.check_true((select count(*)=3 from public.company_contacts),'authorized user reads only active-workspace relationships');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_a',:'contact_a'),'company_contacts_company_contact_unique');
select pg_temp.check_true((select job_title='Director' and is_primary from public.company_contacts where id=:'link_a'),'duplicate attempt preserves existing relationship metadata');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_a',:'contact_b'),'company_contacts_contact_same_workspace_fk');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_b',:'contact_a'),'company_contacts_company_same_workspace_fk');
with removed as (delete from public.company_contacts where id=:'link_b' returning id)
select pg_temp.check_true((select count(*)=0 from removed),'workspace A cannot unlink workspace B relationship');
delete from public.company_contacts where id=:'link_a';
reset role;
select pg_temp.check_true(exists(select 1 from public.contacts where id=:'contact_a'),'unlink preserves contact');
select pg_temp.check_true(exists(select 1 from public.companies where id=:'company_a'),'unlink preserves company');
select pg_temp.check_true((select job_title='Engineer' and not is_primary from public.company_contacts where id=:'sibling_link'),'unlink preserves sibling relationship and metadata');
select pg_temp.check_true((select job_title='Advisor' and not is_primary from public.company_contacts where id=:'other_link'),'unlink preserves unrelated relationship and metadata');
select pg_temp.check_true(exists(select 1 from public.company_contacts where id=:'link_b'),'foreign relationship remains');

set local role authenticated;
select set_config('request.jwt.claim.sub','010c0000-0000-0000-0000-000000000004',true);
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_a2',:'contact_a2'),'row-level security');
with removed as (delete from public.company_contacts where workspace_id=:'wa' returning id)
select pg_temp.check_true((select count(*)=0 from removed),'view-only user cannot unlink');

select set_config('request.jwt.claim.sub','010c0000-0000-0000-0000-000000000003',true);
select pg_temp.check_true(not exists(select 1 from public.company_contacts),'manage-only user cannot read relationship identifiers');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_a2',:'contact_a2'),'row-level security');
with removed as (delete from public.company_contacts where workspace_id=:'wa' returning id)
select pg_temp.check_true((select count(*)=0 from removed),'manage-only user cannot unlink through direct database access');

set local role anon;
select pg_temp.expect_error('select * from public.company_contacts','permission denied');
select pg_temp.expect_error(format('insert into public.company_contacts(workspace_id,company_id,contact_id) values (%L,%L,%L)',:'wa',:'company_a2',:'contact_a2'),'permission denied');

rollback;
