BEGIN;

-- Funciones get_or_create para usar desde SQL editor o server
-- Nota: la creación de `juegos` requiere que el invocador sea `admin` (ver RLS/policies abajo)

CREATE OR REPLACE FUNCTION public.get_or_create_ciudad(p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.ciudades (nombre)
  VALUES (p_nombre)
  ON CONFLICT (nombre) DO NOTHING;

  SELECT id INTO v_id FROM public.ciudades WHERE nombre = p_nombre;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_categoria(p_key text, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.categorias_torneo (key, nombre)
  VALUES (p_key, p_nombre)
  ON CONFLICT (key) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.categorias_torneo WHERE key = p_key;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_juego(p_key text, p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.juegos WHERE key = p_key;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Sólo admins pueden crear nuevos juegos
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'admin'
  ) THEN
    RAISE EXCEPTION 'only admins can create juegos';
  END IF;

  INSERT INTO public.juegos (key, nombre)
  VALUES (p_key, p_nombre)
  ON CONFLICT (key) DO UPDATE SET nombre = EXCLUDED.nombre
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Asegurar RLS y políticas para `juegos` (solo admins insert/update/delete)
ALTER TABLE public.juegos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS juegos_select_public ON public.juegos;
CREATE POLICY juegos_select_public
ON public.juegos
FOR SELECT
USING (true);

DROP POLICY IF EXISTS juegos_insert_admin ON public.juegos;
CREATE POLICY juegos_insert_admin
ON public.juegos
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS juegos_update_admin ON public.juegos;
CREATE POLICY juegos_update_admin
ON public.juegos
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS juegos_delete_admin ON public.juegos;
CREATE POLICY juegos_delete_admin
ON public.juegos
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'admin'
  )
);

COMMIT;
