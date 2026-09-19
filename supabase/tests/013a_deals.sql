\set ON_ERROR_STOP on
begin;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'Failed: %', label; end if; end; $$;
create function pg_temp.expect_error(statement text, expected text) returns void language plpgsql as $$ begin begin execute statement; exception when others then if sqlerrm not like '%' || expected || '%' then raise exception 'Expected %, got %', expected, sqlerrm; end if; return; end; raise exception 'Expected rejection: %', statement; end; $$;

insert into auth.users(id,email,raw_user_meta_data) values
('013a0000-0000-0000-0000-000000000001','owner013a@example.invalid','{}'),
('013a0000-0000-0000-0000-000000000002','creator013a@example.invalid','{}'),
('013a0000-0000-0000-0000-000000000003','editor013a@example.invalid','{}'),
('013a0000-0000-0000-0000-000000000004','reader013a@example.invalid','{}'),
('013a0000-0000-0000-0000-000000000005','pipeline-manager013a@example.invalid','{}');
set local role authenticated;
select set_config('request.jwt.claim.sub','013a0000-0000-0000-0000-000000000001',true);
select public.create_workspace('Deals A','deals-013a-a') as wa \gset
select public.create_workspace('Deals B','deals-013a-b') as wb \gset
reset role;

insert into public.roles(workspace_id,name) values (:'wa','Deal creator') returning id as creator_role \gset
insert into public.role_permissions(role_id,permission_id) select :'creator_role',id from public.permissions where code in ('DEALS_MANAGE','PIPELINES_VIEW');
insert into public.roles(workspace_id,name) values (:'wa','Deal editor') returning id as editor_role \gset
insert into public.role_permissions(role_id,permission_id) select :'editor_role',id from public.permissions where code in ('DEALS_VIEW','DEALS_MANAGE','PIPELINES_VIEW','CONTACTS_VIEW','COMPANIES_VIEW');
insert into public.roles(workspace_id,name) values (:'wa','Deal reader') returning id as reader_role \gset
insert into public.role_permissions(role_id,permission_id) select :'reader_role',id from public.permissions where code='DEALS_VIEW';
insert into public.roles(workspace_id,name) values (:'wa','Pipeline manager') returning id as pipeline_manager_role \gset
insert into public.role_permissions(role_id,permission_id) select :'pipeline_manager_role',id from public.permissions where code='PIPELINES_MANAGE';
insert into public.workspace_members(workspace_id,user_id,role_id,status) values
(:'wa','013a0000-0000-0000-0000-000000000002',:'creator_role','ACTIVE'),
(:'wa','013a0000-0000-0000-0000-000000000003',:'editor_role','ACTIVE'),
(:'wa','013a0000-0000-0000-0000-000000000004',:'reader_role','ACTIVE'),
(:'wa','013a0000-0000-0000-0000-000000000005',:'pipeline_manager_role','ACTIVE');

select id as pipeline_a from public.pipelines where workspace_id=:'wa' and is_default limit 1 \gset
select id as stage_a from public.stages where workspace_id=:'wa' and pipeline_id=:'pipeline_a' order by position limit 1 \gset
select id as pipeline_b from public.pipelines where workspace_id=:'wb' and is_default limit 1 \gset
select id as stage_b from public.stages where workspace_id=:'wb' and pipeline_id=:'pipeline_b' order by position limit 1 \gset
insert into public.pipelines(workspace_id,name) values (:'wa','Second pipeline') returning id as pipeline_a2 \gset
insert into public.stages(workspace_id,pipeline_id,name,position) values (:'wa',:'pipeline_a2','Other stage',0) returning id as stage_a2 \gset
insert into public.contacts(workspace_id,first_name) values (:'wa','Contact A') returning id as contact_a \gset
insert into public.contacts(workspace_id,first_name) values (:'wb','Contact B') returning id as contact_b \gset
insert into public.companies(workspace_id,name) values (:'wa','Company A') returning id as company_a \gset
insert into public.companies(workspace_id,name) values (:'wb','Company B') returning id as company_b \gset
insert into public.deals(workspace_id,name,amount,currency,pipeline_id,stage_id,contact_id,company_id) values (:'wa','Deal A',100,'USD',:'pipeline_a',:'stage_a',:'contact_a',:'company_a') returning id as deal_a \gset
insert into public.deals(workspace_id,name,amount,currency,pipeline_id,stage_id) values (:'wb','Deal B',200,'USD',:'pipeline_b',:'stage_b') returning id as deal_b \gset
create temp table before_deal as select * from public.deals where id=:'deal_a';

