-- Fix Chat Media RLS isolation (Strict participant scoping)
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
CREATE POLICY "Users can view chat media" ON storage.objects
FOR SELECT USING (
  bucket_id = 'chat-media' AND (
    -- Legacy file fallback
    owner::text = auth.uid()::text 
    OR
    -- Strict Conversation Validation for new files
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id::text = (string_to_array(name, '/'))[2]
      AND user_id::text = auth.uid()::text
    )
  )
);
