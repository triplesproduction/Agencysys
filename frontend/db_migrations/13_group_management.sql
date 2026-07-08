-- =====================================================================
-- TripleS OS Migration: Phase 5 — Group Management
-- Filename: 13_group_management.sql
-- Description: Adds logo support to conversations, refines RLS policies 
--              for group updates/deletes, and member management.
-- =====================================================================

-- ---------------------------------------------------------------------
-- STEP 1: ADD LOGO COLUMN
-- ---------------------------------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- ---------------------------------------------------------------------
-- STEP 2: UPDATE CONVERSATIONS RLS (ALLOW ADMIN TO UPDATE/DELETE)
-- ---------------------------------------------------------------------

-- Admins and the original creator can update the conversation (name, logo)
DROP POLICY IF EXISTS "Allow updating of conversations" ON public.conversations;
CREATE POLICY "Allow updating of conversations" 
ON public.conversations FOR UPDATE USING (
  public.is_admin_or_manager() OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = public.conversations.id 
      AND user_id = auth.uid() 
      AND role = 'ADMIN'
  )
);

-- Admins and original creator can delete the conversation
DROP POLICY IF EXISTS "Allow deleting of conversations" ON public.conversations;
CREATE POLICY "Allow deleting of conversations" 
ON public.conversations FOR DELETE USING (
  public.is_admin_or_manager() OR
  created_by = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants 
    WHERE conversation_id = public.conversations.id 
      AND user_id = auth.uid() 
      AND role = 'ADMIN'
  )
);

-- ---------------------------------------------------------------------
-- STEP 3: UPDATE CONVERSATION_PARTICIPANTS RLS (ADD/REMOVE MEMBERS)
-- ---------------------------------------------------------------------

-- Allow participant additions by group admins
DROP POLICY IF EXISTS "Allow participant additions" ON public.conversation_participants;
CREATE POLICY "Allow participant additions"
ON public.conversation_participants FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR
  (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'DIRECT'
    ) AND public.can_message(auth.uid(), user_id)
  ) OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = public.conversation_participants.conversation_id
      AND user_id = auth.uid()
      AND role = 'ADMIN'
  )
);

-- Allow participant removal by themselves or group admins
DROP POLICY IF EXISTS "Allow participant removal" ON public.conversation_participants;
CREATE POLICY "Allow participant removal"
ON public.conversation_participants FOR DELETE USING (
  public.is_admin_or_manager() OR
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = public.conversation_participants.conversation_id
      AND user_id = auth.uid()
      AND role = 'ADMIN'
  )
);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
