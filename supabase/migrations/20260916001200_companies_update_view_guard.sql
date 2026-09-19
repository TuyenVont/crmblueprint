-- SELECT guards do not cover UPDATE statements that do not read any columns
-- (for example, an unfiltered UPDATE without RETURNING). Match edit authorization
-- at the database boundary while preserving COMPANIES_MANAGE-only INSERT.
begin;
create policy companies_update_require_view
on public.companies as restrictive for update to authenticated
using (private.has_permission(workspace_id, 'COMPANIES_VIEW'))
with check (private.has_permission(workspace_id, 'COMPANIES_VIEW'));
commit;
