-- Permissive FOR ALL manage policies also grant SELECT. Require view permissions
-- at the final database boundary, including relationship IDs and metadata.
begin;
create policy companies_require_view
on public.companies as restrictive for select to authenticated
using (private.has_permission(workspace_id, 'COMPANIES_VIEW'));

create policy company_contacts_require_views
on public.company_contacts as restrictive for select to authenticated
using (
  private.has_permission(workspace_id, 'COMPANIES_VIEW')
  and private.has_permission(workspace_id, 'CONTACTS_VIEW')
);
commit;
