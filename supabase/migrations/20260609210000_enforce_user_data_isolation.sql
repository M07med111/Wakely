-- Enforce strict per-account data isolation for all user-owned application data.
-- Every normal app table must only expose rows where user_id = auth.uid().

-- 1) Make sure RLS is enabled and forced for user-owned tables.
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;

ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases FORCE ROW LEVEL SECURITY;

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents FORCE ROW LEVEL SECURITY;

ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_installments FORCE ROW LEVEL SECURITY;

ALTER TABLE public.case_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_activities FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chats FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_messages FORCE ROW LEVEL SECURITY;

ALTER TABLE public.ai_prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_templates FORCE ROW LEVEL SECURITY;

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.backups FORCE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

-- 2) Replace broad or older policies with exact owner-only policies.
DROP POLICY IF EXISTS "clients owner all" ON public.clients;
DROP POLICY IF EXISTS "clients owner select" ON public.clients;
DROP POLICY IF EXISTS "clients owner insert" ON public.clients;
DROP POLICY IF EXISTS "clients owner update" ON public.clients;
DROP POLICY IF EXISTS "clients admin delete" ON public.clients;
CREATE POLICY "clients owner select" ON public.clients
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "clients owner insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "clients owner update" ON public.clients
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "clients owner delete" ON public.clients
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "cases owner all" ON public.cases;
CREATE POLICY "cases owner all" ON public.cases
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "sessions owner all" ON public.sessions;
CREATE POLICY "sessions owner all" ON public.sessions
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "payments owner all" ON public.payments;
CREATE POLICY "payments owner all" ON public.payments
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "documents owner all" ON public.documents;
CREATE POLICY "documents owner all" ON public.documents
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "installments owner all" ON public.payment_installments;
CREATE POLICY "installments owner all" ON public.payment_installments
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "activities owner all" ON public.case_activities;
CREATE POLICY "activities owner all" ON public.case_activities
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_chats owner all" ON public.ai_chats;
CREATE POLICY "ai_chats owner all" ON public.ai_chats
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_messages owner all" ON public.ai_messages;
CREATE POLICY "ai_messages owner all" ON public.ai_messages
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_templates read" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_templates insert" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_templates update" ON public.ai_prompt_templates;
DROP POLICY IF EXISTS "ai_templates delete" ON public.ai_prompt_templates;
CREATE POLICY "ai_templates read" ON public.ai_prompt_templates
  FOR SELECT TO authenticated
  USING (is_global = true OR (SELECT auth.uid()) = user_id);
CREATE POLICY "ai_templates insert" ON public.ai_prompt_templates
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_global = false);
CREATE POLICY "ai_templates update" ON public.ai_prompt_templates
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND is_global = false);
CREATE POLICY "ai_templates delete" ON public.ai_prompt_templates
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id AND is_global = false);

DROP POLICY IF EXISTS "backups owner all" ON public.backups;
DROP POLICY IF EXISTS "backups admin all" ON public.backups;
CREATE POLICY "backups owner all" ON public.backups
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile upsert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

-- Users can read their own role; the admin Edge Function uses service_role for user management.
DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- 3) Keep storage objects isolated by user-id folder prefixes.
DROP POLICY IF EXISTS "documents bucket select own" ON storage.objects;
DROP POLICY IF EXISTS "documents bucket insert own" ON storage.objects;
DROP POLICY IF EXISTS "documents bucket update own" ON storage.objects;
DROP POLICY IF EXISTS "documents bucket delete own" ON storage.objects;
CREATE POLICY "documents bucket select own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "documents bucket insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "documents bucket update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "documents bucket delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "case-docs read own" ON storage.objects;
DROP POLICY IF EXISTS "case-docs insert own" ON storage.objects;
DROP POLICY IF EXISTS "case-docs update own" ON storage.objects;
DROP POLICY IF EXISTS "case-docs delete own" ON storage.objects;
CREATE POLICY "case-docs read own" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'case-documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "case-docs insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'case-documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "case-docs update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'case-documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'case-documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "case-docs delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'case-documents' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "backups own select" ON storage.objects;
DROP POLICY IF EXISTS "backups own insert" ON storage.objects;
DROP POLICY IF EXISTS "backups own update" ON storage.objects;
DROP POLICY IF EXISTS "backups own delete" ON storage.objects;
DROP POLICY IF EXISTS "backups admin select" ON storage.objects;
DROP POLICY IF EXISTS "backups admin insert" ON storage.objects;
DROP POLICY IF EXISTS "backups admin update" ON storage.objects;
DROP POLICY IF EXISTS "backups admin delete" ON storage.objects;
CREATE POLICY "backups own select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'backups' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "backups own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'backups' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "backups own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'backups' AND (SELECT auth.uid())::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'backups' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);
CREATE POLICY "backups own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'backups' AND (SELECT auth.uid())::text = (storage.foldername(name))[1]);

-- 4) Add future-row ownership guarantees. NOT VALID avoids breaking existing legacy rows,
-- while still enforcing the constraint on new inserts and updates.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_chats_user_id_fkey') THEN
    ALTER TABLE public.ai_chats
      ADD CONSTRAINT ai_chats_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_messages_user_id_fkey') THEN
    ALTER TABLE public.ai_messages
      ADD CONSTRAINT ai_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payment_installments_user_id_fkey') THEN
    ALTER TABLE public.payment_installments
      ADD CONSTRAINT payment_installments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'case_activities_user_id_fkey') THEN
    ALTER TABLE public.case_activities
      ADD CONSTRAINT case_activities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backups_user_id_fkey') THEN
    ALTER TABLE public.backups
      ADD CONSTRAINT backups_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_roles_user_id_fkey') THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;
END $$;

-- 5) Preserve Data API access, with RLS doing the isolation.
GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
