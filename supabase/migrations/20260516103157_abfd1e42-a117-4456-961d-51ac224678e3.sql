-- Phase 1: schema extensions for lawyer management system

-- 1) clients: add email + power of attorney fields
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS poa_number text,
  ADD COLUMN IF NOT EXISTS poa_year integer,
  ADD COLUMN IF NOT EXISTS poa_letter text,
  ADD COLUMN IF NOT EXISTS poa_type text CHECK (poa_type IN ('عام','خاص')),
  ADD COLUMN IF NOT EXISTS poa_file_path text;

-- 2) cases: split case number + add category + location
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS case_year integer,
  ADD COLUMN IF NOT EXISTS case_category text,
  ADD COLUMN IF NOT EXISTS court_location text;

-- 3) payments: total amount for partial-payment tracking
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS total_amount numeric;

UPDATE public.payments SET total_amount = amount WHERE total_amount IS NULL;

-- 4) payment installments
CREATE TABLE IF NOT EXISTS public.payment_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL,
  user_id uuid NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  paid_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "installments owner all" ON public.payment_installments;
CREATE POLICY "installments owner all" ON public.payment_installments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_installments_payment ON public.payment_installments(payment_id);

-- 5) case activities (timeline)
CREATE TABLE IF NOT EXISTS public.case_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL,
  user_id uuid NOT NULL,
  type text NOT NULL,
  description text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.case_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "activities owner all" ON public.case_activities;
CREATE POLICY "activities owner all" ON public.case_activities
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_activities_case ON public.case_activities(case_id, created_at DESC);

-- 6) documents: OCR text
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS ocr_text text;
CREATE INDEX IF NOT EXISTS idx_documents_case ON public.documents(case_id);

-- 7) storage bucket for case documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-documents', 'case-documents', false)
ON CONFLICT (id) DO NOTHING;

-- storage RLS: per-user folder isolation (path = <user_id>/...)
DROP POLICY IF EXISTS "case-docs read own" ON storage.objects;
CREATE POLICY "case-docs read own" ON storage.objects
  FOR SELECT USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "case-docs insert own" ON storage.objects;
CREATE POLICY "case-docs insert own" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "case-docs update own" ON storage.objects;
CREATE POLICY "case-docs update own" ON storage.objects
  FOR UPDATE USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "case-docs delete own" ON storage.objects;
CREATE POLICY "case-docs delete own" ON storage.objects
  FOR DELETE USING (bucket_id = 'case-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
