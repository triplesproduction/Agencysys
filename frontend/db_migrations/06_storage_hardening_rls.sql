-- Fix Private Docs RLS Fallback to support legacy files without userId in their path
DROP POLICY IF EXISTS "Users can access their own private docs" ON storage.objects;
CREATE POLICY "Users can access their own private docs" ON storage.objects
FOR SELECT USING (
  bucket_id = 'private-docs' AND (
    (string_to_array(name, '/'))[1] = auth.uid()::text 
    OR 
    owner::text = auth.uid()::text
  )
);

-- Fix Chat Media RLS Fallback
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
CREATE POLICY "Users can view chat media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-media' AND (
    auth.role() = 'authenticated' 
    OR 
    owner::text = auth.uid()::text
  )
);

-- Fix Documents (Avatars) RLS Updates to allow legacy users to update their old avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'documents' AND (
    (string_to_array(name, '/'))[2] = auth.uid()::text
    OR 
    owner::text = auth.uid()::text
  )
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar" ON storage.objects
FOR DELETE USING (
  bucket_id = 'documents' AND (
    (string_to_array(name, '/'))[2] = auth.uid()::text
    OR 
    owner::text = auth.uid()::text
  )
);
