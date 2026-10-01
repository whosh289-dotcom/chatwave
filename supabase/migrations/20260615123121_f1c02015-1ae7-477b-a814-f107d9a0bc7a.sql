
-- Owner-only helper
CREATE OR REPLACE FUNCTION public.is_conversation_owner(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
      AND role = 'owner'
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_conversation_owner(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_owner(uuid, uuid) TO authenticated;

-- 1) Restrict invite creation to admins of the conversation
DROP POLICY IF EXISTS "Users can create invites" ON public.conversation_invites;
CREATE POLICY "Admins can create invites"
ON public.conversation_invites
FOR INSERT TO authenticated
WITH CHECK (
  inviter_id = auth.uid()
  AND public.is_conversation_admin(conversation_id, auth.uid())
);

-- 2) Only the owner can remove other members (and never themselves via this path)
DROP POLICY IF EXISTS "Owners can remove non-owner members" ON public.conversation_participants;
CREATE POLICY "Only owner can remove other members"
ON public.conversation_participants
FOR DELETE TO authenticated
USING (
  role <> 'owner'
  AND public.is_conversation_owner(conversation_id, auth.uid())
);

-- 3) Only the owner can change participant roles
DROP POLICY IF EXISTS "Owners can update participant roles" ON public.conversation_participants;
CREATE POLICY "Only owner can update participant roles"
ON public.conversation_participants
FOR UPDATE TO authenticated
USING (public.is_conversation_owner(conversation_id, auth.uid()))
WITH CHECK (public.is_conversation_owner(conversation_id, auth.uid()));
