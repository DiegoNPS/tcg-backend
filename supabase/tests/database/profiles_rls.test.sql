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
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'jugador-dos@example.test',
    crypt('Prueba-local-123', gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"display_name":"Jugador Dos"}'::jsonb,
    now(),
    now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

SELECT extensions.is(
  (SELECT count(*) FROM public.profiles),
  1::bigint,
  'el usuario autenticado solo puede leer su perfil'
);

SELECT extensions.is(
  (
    SELECT count(*)
    FROM public.profiles
    WHERE user_id = '22222222-2222-4222-8222-222222222222'
  ),
  0::bigint,
  'un perfil ajeno queda oculto por RLS'
);

SELECT extensions.ok(
  has_column_privilege(
    'authenticated',
    'public.profiles',
    'display_name',
    'UPDATE'
  ),
  'authenticated puede actualizar display_name'
);

SELECT extensions.ok(
  NOT has_column_privilege(
    'authenticated',
    'public.profiles',
    'user_role',
    'UPDATE'
  ),
  'authenticated no puede modificar user_role'
);

SELECT * FROM extensions.finish();
ROLLBACK;
