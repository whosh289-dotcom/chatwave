
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
DROP POLICY IF EXISTS "Participants can update their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (public.is_conversation_member(id, auth.uid()) OR owner_id = auth.uid());

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins can update their conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (public.is_conversation_admin(id, auth.uid()));
