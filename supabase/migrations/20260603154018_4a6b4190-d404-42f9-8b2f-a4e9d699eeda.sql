
-- Replace the broad "owner all" backups policy with admin-only enforcement
DROP POLICY IF EXISTS "backups owner all" ON public.backups;

CREATE POLICY "backups admin all"
ON public.backups FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() = user_id)
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) AND auth.uid() = user_id);

-- Replace permissive backups storage policies with admin-only checks
DROP POLICY IF EXISTS "backups own select" ON storage.objects;
DROP POLICY IF EXISTS "backups own insert" ON storage.objects;
DROP POLICY IF EXISTS "backups own update" ON storage.objects;
DROP POLICY IF EXISTS "backups own delete" ON storage.objects;

CREATE POLICY "backups admin select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "backups admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "backups admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

CREATE POLICY "backups admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'backups'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
  AND (auth.uid())::text = (storage.foldername(name))[1]
);
