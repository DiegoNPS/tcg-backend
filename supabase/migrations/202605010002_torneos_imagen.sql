-- Add image URL column to torneos
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS imagen_url text;

-- Create public storage bucket for tournament images
INSERT INTO storage.buckets (id, name, public)
VALUES ('torneos', 'torneos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload only inside their own folder ({user_id}/filename)
CREATE POLICY "users can upload their own tournament images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'torneos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update only their own files
CREATE POLICY "users can update their own tournament images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'torneos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete only their own files
CREATE POLICY "users can delete their own tournament images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'torneos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow public read access (tournament images are public)
CREATE POLICY "public can view tournament images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'torneos');
