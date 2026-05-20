-- Create public storage bucket for game images
INSERT INTO storage.buckets (id, name, public)
VALUES ('tcg', 'tcg', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to game images
CREATE POLICY "public can view tcg images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'tcg');

-- No insert/update/delete policies are created for this bucket.
-- Only service role or dashboard uploads can manage these objects.
