begin;

-- =========================================================
-- PRODUCT IMAGE STORAGE
-- =========================================================
--
-- Product catalog images are public assets.
-- Upload/delete operations remain workspace-scoped and require
-- PRODUCTS_MANAGE through the existing RBAC helper.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array[
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- =========================================================
-- INSERT / UPLOAD
-- =========================================================
--
-- Required object path:
--
--   {workspace_id}/{generated-file-name}
--
-- workspace_id in the path must correspond to a workspace in which
-- the authenticated user has PRODUCTS_MANAGE.

create policy product_images_insert_authorized
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and array_length(storage.foldername(name), 1) >= 1
  and (storage.foldername(name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'PRODUCTS_MANAGE'
  )
);


-- =========================================================
-- DELETE / REPLACE CLEANUP
-- =========================================================
--
-- Needed when an existing Product image is replaced and the application
-- removes the previous object.

create policy product_images_delete_authorized
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and array_length(storage.foldername(name), 1) >= 1
  and (storage.foldername(name))[1] ~*
      '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  and private.has_permission(
    ((storage.foldername(name))[1])::uuid,
    'PRODUCTS_MANAGE'
  )
);

commit;
