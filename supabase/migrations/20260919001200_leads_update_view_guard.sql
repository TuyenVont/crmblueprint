begin;

-- An UPDATE can avoid SELECT policy evaluation when it reads no columns.
-- Preserve LEADS_MANAGE-only INSERT while requiring LEADS_VIEW for edits.
create policy leads_update_require_view
on public.leads as restrictive for update to authenticated
using (private.has_permission(workspace_id, 'LEADS_VIEW'))
with check (private.has_permission(workspace_id, 'LEADS_VIEW'));

commit;
