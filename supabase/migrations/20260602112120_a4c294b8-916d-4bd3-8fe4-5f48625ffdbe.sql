CREATE POLICY "backups own select" ON storage.objects FOR SELECT
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "backups own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "backups own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "backups own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);