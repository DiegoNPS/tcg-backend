BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_entry_type') THEN
    CREATE TYPE public.tournament_entry_type AS ENUM ('solo', 'team');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tournament_entry_status') THEN
    CREATE TYPE public.tournament_entry_status AS ENUM (
      'registered',
      'waitlisted',
      'checked_in',
      'seeded',
      'dropped',
      'eliminated'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.tournament_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL REFERENCES public.torneos (id) ON DELETE CASCADE,
  entry_type public.tournament_entry_type NOT NULL DEFAULT 'solo',
  user_id uuid,
  team_id uuid,
  status public.tournament_entry_status NOT NULL DEFAULT 'registered',
  registration_order bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  checked_in_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP POLICY IF EXISTS "tournament_entries_select_owner_or_player" ON public.tournament_entries;
DROP POLICY IF EXISTS "tournament_entries_insert_player" ON public.tournament_entries;
DROP POLICY IF EXISTS "tournament_entries_update_owner_or_player" ON public.tournament_entries;
DROP POLICY IF EXISTS "tournament_entries_delete_owner_or_player" ON public.tournament_entries;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'tournament_entries'
      AND con.contype = 'c'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.tournament_entries DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournament_entries'
      AND column_name = 'entry_type'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.tournament_entries
      ALTER COLUMN entry_type DROP DEFAULT;
    ALTER TABLE public.tournament_entries
      ALTER COLUMN entry_type TYPE public.tournament_entry_type
      USING entry_type::public.tournament_entry_type;
    ALTER TABLE public.tournament_entries
      ALTER COLUMN entry_type SET DEFAULT 'solo';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tournament_entries'
      AND column_name = 'status'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE public.tournament_entries
      ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE public.tournament_entries
      ALTER COLUMN status TYPE public.tournament_entry_status
      USING status::public.tournament_entry_status;
    ALTER TABLE public.tournament_entries
      ALTER COLUMN status SET DEFAULT 'registered';
  END IF;
END $$;

DROP TRIGGER IF EXISTS set_tournament_entries_updated_at ON public.tournament_entries;
CREATE TRIGGER set_tournament_entries_updated_at
BEFORE UPDATE ON public.tournament_entries
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.tournament_entries
  DROP CONSTRAINT IF EXISTS tournament_entries_xor_check;
ALTER TABLE public.tournament_entries
  ADD CONSTRAINT tournament_entries_xor_check
  CHECK (
    (entry_type = 'solo' AND user_id IS NOT NULL AND team_id IS NULL)
    OR (entry_type = 'team' AND team_id IS NOT NULL AND user_id IS NULL)
  );

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tournament_entries_solo
  ON public.tournament_entries (torneo_id, user_id)
  WHERE entry_type = 'solo';

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tournament_entries_team
  ON public.tournament_entries (torneo_id, team_id)
  WHERE entry_type = 'team';

CREATE INDEX IF NOT EXISTS idx_tournament_entries_torneo_id
  ON public.tournament_entries (torneo_id);

CREATE INDEX IF NOT EXISTS idx_tournament_entries_user_id
  ON public.tournament_entries (user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inscripciones'
  ) THEN
    INSERT INTO public.tournament_entries (
      torneo_id,
      entry_type,
      user_id,
      status,
      created_at,
      updated_at
    )
    SELECT
      i.torneo_id,
      'solo'::public.tournament_entry_type,
      i.jugador_id,
      CASE i.estado
        WHEN 'confirmada' THEN 'registered'
        WHEN 'cancelada' THEN 'dropped'
        ELSE 'registered'
      END::public.tournament_entry_status,
      i.created_at,
      i.created_at
    FROM public.inscripciones i
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.tournament_entries te
      WHERE te.torneo_id = i.torneo_id
        AND te.user_id = i.jugador_id
        AND te.entry_type = 'solo'
    );
  END IF;
END $$;

ALTER TABLE public.tournament_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament_entries_select_owner_or_player" ON public.tournament_entries;
CREATE POLICY "tournament_entries_select_owner_or_player"
ON public.tournament_entries
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = tournament_entries.torneo_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tournament_entries_insert_player" ON public.tournament_entries;
CREATE POLICY "tournament_entries_insert_player"
ON public.tournament_entries
FOR INSERT
TO authenticated
WITH CHECK (
  entry_type = 'solo'
  AND user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id = auth.uid()
      AND p.user_role = 'jugador'::public.user_role
  )
  AND EXISTS (
    SELECT 1
    FROM public.torneos tr
    WHERE tr.id = tournament_entries.torneo_id
      AND tr.publicado = true
  )
);

DROP POLICY IF EXISTS "tournament_entries_update_owner_or_player" ON public.tournament_entries;
CREATE POLICY "tournament_entries_update_owner_or_player"
ON public.tournament_entries
FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = tournament_entries.torneo_id
      AND t.owner_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = tournament_entries.torneo_id
      AND t.owner_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "tournament_entries_delete_owner_or_player" ON public.tournament_entries;
CREATE POLICY "tournament_entries_delete_owner_or_player"
ON public.tournament_entries
FOR DELETE
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.torneos tr
    JOIN public.tiendas t ON t.id = tr.tienda_id
    WHERE tr.id = tournament_entries.torneo_id
      AND t.owner_id = auth.uid()
  )
);

DROP TABLE IF EXISTS public.inscripciones;

COMMIT;
