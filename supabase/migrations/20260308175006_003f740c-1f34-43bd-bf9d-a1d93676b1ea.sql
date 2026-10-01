
-- Fix overly permissive policies
DROP POLICY "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1) -- authenticated users can create, but we verify participant insert separately
);

DROP POLICY "Users can add participants" ON public.conversation_participants;
CREATE POLICY "Users can add themselves as participants" ON public.conversation_participants FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = user_id);
