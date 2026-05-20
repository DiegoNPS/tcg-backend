create extension if not exists pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tcg_juego') THEN
    CREATE TYPE public.tcg_juego AS ENUM (
      'pokemon',
      'yugioh',
      'magic',
      'one_piece',
      'digimon',
      'lorcana',
      'otro'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoria_torneo') THEN
    CREATE TYPE public.categoria_torneo AS ENUM ('local', 'regional', 'premier', 'casual');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_inscripcion') THEN
    CREATE TYPE public.estado_inscripcion AS ENUM ('confirmada', 'cancelada');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tiendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid UNIQUE NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre text NOT NULL,
  ciudad text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.torneos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tienda_id uuid NOT NULL REFERENCES public.tiendas (id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descripcion text NOT NULL,
  tcg_juego public.tcg_juego NOT NULL,
  categoria public.categoria_torneo NOT NULL,
  ciudad text NOT NULL,
  direccion text NOT NULL,
  fecha_inicio timestamptz NOT NULL,
  cupo_maximo integer NOT NULL CHECK (cupo_maximo > 1),
  costo_entrada numeric(10, 2) NOT NULL DEFAULT 0 CHECK (costo_entrada >= 0),
  publicado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL REFERENCES public.torneos (id) ON DELETE CASCADE,
  jugador_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  nombre_jugador text NOT NULL,
  estado public.estado_inscripcion NOT NULL DEFAULT 'confirmada',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (torneo_id, jugador_id)
);

CREATE INDEX IF NOT EXISTS idx_torneos_publicado_fecha ON public.torneos (publicado, fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_torneos_tienda_id ON public.torneos (tienda_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_jugador_id ON public.inscripciones (jugador_id);
CREATE INDEX IF NOT EXISTS idx_inscripciones_torneo_id ON public.inscripciones (torneo_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_tiendas_updated_at ON public.tiendas;
CREATE TRIGGER set_tiendas_updated_at
BEFORE UPDATE ON public.tiendas
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_torneos_updated_at ON public.torneos;
CREATE TRIGGER set_torneos_updated_at
BEFORE UPDATE ON public.torneos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tiendas_select_owner" ON public.tiendas;
CREATE POLICY "tiendas_select_owner"
ON public.tiendas
FOR SELECT
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tiendas_insert_owner" ON public.tiendas;
CREATE POLICY "tiendas_insert_owner"
ON public.tiendas
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tiendas_update_owner" ON public.tiendas;
CREATE POLICY "tiendas_update_owner"
ON public.tiendas
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "tiendas_delete_owner" ON public.tiendas;
CREATE POLICY "tiendas_delete_owner"
ON public.tiendas
FOR DELETE
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "torneos_select_public_or_owner" ON public.torneos;
CREATE POLICY "torneos_select_public_or_owner"
ON public.torneos
FOR SELECT
USING (
  publicado = true
  OR EXISTS (
    SELECT 1
    FROM public.tiendas t
    WHERE t.id = torneos.tienda_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "torneos_insert_owner" ON public.torneos;
CREATE POLICY "torneos_insert_owner"
ON public.torneos
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tiendas t
    WHERE t.id = torneos.tienda_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "torneos_update_owner" ON public.torneos;
CREATE POLICY "torneos_update_owner"
ON public.torneos
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.tiendas t
    WHERE t.id = torneos.tienda_id
      AND t.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tiendas t
    WHERE t.id = torneos.tienda_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "torneos_delete_owner" ON public.torneos;
CREATE POLICY "torneos_delete_owner"
ON public.torneos
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.tiendas t
    WHERE t.id = torneos.tienda_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "inscripciones_select_owner_or_player" ON public.inscripciones;
CREATE POLICY "inscripciones_select_owner_or_player"
ON public.inscripciones
FOR SELECT
USING (
  jugador_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = inscripciones.torneo_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "inscripciones_insert_player" ON public.inscripciones;
CREATE POLICY "inscripciones_insert_player"
ON public.inscripciones
FOR INSERT
WITH CHECK (
  jugador_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.torneos tr
    WHERE tr.id = inscripciones.torneo_id
      AND tr.publicado = true
  )
);

DROP POLICY IF EXISTS "inscripciones_update_player" ON public.inscripciones;
CREATE POLICY "inscripciones_update_player"
ON public.inscripciones
FOR UPDATE
USING (jugador_id = auth.uid())
WITH CHECK (jugador_id = auth.uid());

DROP POLICY IF EXISTS "inscripciones_delete_player" ON public.inscripciones;
CREATE POLICY "inscripciones_delete_player"
ON public.inscripciones
FOR DELETE
USING (jugador_id = auth.uid());
