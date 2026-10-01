
-- 1. Restrict self-join on conversation_participants
DROP POLICY IF EXISTS "Users can add themselves as participants" ON public.conversation_participants;

CREATE POLICY "Users can join non-private conversations or with accepted invite"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.is_private = false
    )
    OR EXISTS (
      SELECT 1 FROM public.conversation_invites ci
      WHERE ci.conversation_id = conversation_participants.conversation_id
        AND ci.invitee_id = auth.uid()
        AND ci.status = 'accepted'
    )
    OR public.is_conversation_admin(conversation_id, auth.uid())
  )
);

-- 2. Hide phone column from other users (column-level privileges)
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, user_id, display_name, username, bio, avatar_url, created_at, updated_at)
  ON public.profiles TO authenticated;

-- Owner-only RPC to fetch own phone
CREATE OR REPLACE FUNCTION public.get_my_phone()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT phone FROM public.profiles WHERE user_id = auth.uid()
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_phone() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_phone() TO authenticated;

-- 3. Lock down helper functions: only authenticated can execute, never anon/public
REVOKE EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_conversation_admin(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conversation_admin(uuid, uuid) TO authenticated;
