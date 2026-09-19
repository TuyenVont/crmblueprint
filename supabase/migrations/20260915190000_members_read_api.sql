begin;

-- 008B.1: narrowly scoped reads. Existing policies, grants and mutations stay intact.
create function public.get_my_workspace_permissions(p_workspace_id uuid)
returns table(permission_code text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_workspace_member(p_workspace_id) then
    raise exception 'FORBIDDEN';
  end if;
  -- Use the same effective-permission definition as authoritative RBAC checks.
  return query
    select p.code from public.permissions p
    where private.has_permission(p_workspace_id, p.code)
    order by p.code;
end;
$$;

create function public.list_workspace_members(
  p_workspace_id uuid,
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_search text := pg_catalog.lower(pg_catalog.btrim(p_search));
  v_result jsonb;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.is_workspace_member(p_workspace_id)
    or not private.has_permission(p_workspace_id, 'MEMBERS_VIEW') then
    raise exception 'FORBIDDEN';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 100
    or p_offset is null or p_offset < 0
    or pg_catalog.length(v_search) > 200 then
    raise exception 'INVALID_LIST_PARAMETERS';
  end if;

  -- One snapshot for authorization, count and page. The envelope retains the
  -- filtered total even for an empty page. Search treats %, _ and quotes literally.
  with filtered as materialized (
    select m.id as workspace_member_id, m.user_id,
      coalesce(nullif(p.full_name, ''), 'Name unavailable') as display_name,
      u.email::text as email, m.role_id, r.name as role_name,
      r.is_system as role_is_system, m.status, m.created_at as joined_at
    from public.workspace_members m
    join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    join public.roles r on r.id = m.role_id and r.workspace_id = m.workspace_id
    where m.workspace_id = p_workspace_id
      and (v_search is null or v_search = ''
        or pg_catalog.strpos(pg_catalog.lower(coalesce(p.full_name, '')), v_search) > 0
        or pg_catalog.strpos(pg_catalog.lower(coalesce(u.email, '')), v_search) > 0)
  ), page as (
    select f.* from filtered f
    order by f.joined_at, f.workspace_member_id
    limit p_limit offset p_offset
  )
  select pg_catalog.jsonb_build_object(
    'members', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x)
      order by x.joined_at, x.workspace_member_id) from page x), '[]'::jsonb),
    'total', (select pg_catalog.count(*) from filtered)
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function public.get_my_workspace_permissions(uuid) from public, anon, authenticated;
revoke all on function public.list_workspace_members(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_my_workspace_permissions(uuid) to authenticated;
grant execute on function public.list_workspace_members(uuid, text, integer, integer) to authenticated;

commit;
