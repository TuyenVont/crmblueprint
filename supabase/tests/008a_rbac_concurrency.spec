# PostgreSQL isolationtester input. Use ONLY a disposable migrated database.
setup
{
  insert into auth.users(id, email, raw_user_meta_data) values
    ('008b0000-0000-0000-0000-000000000001', 'race1@example.invalid', null),
    ('008b0000-0000-0000-0000-000000000002', 'race2@example.invalid', null);
  select set_config('request.jwt.claim.sub', '008b0000-0000-0000-0000-000000000001', false);
  select public.create_workspace('RBAC concurrency', 'rbac-008a-concurrency');
  insert into public.workspace_members(workspace_id, user_id, role_id)
  select r.workspace_id, '008b0000-0000-0000-0000-000000000002', r.id
  from public.roles r join public.workspaces w on w.id = r.workspace_id
  where w.slug = 'rbac-008a-concurrency' and r.name = 'Owner';
}

teardown
{
  delete from public.workspaces where slug = 'rbac-008a-concurrency';
  delete from auth.users where id in (
    '008b0000-0000-0000-0000-000000000001', '008b0000-0000-0000-0000-000000000002');
}

session "owner1"
setup { set role authenticated; select set_config('request.jwt.claim.sub', '008b0000-0000-0000-0000-000000000001', false); }
step "a_begin" { begin; }
step "a_disable" {
  select public.disable_workspace_member(w.id, m.id)
  from public.workspaces w join public.workspace_members m on m.workspace_id = w.id
  where w.slug = 'rbac-008a-concurrency' and m.user_id = auth.uid();
}
step "a_commit" { commit; }
step "a_demote_b" {
  select public.change_member_role(w.id, m.id, r.id)
  from public.workspaces w
  join public.workspace_members m on m.workspace_id = w.id
  join public.roles r on r.workspace_id = w.id and r.name = 'Sales'
  where w.slug = 'rbac-008a-concurrency'
    and m.user_id = '008b0000-0000-0000-0000-000000000002';
}

session "owner2"
setup { set role authenticated; select set_config('request.jwt.claim.sub', '008b0000-0000-0000-0000-000000000002', false); }
step "b_begin" { begin; }
step "b_repeatable" { begin isolation level repeatable read; }
step "b_disable" {
  select public.disable_workspace_member(w.id, m.id)
  from public.workspaces w join public.workspace_members m on m.workspace_id = w.id
  where w.slug = 'rbac-008a-concurrency' and m.user_id = auth.uid();
}
step "b_commit" { commit; }

permutation "a_begin" "b_begin" "a_disable" "b_disable" "a_commit" "b_commit"
permutation "a_begin" "b_repeatable" "a_disable" "b_disable" "a_commit" "b_commit"
permutation "a_begin" "b_begin" "a_demote_b" "b_disable" "a_commit" "b_commit"
