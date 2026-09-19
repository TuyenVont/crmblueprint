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
('011b0000-0000-0000-0000-000000000001','owner011b@example.invalid','{}'),
('011b0000-0000-0000-0000-000000000002','creator011b@example.invalid','{}'),
('011b0000-0000-0000-0000-000000000003','editor011b@example.invalid','{}'),
('011b0000-0000-0000-0000-000000000004','reader011b@example.invalid','{}');

set local role authenticated;
select set_config('request.jwt.claim.sub','011b0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Lead Writes A','lead-writes-011b-a') as wa \gset
select public.create_workspace('Lead Writes B','lead-writes-011b-b') as wb \gset
reset role;

insert into public.roles(workspace_id,name) values (:'wa','Lead creator') returning id as creator_role \gset
insert into public.role_permissions(role_id,permission_id) select :'creator_role',id from public.permissions where code='LEADS_MANAGE';
insert into public.roles(workspace_id,name) values (:'wa','Lead editor') returning id as editor_role \gset
insert into public.role_permissions(role_id,permission_id) select :'editor_role',id from public.permissions where code in ('LEADS_VIEW','LEADS_MANAGE','LEAD_SOURCES_VIEW');
insert into public.roles(workspace_id,name) values (:'wa','Lead reader') returning id as reader_role \gset
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='LEADS_VIEW';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values
(:'wa','011b0000-0000-0000-0000-000000000002',:'creator_role','ACTIVE'),
(:'wa','011b0000-0000-0000-0000-000000000003',:'editor_role','ACTIVE'),
(:'wa','011b0000-0000-0000-0000-000000000004',:'reader_role','ACTIVE');

insert into public.lead_sources(workspace_id,name) values (:'wa','Local source') returning id as source_a \gset
insert into public.lead_sources(workspace_id,name) values (:'wb','Foreign source') returning id as source_b \gset
insert into public.leads(workspace_id,first_name,source_id,owner_user_id) values (:'wa','Lead A',:'source_a','011b0000-0000-0000-0000-000000000001') returning id as lead_a \gset
insert into public.leads(workspace_id,first_name) values (:'wb','Lead B') returning id as lead_b \gset
create temp table before_lead as select * from public.leads where id=:'lead_a';

set local role authenticated;
select set_config('request.jwt.claim.sub','011b0000-0000-0000-0000-000000000002',true);
insert into public.leads(workspace_id,first_name,status) values (:'wa','Creator Lead','NEW');
select pg_temp.check_true(not exists(select 1 from public.leads),'manage-only creator still cannot read');
select pg_temp.expect_error(format('insert into public.leads(workspace_id,first_name) values (%L,%L)',:'wb','Forged workspace'),'row-level security');
with changed as (update public.leads set first_name='Manage-only edit' where workspace_id=:'wa' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'manage-only user cannot update without LEADS_VIEW');

select set_config('request.jwt.claim.sub','011b0000-0000-0000-0000-000000000003',true);
update public.leads set first_name='Edited Lead',last_name='Local',email='lead@example.invalid',phone='123',company_name='Acme',status='QUALIFIED',notes='Note',source_id=:'source_a' where workspace_id=:'wa' and id=:'lead_a';
select pg_temp.check_true((select first_name='Edited Lead' and status='QUALIFIED' and source_id=:'source_a' from public.leads where id=:'lead_a'),'authorized editor updates allowlisted business fields');
with changed as (update public.leads set first_name='Foreign changed' where id=:'lead_b' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'workspace A cannot update workspace B lead');
with changed as (update public.leads set first_name='Missing changed' where id='011b9999-9999-9999-9999-999999999999' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'missing and foreign update produce no rows');
select pg_temp.expect_error(format('update public.leads set source_id=%L where id=%L',:'source_b',:'lead_a'),'leads_source_same_workspace_fk');
select pg_temp.expect_error(format('update public.leads set status=%L where id=%L','INVALID',:'lead_a'),'leads_status_check');
select pg_temp.expect_error(format('update public.leads set status=%L where id=%L','CONVERTED',:'lead_a'),'leads_conversion_status_check');

reset role;
select pg_temp.check_true((select l.workspace_id=b.workspace_id and l.owner_user_id=b.owner_user_id and l.converted_at is not distinct from b.converted_at and l.converted_contact_id is not distinct from b.converted_contact_id and l.converted_company_id is not distinct from b.converted_company_id and l.converted_deal_id is not distinct from b.converted_deal_id and l.created_at=b.created_at from public.leads l join before_lead b on l.id=b.id),'normal edit preserves protected and conversion fields');

set local role authenticated;
select set_config('request.jwt.claim.sub','011b0000-0000-0000-0000-000000000004',true);
select pg_temp.expect_error(format('insert into public.leads(workspace_id,first_name) values (%L,%L)',:'wa','Reader create'),'row-level security');
with changed as (update public.leads set first_name='Reader edit' where id=:'lead_a' returning id)
select pg_temp.check_true((select count(*)=0 from changed),'read-only user cannot update');

set local role anon;
select pg_temp.expect_error(format('insert into public.leads(workspace_id,first_name) values (%L,%L)',:'wa','Anonymous create'),'permission denied');
select pg_temp.expect_error(format('update public.leads set first_name=%L where id=%L','Anonymous edit',:'lead_a'),'permission denied');

rollback;
