DROP POLICY IF EXISTS "clients owner all" ON public.clients;

CREATE POLICY "clients owner select" ON public.clients
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "clients owner insert" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients owner update" ON public.clients
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clients admin delete" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));