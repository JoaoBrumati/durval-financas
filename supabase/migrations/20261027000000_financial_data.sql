CREATE TABLE IF NOT EXISTS public.clients (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text NOT NULL,
  address text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  principal numeric(12, 2) NOT NULL CHECK (principal > 0),
  interest numeric(12, 2) NOT NULL DEFAULT 0 CHECK (interest >= 0),
  installment_count integer NOT NULL CHECK (installment_count > 0),
  created_at date NOT NULL,
  UNIQUE (id, user_id)
);

CREATE INDEX IF NOT EXISTS clients_user_created_at_idx
  ON public.clients (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.installments (
  id uuid PRIMARY KEY,
  client_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  number integer NOT NULL CHECK (number > 0),
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('paid', 'open')),
  paid_at date,
  receipt_name text,
  receipt_path text,
  UNIQUE (client_id, number),
  FOREIGN KEY (client_id, user_id)
    REFERENCES public.clients (id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS installments_user_due_date_idx
  ON public.installments (user_id, due_date);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.clients, public.installments FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.clients, public.installments TO authenticated;

DROP POLICY IF EXISTS "Users can manage their own clients" ON public.clients;
CREATE POLICY "Users can manage their own clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own installments" ON public.installments;
CREATE POLICY "Users can manage their own installments"
  ON public.installments
  FOR ALL
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'loan-receipts',
  'loan-receipts',
  false,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can manage their own loan receipts" ON storage.objects;
CREATE POLICY "Users can manage their own loan receipts"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'loan-receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  )
  WITH CHECK (
    bucket_id = 'loan-receipts'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
