begin;

-- Permissive FOR ALL manage policies also authorize reads. Require explicit
-- view permissions for Deals and their configurable Pipeline/Stage metadata.
create policy deals_require_view
on public.deals as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'DEALS_VIEW'));

create policy pipelines_require_view
on public.pipelines as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'PIPELINES_VIEW'));

create policy stages_require_view
on public.stages as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'PIPELINES_VIEW'));

create policy pipelines_update_require_view
on public.pipelines as restrictive for update to authenticated
using (private.has_permission(workspace_id, 'PIPELINES_VIEW'))
with check (private.has_permission(workspace_id, 'PIPELINES_VIEW'));

create policy stages_update_require_view
on public.stages as restrictive for update to authenticated
using (private.has_permission(workspace_id, 'PIPELINES_VIEW'))
with check (private.has_permission(workspace_id, 'PIPELINES_VIEW'));

-- Match application edit semantics while preserving DEALS_MANAGE-only INSERT.
create policy deals_update_require_view
on public.deals as restrictive for update to authenticated
using (private.has_permission(workspace_id, 'DEALS_VIEW'))
with check (private.has_permission(workspace_id, 'DEALS_VIEW'));

commit;
