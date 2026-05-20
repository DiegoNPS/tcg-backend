BEGIN;

-- 1) Agregar columna descripcion a juegos y categorias_torneo
ALTER TABLE public.juegos ADD COLUMN IF NOT EXISTS descripcion text;
ALTER TABLE public.categorias_torneo ADD COLUMN IF NOT EXISTS descripcion text;

-- 2) Asegurar claves foráneas (si existen valores compatibles)
ALTER TABLE public.torneos
  DROP CONSTRAINT IF EXISTS fk_torneos_juego;
ALTER TABLE public.torneos
  ADD CONSTRAINT fk_torneos_juego
  FOREIGN KEY (juego_id) REFERENCES public.juegos (id) ON DELETE SET NULL;

ALTER TABLE public.torneos
  DROP CONSTRAINT IF EXISTS fk_torneos_categoria;
ALTER TABLE public.torneos
  ADD CONSTRAINT fk_torneos_categoria
  FOREIGN KEY (categoria_id) REFERENCES public.categorias_torneo (id) ON DELETE SET NULL;

ALTER TABLE public.tiendas
  DROP CONSTRAINT IF EXISTS fk_tiendas_ciudad;
ALTER TABLE public.tiendas
  ADD CONSTRAINT fk_tiendas_ciudad
  FOREIGN KEY (ciudad_id) REFERENCES public.ciudades (id) ON DELETE SET NULL;

-- 3) Indexes opcionales para búsquedas por nombre/descripcion
CREATE INDEX IF NOT EXISTS idx_juegos_nombre ON public.juegos (nombre);
CREATE INDEX IF NOT EXISTS idx_categorias_nombre ON public.categorias_torneo (nombre);
CREATE INDEX IF NOT EXISTS idx_juegos_descripcion ON public.juegos USING gin (to_tsvector('spanish', coalesce(descripcion, '')));
CREATE INDEX IF NOT EXISTS idx_categorias_descripcion ON public.categorias_torneo USING gin (to_tsvector('spanish', coalesce(descripcion, '')));

COMMIT;
