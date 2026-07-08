-- =====================================================================
-- TripleS OS Migration: Phase 4 — Fix RLS Recursion
-- Filename: 13_fix_rls_recursion.sql
-- Description: Creates a SECURITY DEFINER helper function to check
--              conversation membership, resolving the infinite 
--              recursion loop in RLS policies.
-- =====================================================================

-- Create a security definer helper to check membership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, check_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.conversation_participants 
        WHERE conversation_id = conv_id AND user_id = check_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop old recursive policies
DROP POLICY IF EXISTS "Allow users to view conversations they participate in" ON public.conversations;
DROP POLICY IF EXISTS "Allow users to view conversation participants" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow participant additions" ON public.conversation_participants;
DROP POLICY IF EXISTS "Allow users to view messages in accessible conversations" ON public.messages;
DROP POLICY IF EXISTS "Allow members to send messages to active conversations" ON public.messages;

-- 1. Conversations SELECT Policy
CREATE POLICY "Allow users to view conversations they participate in" 
ON public.conversations FOR SELECT USING (
  public.is_admin_or_manager() OR
  type = 'COMPANY' OR
  (type = 'DEPARTMENT' AND (department = (SELECT department FROM public.employees WHERE id = auth.uid()) OR department = 'Operations')) OR
  public.is_conversation_member(id, auth.uid())
);

-- 2. Conversation Participants SELECT Policy
CREATE POLICY "Allow users to view conversation participants"
ON public.conversation_participants FOR SELECT USING (
  public.is_admin_or_manager() OR
  user_id = auth.uid() OR
  public.is_conversation_member(conversation_id, auth.uid())
);

-- 3. Conversation Participants INSERT Policy
CREATE POLICY "Allow participant additions"
ON public.conversation_participants FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR
  (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.type = 'DIRECT'
    ) AND public.can_message(auth.uid(), user_id)
  )
);

-- 4. Messages SELECT Policy
CREATE POLICY "Allow users to view messages in accessible conversations"
ON public.messages FOR SELECT USING (
  public.is_admin_or_manager() OR
  public.is_conversation_member(conversation_id, auth.uid()) OR
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = messages.conversation_id
  )
);

-- 5. Messages INSERT Policy
CREATE POLICY "Allow members to send messages to active conversations"
ON public.messages FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id 
      AND c.status = 'ACTIVE'
      AND (
        public.is_admin_or_manager() OR 
        (c.type != 'COMPANY' AND public.is_conversation_member(c.id, auth.uid()))
      )
  )
);

-- Reload Schema Cache
NOTIFY pgrst, 'reload schema';
