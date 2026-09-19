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
('011a0000-0000-0000-0000-000000000001','owner011a@example.invalid','{}'),
('011a0000-0000-0000-0000-000000000002','reader011a@example.invalid','{}'),
('011a0000-0000-0000-0000-000000000003','leadonly011a@example.invalid','{}'),
('011a0000-0000-0000-0000-000000000004','manager011a@example.invalid','{}'),
('011a0000-0000-0000-0000-000000000005','sourcemanager011a@example.invalid','{}');

set local role authenticated;
select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Leads A','leads-011a-a') as wa \gset
select public.create_workspace('Leads B','leads-011a-b') as wb \gset
reset role;

insert into public.roles(workspace_id,name) values (:'wa','Lead reader') returning id as reader_role \gset
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code in ('LEADS_VIEW','LEAD_SOURCES_VIEW');
insert into public.roles(workspace_id,name) values (:'wa','Lead-only reader') returning id as lead_only_role \gset
insert into public.role_permissions(role_id,permission_id) select :'lead_only_role',id from public.permissions where code='LEADS_VIEW';
insert into public.roles(workspace_id,name) values (:'wa','Lead manager without view') returning id as manager_role \gset
insert into public.role_permissions(role_id,permission_id) select :'manager_role',id from public.permissions where code='LEADS_MANAGE';
insert into public.roles(workspace_id,name) values (:'wa','Source manager without view') returning id as source_manager_role \gset
insert into public.role_permissions(role_id,permission_id) select :'source_manager_role',id from public.permissions where code='LEAD_SOURCES_MANAGE';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values
(:'wa','011a0000-0000-0000-0000-000000000002',:'reader_role','ACTIVE'),
(:'wa','011a0000-0000-0000-0000-000000000003',:'lead_only_role','ACTIVE'),
(:'wa','011a0000-0000-0000-0000-000000000004',:'manager_role','ACTIVE'),
(:'wa','011a0000-0000-0000-0000-000000000005',:'source_manager_role','ACTIVE');

insert into public.lead_sources(workspace_id,name) values (:'wa','Website A') returning id as source_a \gset
insert into public.lead_sources(workspace_id,name) values (:'wb','Foreign Secret Source') returning id as source_b \gset
insert into public.leads(workspace_id,first_name,last_name,email,phone,company_name,source_id)
select :'wa','Alice '||n,'Local','alice'||n||'@example.invalid','100'||n,'Company A',:'source_a' from generate_series(1,55) n;
select id as lead_a from public.leads where workspace_id=:'wa' order by id limit 1 \gset
insert into public.leads(workspace_id,first_name,email,company_name,source_id) values (:'wb','Foreign Secret Lead','foreign@example.invalid','Company B',:'source_b') returning id as lead_b \gset

set local role authenticated;
select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000002',true);
select pg_temp.check_true((select count(*)=55 from public.leads),'authorized reader lists only workspace A leads');
select pg_temp.check_true(not exists(select 1 from public.leads where id=:'lead_b'),'foreign lead detail is hidden');
select pg_temp.check_true(not exists(select 1 from public.leads where id='011a9999-9999-9999-9999-999999999999'),'missing and foreign lead IDs both return no rows');
select pg_temp.check_true((select count(*)=55 from public.leads where first_name ilike '%alice%' or email ilike '%alice%' or company_name ilike '%company a%'),'search returns only workspace A leads');
select pg_temp.check_true(not exists(select 1 from public.leads where first_name ilike '%foreign%' or email ilike '%foreign%' or company_name ilike '%company b%'),'workspace A search cannot return workspace B lead');
select pg_temp.check_true((select count(*)=5 from (select id from public.leads order by created_at desc,id limit 50 offset 50) page_two),'stable second page contains remaining leads');
select pg_temp.check_true((select count(*)=55 from public.leads l join public.lead_sources s on s.workspace_id=l.workspace_id and s.id=l.source_id where s.name='Website A'),'authorized source join is workspace scoped');
select pg_temp.check_true(not exists(select 1 from public.lead_sources where id=:'source_b'),'foreign source is hidden');

select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000003',true);
select pg_temp.check_true((select count(*)=55 from public.leads),'LEADS_VIEW reads leads without source permission');
select pg_temp.check_true(not exists(select 1 from public.lead_sources),'lead-only reader cannot infer source data');
select pg_temp.check_true(not exists(select 1 from public.leads l join public.lead_sources s on s.workspace_id=l.workspace_id and s.id=l.source_id),'source join cannot leak without source view permission');

select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000004',true);
select pg_temp.check_true(not exists(select 1 from public.leads),'LEADS_MANAGE cannot bypass LEADS_VIEW');

select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000005',true);
select pg_temp.check_true(not exists(select 1 from public.lead_sources),'LEAD_SOURCES_MANAGE cannot bypass LEAD_SOURCES_VIEW');

select set_config('request.jwt.claim.sub','011a0000-0000-0000-0000-000000000002',true);
select pg_temp.expect_error(format('insert into public.leads(workspace_id,first_name,source_id) values (%L,%L,%L)',:'wa','Cross workspace source',:'source_b'),'row-level security');

set local role anon;
select pg_temp.expect_error('select * from public.leads','permission denied');
select pg_temp.expect_error('select * from public.lead_sources','permission denied');

rollback;
