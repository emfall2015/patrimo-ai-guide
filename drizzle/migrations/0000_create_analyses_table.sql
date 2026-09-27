CREATE TABLE public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revenus_annuels numeric NOT NULL,
  epargne numeric NOT NULL DEFAULT 0,
  credit_immobilier numeric NOT NULL DEFAULT 0,
  mensualite numeric NOT NULL DEFAULT 0,
  objectif text NOT NULL,
  analyse_ia text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.analyses TO anon;
GRANT ALL ON public.analyses TO service_role;

ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tout visiteur peut enregistrer une analyse"
ON public.analyses
FOR INSERT
TO anon
WITH CHECK (true);