begin;

-- The existing permissive FOR ALL manage policy also authorizes SELECT.
-- Require explicit view permission, including for manage-only custom roles.
create policy contacts_require_view
on public.contacts as restrictive for all to authenticated
using (private.has_permission(workspace_id, 'CONTACTS_VIEW'))
with check (private.has_permission(workspace_id, 'CONTACTS_VIEW'));

commit;
