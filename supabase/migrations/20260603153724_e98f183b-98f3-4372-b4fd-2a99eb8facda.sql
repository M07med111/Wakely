
-- 1. Add UPDATE policy on storage.objects for the 'documents' bucket
CREATE POLICY "documents bucket update own"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2. Fix ai_prompt_templates read policy: require authentication
DROP POLICY IF EXISTS "ai_templates read" ON public.ai_prompt_templates;
CREATE POLICY "ai_templates read"
ON public.ai_prompt_templates FOR SELECT TO authenticated
USING (is_global = true OR auth.uid() = user_id);

-- 3. Lock down SECURITY DEFINER function execution to least privilege
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
