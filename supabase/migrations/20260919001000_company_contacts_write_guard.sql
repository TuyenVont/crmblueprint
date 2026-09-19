begin;

-- Relationship changes expose and connect both entity types. Require explicit
-- read and manage permissions for both sides in addition to the existing
-- permissive manage policy.
create policy company_contacts_write_require_views
on public.company_contacts as restrictive for all to authenticated
using (
  private.has_permission(workspace_id, 'COMPANIES_VIEW')
  and private.has_permission(workspace_id, 'CONTACTS_VIEW')
)
with check (
  private.has_permission(workspace_id, 'COMPANIES_VIEW')
  and private.has_permission(workspace_id, 'CONTACTS_VIEW')
);

commit;
