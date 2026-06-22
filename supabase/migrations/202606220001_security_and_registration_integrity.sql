BEGIN;

-- Public tournament responses need the organizer name and city. Only public
-- store metadata exists in this table, so expose rows for read-only access.
DROP POLICY IF EXISTS tiendas_select_public ON public.tiendas;
CREATE POLICY tiendas_select_public
ON public.tiendas
FOR SELECT
TO anon, authenticated
USING (true);

-- Profiles are created by the auth trigger. Clients may edit their display
-- name, but must never be able to insert a privileged role or update user_role.
REVOKE INSERT, UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (display_name) ON public.profiles TO authenticated;

-- Catalogs are public to read. Writes are restricted to administrators.
ALTER TABLE public.categorias_torneo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ciudades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS categorias_select_public ON public.categorias_torneo;
CREATE POLICY categorias_select_public
ON public.categorias_torneo
FOR SELECT
TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS categorias_insert_admin ON public.categorias_torneo;
CREATE POLICY categorias_insert_admin
ON public.categorias_torneo
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS categorias_update_admin ON public.categorias_torneo;
CREATE POLICY categorias_update_admin
ON public.categorias_torneo
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.user_role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS categorias_delete_admin ON public.categorias_torneo;
CREATE POLICY categorias_delete_admin
ON public.categorias_torneo
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.user_role = 'admin'
  )
);

DROP POLICY IF EXISTS ciudades_select_public ON public.ciudades;
CREATE POLICY ciudades_select_public
ON public.ciudades
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.get_or_create_ciudad(p_nombre text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_nombre text := btrim(p_nombre);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  IF char_length(v_nombre) < 1 OR char_length(v_nombre) > 200 THEN
    RAISE EXCEPTION 'invalid city name';
  END IF;

  INSERT INTO public.ciudades (nombre)
  VALUES (v_nombre)
  ON CONFLICT (nombre) DO NOTHING;

  SELECT id INTO v_id FROM public.ciudades WHERE nombre = v_nombre;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_ciudad(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_ciudad(text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_categoria(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_categoria(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.get_or_create_juego(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_or_create_juego(text, text) TO authenticated;

-- Team features are not exposed by the product yet. Default-deny prevents the
-- browser key from reading or mutating future team data before policies exist.
ALTER TABLE public.equipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_miembros ENABLE ROW LEVEL SECURITY;

-- Serialize registrations per tournament, reject closed events and assign the
-- waitlist atomically when capacity is exhausted.
CREATE OR REPLACE FUNCTION public.enforce_tournament_registration_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_publicado boolean;
  v_fecha_inicio timestamptz;
  v_cupo_maximo integer;
  v_active_count integer;
BEGIN
  SELECT publicado, fecha_inicio, cupo_maximo
  INTO v_publicado, v_fecha_inicio, v_cupo_maximo
  FROM public.torneos
  WHERE id = NEW.torneo_id
  FOR UPDATE;

  IF NOT FOUND OR NOT v_publicado THEN
    RAISE EXCEPTION 'tournament-not-open';
  END IF;

  IF v_fecha_inicio <= now() THEN
    RAISE EXCEPTION 'tournament-already-started';
  END IF;

  SELECT count(*)
  INTO v_active_count
  FROM public.tournament_entries
  WHERE torneo_id = NEW.torneo_id
    AND status NOT IN ('dropped', 'eliminated');

  NEW.status := CASE
    WHEN v_active_count >= v_cupo_maximo THEN 'waitlisted'
    ELSE 'registered'
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_tournament_registration_integrity
ON public.tournament_entries;
CREATE TRIGGER enforce_tournament_registration_integrity
BEFORE INSERT ON public.tournament_entries
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tournament_registration_integrity();

CREATE OR REPLACE FUNCTION public.protect_player_entry_updates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = OLD.torneo_id AND t.owner_id = auth.uid()
  ) INTO v_is_owner;

  IF v_is_owner THEN
    RETURN NEW;
  END IF;

  IF OLD.user_id = auth.uid()
    AND OLD.entry_type = 'solo'
    AND OLD.status IN ('registered', 'waitlisted')
    AND NEW.status = 'dropped'
    AND NEW.torneo_id IS NOT DISTINCT FROM OLD.torneo_id
    AND NEW.entry_type IS NOT DISTINCT FROM OLD.entry_type
    AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
    AND NEW.team_id IS NOT DISTINCT FROM OLD.team_id
    AND NEW.checked_in_at IS NOT DISTINCT FROM OLD.checked_in_at
    AND NEW.metadata IS NOT DISTINCT FROM OLD.metadata
  THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'entry-update-not-allowed';
END;
$$;

DROP TRIGGER IF EXISTS protect_player_entry_updates
ON public.tournament_entries;
CREATE TRIGGER protect_player_entry_updates
BEFORE UPDATE ON public.tournament_entries
FOR EACH ROW
EXECUTE FUNCTION public.protect_player_entry_updates();

DROP POLICY IF EXISTS "tournament_entries_insert_player"
ON public.tournament_entries;
CREATE POLICY "tournament_entries_insert_player"
ON public.tournament_entries
FOR INSERT
TO authenticated
WITH CHECK (
  entry_type = 'solo'
  AND user_id = auth.uid()
  AND status IN ('registered', 'waitlisted')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() AND p.user_role = 'jugador'
  )
  AND EXISTS (
    SELECT 1 FROM public.torneos tr
    WHERE tr.id = tournament_entries.torneo_id
      AND tr.publicado = true
      AND tr.fecha_inicio > now()
  )
);

COMMIT;
