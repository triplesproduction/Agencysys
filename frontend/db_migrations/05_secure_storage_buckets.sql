  -- 1. Configure the existing 'documents' bucket (Avatars)
  -- Limits: 2MB, Images only
  UPDATE storage.buckets
  SET 
    public = true,
    file_size_limit = 2097152, -- 2MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
  WHERE id = 'documents';

  -- 2. Configure the existing 'private-docs' bucket
  -- Limits: 10MB, Images/PDFs
  UPDATE storage.buckets
  SET 
    public = false,
    file_size_limit = 10485760, -- 10MB
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
  WHERE id = 'private-docs';

  -- 3. Create the missing 'chat-media' bucket
  -- Limits: 5MB, Images/PDFs
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'chat-media', 
    'chat-media', 
    false, 
    5242880, -- 5MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
  ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  -- 4. Clean up old permissive storage policies
  DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public read" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to upload private docs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read private docs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to update private docs" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to delete private docs" ON storage.objects;

  -- 5. Establish secure ownership-based RLS on storage.objects

  -- 'documents' (Avatars): Public read, but users can only upload/update their own folder
  DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
  CREATE POLICY "Public avatar read" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

  DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
  CREATE POLICY "Users can upload their own avatar" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'documents' AND 
    auth.role() = 'authenticated' AND
    (string_to_array(name, '/'))[2] = auth.uid()::text -- Expected format: profiles/{userId}/file.ext
  );

  DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
  CREATE POLICY "Users can update their own avatar" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'documents' AND 
    (string_to_array(name, '/'))[2] = auth.uid()::text
  );

  DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
  CREATE POLICY "Users can delete their own avatar" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'documents' AND 
    (string_to_array(name, '/'))[2] = auth.uid()::text
  );

  -- 'private-docs': Private read/write only for the owner
  DROP POLICY IF EXISTS "Users can access their own private docs" ON storage.objects;
  CREATE POLICY "Users can access their own private docs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'private-docs' AND 
    (string_to_array(name, '/'))[1] = auth.uid()::text -- Expected format: {userId}/file.ext
  );

  DROP POLICY IF EXISTS "Users can upload their own private docs" ON storage.objects;
  CREATE POLICY "Users can upload their own private docs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'private-docs' AND 
    auth.role() = 'authenticated' AND
    (string_to_array(name, '/'))[1] = auth.uid()::text
  );

  DROP POLICY IF EXISTS "Users can delete their own private docs" ON storage.objects;
  CREATE POLICY "Users can delete their own private docs" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'private-docs' AND 
    (string_to_array(name, '/'))[1] = auth.uid()::text
  );

  -- 'chat-media': Private, but we can't strict-enforce via folder paths easily without large joins,
  -- so we enforce authenticated-only uploads, and reading relies on Signed URL generation by the server.
  DROP POLICY IF EXISTS "Authenticated users can upload chat media" ON storage.objects;
  CREATE POLICY "Authenticated users can upload chat media" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-media' AND 
    auth.role() = 'authenticated' AND
    (string_to_array(name, '/'))[2] = auth.uid()::text -- Expected format: chat/{userId}/file.ext
  );

  DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
  CREATE POLICY "Users can view chat media" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-media' AND 
    auth.role() = 'authenticated'
  );