set local role authenticated;
select set_config('request.jwt.claim.sub','013a0000-0000-0000-0000-000000000002',true);
select pg_temp.check_true(not exists(select 1 from public.deals),'manage-only user cannot read deals');
insert into public.deals(workspace_id,name,amount,currency,pipeline_id,stage_id) values (:'wa','Creator deal',1.25,'USD',:'pipeline_a',:'stage_a');
select pg_temp.expect_error(format('insert into public.deals(workspace_id,name,currency,pipeline_id,stage_id) values (%L,%L,%L,%L,%L)',:'wb','Foreign','USD',:'pipeline_b',:'stage_b'),'row-level security');
with changed as (update public.deals set name='Manage-only edit' where id=:'deal_a' returning id) select pg_temp.check_true((select count(*)=0 from changed),'manage-only cannot update without DEALS_VIEW');

select set_config('request.jwt.claim.sub','013a0000-0000-0000-0000-000000000003',true);
select pg_temp.check_true((select count(*)=1 from public.deals where id=:'deal_a') and not exists(select 1 from public.deals where id=:'deal_b'),'reader sees only workspace A');
update public.deals set name='Edited',amount=123.45,expected_close_date='2026-10-01' where id=:'deal_a';
with changed as (update public.deals set name='Foreign changed' where id=:'deal_b' returning id) select pg_temp.check_true((select count(*)=0 from changed),'workspace A cannot edit workspace B deal');
select pg_temp.expect_error(format('update public.deals set pipeline_id=%L,stage_id=%L where id=%L',:'pipeline_b',:'stage_b',:'deal_a'),'deals_pipeline_same_workspace_fk');
select pg_temp.expect_error(format('update public.deals set pipeline_id=%L,stage_id=%L where id=%L',:'pipeline_a',:'stage_a2',:'deal_a'),'deals_stage_same_pipeline_workspace_fk');
select pg_temp.expect_error(format('update public.deals set contact_id=%L where id=%L',:'contact_b',:'deal_a'),'deals_contact_same_workspace_fk');
select pg_temp.expect_error(format('update public.deals set company_id=%L where id=%L',:'company_b',:'deal_a'),'deals_company_same_workspace_fk');
select pg_temp.expect_error(format('update public.deals set amount=-1 where id=%L',:'deal_a'),'deals_amount_non_negative');

select set_config('request.jwt.claim.sub','013a0000-0000-0000-0000-000000000005',true);
select pg_temp.check_true(not exists(select 1 from public.pipelines) and not exists(select 1 from public.stages),'pipeline manage alone cannot read pipeline metadata');
with changed as (update public.pipelines set name='Hidden update' where id=:'pipeline_a' returning id) select pg_temp.check_true((select count(*)=0 from changed),'pipeline manage alone cannot update pipelines');
with changed as (update public.stages set name='Hidden update' where id=:'stage_a' returning id) select pg_temp.check_true((select count(*)=0 from changed),'pipeline manage alone cannot update stages');
insert into public.pipelines(workspace_id,name) values (:'wa','Manager-created pipeline');

reset role;
select pg_temp.check_true((select d.workspace_id=b.workspace_id and d.owner_user_id is not distinct from b.owner_user_id and d.source_id is not distinct from b.source_id and d.won_at is not distinct from b.won_at and d.lost_at is not distinct from b.lost_at and d.created_at=b.created_at from public.deals d join before_deal b on d.id=b.id),'normal edit preserves protected fields');
set local role authenticated;
select set_config('request.jwt.claim.sub','013a0000-0000-0000-0000-000000000004',true);
select pg_temp.expect_error(format('insert into public.deals(workspace_id,name,currency,pipeline_id,stage_id) values (%L,%L,%L,%L,%L)',:'wa','Reader create','USD',:'pipeline_a',:'stage_a'),'row-level security');
with changed as (update public.deals set name='Reader edit' where id=:'deal_a' returning id) select pg_temp.check_true((select count(*)=0 from changed),'reader cannot update');
set local role anon;
select pg_temp.expect_error('select * from public.deals','permission denied');
select pg_temp.expect_error(format('insert into public.deals(workspace_id,name,currency,pipeline_id,stage_id) values (%L,%L,%L,%L,%L)',:'wa','Anon','USD',:'pipeline_a',:'stage_a'),'permission denied');
rollback;
