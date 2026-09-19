begin;

-- =========================================================
-- PRODUCTS READ / UPDATE GUARDS
-- =========================================================
--
-- The existing PRODUCTS_MANAGE policy is FOR ALL and therefore can also
-- authorize SELECT/UPDATE through permissive-policy OR semantics.
--
-- Require explicit PRODUCTS_VIEW for reads and edits while preserving
-- PRODUCTS_MANAGE-only INSERT behavior.

create policy products_require_view
on public.products as restrictive
for select
to authenticated
using (
  private.has_permission(workspace_id, 'PRODUCTS_VIEW')
);

create policy products_update_require_view
on public.products as restrictive
for update
to authenticated
using (
  private.has_permission(workspace_id, 'PRODUCTS_VIEW')
)
with check (
  private.has_permission(workspace_id, 'PRODUCTS_VIEW')
);


-- =========================================================
-- DEAL ITEMS READ / UPDATE GUARDS
-- =========================================================
--
-- Deal Items follow the parent Deal permission model:
--   read   -> DEALS_VIEW
--   manage -> DEALS_MANAGE
--
-- The existing DEALS_MANAGE FOR ALL policy can otherwise authorize
-- SELECT/UPDATE without DEALS_VIEW.

create policy deal_items_require_view
on public.deal_items as restrictive
for select
to authenticated
using (
  private.has_permission(workspace_id, 'DEALS_VIEW')
);

create policy deal_items_update_require_view
on public.deal_items as restrictive
for update
to authenticated
using (
  private.has_permission(workspace_id, 'DEALS_VIEW')
)
with check (
  private.has_permission(workspace_id, 'DEALS_VIEW')
);

commit;
