BEGIN;

-- 1) Crear tablas normalizadas: juegos, categorias_torneo, ciudades
CREATE TABLE IF NOT EXISTS public.juegos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categorias_torneo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  nombre text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ciudades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Poblar tablas a partir de datos existentes
INSERT INTO public.juegos (key, nombre)
SELECT DISTINCT tcg_juego::text, tcg_juego::text
FROM public.torneos
WHERE tcg_juego IS NOT NULL
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.categorias_torneo (key, nombre)
SELECT DISTINCT categoria::text, categoria::text
FROM public.torneos
WHERE categoria IS NOT NULL
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ciudades (nombre)
SELECT DISTINCT ciudad
FROM (
  SELECT ciudad FROM public.tiendas WHERE ciudad IS NOT NULL
  UNION
  SELECT ciudad FROM public.torneos WHERE ciudad IS NOT NULL
) s
ON CONFLICT (nombre) DO NOTHING;

-- 3) Agregar columnas FK a torneos y tiendas
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS juego_id uuid;
ALTER TABLE public.torneos ADD COLUMN IF NOT EXISTS categoria_id uuid;
ALTER TABLE public.tiendas ADD COLUMN IF NOT EXISTS ciudad_id uuid;

-- 4) Migrar los valores existentes hacia las nuevas FK
UPDATE public.torneos
SET juego_id = j.id
FROM public.juegos j
WHERE j.key = public.torneos.tcg_juego::text
  AND public.torneos.tcg_juego IS NOT NULL;

UPDATE public.torneos
SET categoria_id = c.id
FROM public.categorias_torneo c
WHERE c.key = public.torneos.categoria::text
  AND public.torneos.categoria IS NOT NULL;

UPDATE public.tiendas
SET ciudad_id = ci.id
FROM public.ciudades ci
WHERE ci.nombre = public.tiendas.ciudad
  AND public.tiendas.ciudad IS NOT NULL;

-- 5) Opcional: eliminar columnas antiguas que ahora están normalizadas
ALTER TABLE public.torneos DROP COLUMN IF EXISTS tcg_juego;
ALTER TABLE public.torneos DROP COLUMN IF EXISTS categoria;
ALTER TABLE public.torneos DROP COLUMN IF EXISTS ciudad;
ALTER TABLE public.tiendas DROP COLUMN IF EXISTS ciudad;

-- 6) Crear tablas para equipos y miembros (normalización de equipos)
CREATE TABLE IF NOT EXISTS public.equipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  owner_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.equipo_miembros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipo_id uuid NOT NULL REFERENCES public.equipos (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipo_id, user_id)
);

-- 7) Asegurar la FK entre tournament_entries.team_id y equipos.id
ALTER TABLE public.tournament_entries
  DROP CONSTRAINT IF EXISTS fk_tournament_entries_team;
ALTER TABLE public.tournament_entries
  ADD CONSTRAINT fk_tournament_entries_team
  FOREIGN KEY (team_id) REFERENCES public.equipos (id) ON DELETE CASCADE;

-- 8) Indexes útiles
CREATE INDEX IF NOT EXISTS idx_juegos_key ON public.juegos (key);
CREATE INDEX IF NOT EXISTS idx_categorias_key ON public.categorias_torneo (key);
CREATE INDEX IF NOT EXISTS idx_ciudades_nombre ON public.ciudades (nombre);
CREATE INDEX IF NOT EXISTS idx_equipos_owner ON public.equipos (owner_id);
CREATE INDEX IF NOT EXISTS idx_equipo_miembros_user ON public.equipo_miembros (user_id);

-- 9) Triggers y RLS (no se tocan las políticas existentes que dependen de tienda/torneo)
DROP TRIGGER IF EXISTS set_equipos_updated_at ON public.equipos;
CREATE TRIGGER set_equipos_updated_at
BEFORE UPDATE ON public.equipos
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

COMMIT;
