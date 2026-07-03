BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SELECT extensions.plan(5);

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
    'jugador-uno@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Jugador Uno"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'jugador-dos@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Jugador Dos"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '44444444-4444-4444-8444-444444444444',
    'authenticated',
    'authenticated',
    'jugador-tres@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Jugador Tres"}'::jsonb,
    now(),
    now()
  );

UPDATE public.profiles
SET user_role = 'tienda'
WHERE user_id = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.ciudades (id, nombre)
VALUES ('77777777-7777-4777-8777-777777777777', 'Ciudad Cupos');

INSERT INTO public.tiendas (id, owner_id, nombre, ciudad_id)
VALUES (
  '55555555-5555-4555-8555-555555555555',
  '11111111-1111-4111-8111-111111111111',
  'Arena Cupos',
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
VALUES (
  '66666666-6666-4666-8666-666666666666',
  '55555555-5555-4555-8555-555555555555',
  'Torneo de dos cupos',
  'Valida la lista de espera atómica',
  'Av. Cupos 123',
  '2099-08-25T23:00:00Z',
  2,
  0,
  true,
  (SELECT id FROM public.juegos WHERE key = 'pokemon'),
  (SELECT id FROM public.categorias_torneo WHERE key = 'local')
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
SELECT extensions.lives_ok(
  $$
    INSERT INTO public.tournament_entries (
      torneo_id, entry_type, user_id, status
    )
    VALUES (
      '66666666-6666-4666-8666-666666666666',
      'solo',
      '22222222-2222-4222-8222-222222222222',
      'registered'
    )
  $$,
  'el primer jugador puede inscribirse'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
SELECT extensions.lives_ok(
  $$
    INSERT INTO public.tournament_entries (
      torneo_id, entry_type, user_id, status
    )
    VALUES (
      '66666666-6666-4666-8666-666666666666',
      'solo',
      '33333333-3333-4333-8333-333333333333',
      'registered'
    )
  $$,
  'el segundo jugador ocupa el último cupo'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '44444444-4444-4444-8444-444444444444',
  true
);
SELECT extensions.lives_ok(
  $$
    INSERT INTO public.tournament_entries (
      torneo_id, entry_type, user_id, status
    )
    VALUES (
      '66666666-6666-4666-8666-666666666666',
      'solo',
      '44444444-4444-4444-8444-444444444444',
      'registered'
    )
  $$,
  'el tercer jugador entra sin superar la capacidad'
);

RESET ROLE;
SELECT extensions.is(
  (
    SELECT status::text
    FROM public.tournament_entries
    WHERE user_id = '44444444-4444-4444-8444-444444444444'
  ),
  'waitlisted',
  'el trigger asigna lista de espera al superar el cupo'
);

SELECT extensions.has_index(
  'public',
  'tournament_entries',
  'uniq_tournament_entries_solo',
  'existe la protección contra inscripciones duplicadas'
);

SELECT * FROM extensions.finish();
ROLLBACK;
