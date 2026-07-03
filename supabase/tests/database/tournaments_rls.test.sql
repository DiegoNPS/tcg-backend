BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(4);

INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
VALUES
  (
    '00000000-0000-0000-0000-000000000000',
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'tienda@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Tienda"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'visitante@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Visitante"}'::jsonb,
    now(),
    now()
  );

UPDATE public.profiles
SET user_role = 'tienda'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.ciudades (id, nombre)
VALUES ('77777777-7777-4777-8777-777777777777', 'Ciudad RLS');

INSERT INTO public.tiendas (id, owner_id, nombre, ciudad_id)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'Arena RLS',
  '77777777-7777-4777-8777-777777777777'
);

INSERT INTO public.torneos (
  id,
  tienda_id,
  titulo,
  descripcion,
  direccion,
  fecha_inicio,
  cupo_maximo,
  costo_entrada,
  publicado,
  juego_id,
  categoria_id
)
VALUES
  (
    '44444444-4444-4444-8444-444444444441',
    '55555555-5555-4555-8555-555555555555',
    'Torneo público',
    'Visible para todos',
    'Av. RLS 123',
    '2099-08-25T23:00:00Z',
    16,
    0,
    true,
    (SELECT id FROM public.juegos WHERE key = 'pokemon'),
    (SELECT id FROM public.categorias_torneo WHERE key = 'local')
  ),
  (
    '44444444-4444-4444-8444-444444444442',
    '55555555-5555-4555-8555-555555555555',
    'Torneo borrador',
    'Visible solo para la tienda',
    'Av. RLS 123',
    '2099-08-26T23:00:00Z',
    16,
    0,
    false,
    (SELECT id FROM public.juegos WHERE key = 'pokemon'),
    (SELECT id FROM public.categorias_torneo WHERE key = 'local')
  );

SET LOCAL ROLE anon;
SELECT extensions.is(
  (SELECT count(*) FROM public.torneos),
  1::bigint,
  'anon solo puede ver torneos publicados'
);
SELECT extensions.is(
  (SELECT count(*) FROM public.tiendas),
  1::bigint,
  'los datos públicos de la tienda son visibles'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
SELECT extensions.is(
  (SELECT count(*) FROM public.torneos),
  1::bigint,
  'otro usuario no puede ver el borrador'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
SELECT extensions.is(
  (SELECT count(*) FROM public.torneos),
  2::bigint,
  'la tienda puede ver su torneo publicado y su borrador'
);

SELECT * FROM extensions.finish();
ROLLBACK;
