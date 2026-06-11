BEGIN;

INSERT INTO public.juegos (key, nombre, descripcion)
VALUES
  ('pokemon', 'Pokemon TCG', 'Juego de cartas coleccionables de Pokemon.'),
  ('yugioh', 'Yu-Gi-Oh!', 'Duelos construidos y eventos competitivos.'),
  ('magic', 'Magic: The Gathering', 'Eventos de Magic y formatos construidos o limitados.'),
  ('one_piece', 'One Piece Card Game', 'Torneos del juego de cartas de One Piece.'),
  ('digimon', 'Digimon Card Game', 'Eventos locales y competitivos de Digimon.'),
  ('lorcana', 'Disney Lorcana', 'Torneos y encuentros de Lorcana.'),
  ('otro', 'Otro', 'Otros juegos de cartas coleccionables.')
ON CONFLICT (key) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = COALESCE(public.juegos.descripcion, EXCLUDED.descripcion);

INSERT INTO public.categorias_torneo (key, nombre, descripcion)
VALUES
  ('local', 'Local', 'Evento local organizado por una tienda.'),
  ('regional', 'Regional', 'Evento regional con mayor convocatoria.'),
  ('premier', 'Premier', 'Evento destacado o competitivo.'),
  ('casual', 'Casual', 'Encuentro amistoso o de baja exigencia competitiva.')
ON CONFLICT (key) DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  descripcion = COALESCE(public.categorias_torneo.descripcion, EXCLUDED.descripcion);

COMMIT;
