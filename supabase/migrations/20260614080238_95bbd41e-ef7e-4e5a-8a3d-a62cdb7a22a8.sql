
CREATE OR REPLACE FUNCTION public.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id AND user_id = _user_id
  )
$$;

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;
DROP POLICY IF EXISTS "Owners can update participant roles" ON public.conversation_participants;
DROP POLICY IF EXISTS "Owners can remove non-owner members" ON public.conversation_participants;

CREATE POLICY "Users can view participants of their conversations"
ON public.conversation_participants
FOR SELECT
TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Owners can update participant roles"
ON public.conversation_participants
FOR UPDATE
TO authenticated
USING (public.is_conversation_admin(conversation_id, auth.uid()));

CREATE POLICY "Owners can remove non-owner members"
ON public.conversation_participants
FOR DELETE
TO authenticated
USING (role <> 'owner' AND public.is_conversation_admin(conversation_id, auth.uid()));
