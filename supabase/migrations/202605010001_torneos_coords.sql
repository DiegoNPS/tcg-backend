ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS latitud  double precision,
  ADD COLUMN IF NOT EXISTS longitud double precision;
