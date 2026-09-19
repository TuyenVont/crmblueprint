begin;

-- Permissive FOR ALL manage policies also authorize SELECT. Require explicit
-- read permissions at the database boundary for both leads and their sources.
create policy leads_require_view
on public.leads as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'LEADS_VIEW'));

create policy lead_sources_require_view
on public.lead_sources as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'LEAD_SOURCES_VIEW'));

commit;
