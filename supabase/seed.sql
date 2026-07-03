-- Reference data used by local development and real integration tests.
-- Users are created through the local Auth API by the Vitest setup so that
-- auth.users, identities and profile triggers behave exactly like production.

INSERT INTO public.ciudades (nombre)
VALUES
  ('Santiago'),
  ('Providencia')
ON CONFLICT (nombre) DO NOTHING;
