begin;

-- The existing LEAD_SOURCES_MANAGE policy is permissive FOR ALL. Prevent it
-- from authorizing UPDATE for a role that cannot view Lead Sources, while
-- preserving manage-only INSERT behavior.
create policy lead_sources_update_require_view
on public.lead_sources as restrictive
for update
to authenticated
using (private.has_permission(workspace_id, 'LEAD_SOURCES_VIEW'))
with check (private.has_permission(workspace_id, 'LEAD_SOURCES_VIEW'));

commit;
