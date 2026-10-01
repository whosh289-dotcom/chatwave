
CREATE OR REPLACE FUNCTION public.is_conversation_admin(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
      AND role IN ('owner', 'co_owner')
  )
$$;

CREATE POLICY "Owners and co-owners can add members"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (public.is_conversation_admin(conversation_id, auth.uid()));
