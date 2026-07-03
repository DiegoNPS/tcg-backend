BEGIN;

-- Supabase no expone tablas nuevas automáticamente en proyectos actuales.
-- Los GRANT habilitan cada operación a nivel SQL; las políticas RLS siguen
-- restringiendo qué filas puede leer o modificar cada rol.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.profiles TO authenticated;

GRANT SELECT ON public.tiendas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tiendas TO authenticated;

GRANT SELECT ON public.torneos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.torneos TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
ON public.tournament_entries
TO authenticated;

GRANT SELECT ON public.juegos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.juegos TO authenticated;

GRANT SELECT ON public.categorias_torneo TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE
ON public.categorias_torneo
TO authenticated;

GRANT SELECT ON public.ciudades TO anon, authenticated;

GRANT USAGE, SELECT
ON SEQUENCE public.tournament_entries_registration_order_seq
TO authenticated;

-- El cliente de service role se usa solo en el backend y debe poder preparar
-- datos administrativos sin quedar limitado por los permisos del navegador.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

COMMIT;
