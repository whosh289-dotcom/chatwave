
-- Add group name and theme to conversations
ALTER TABLE public.conversations
  ADD COLUMN name text,
  ADD COLUMN theme text NOT NULL DEFAULT 'default';

-- Add role to conversation_participants
ALTER TABLE public.conversation_participants
  ADD COLUMN role text NOT NULL DEFAULT 'member';

-- Allow participants to update conversation (for name/theme changes by owner/co_owner)
CREATE POLICY "Participants can update their conversations"
  ON public.conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_participants.conversation_id = conversations.id
        AND conversation_participants.user_id = auth.uid()
        AND conversation_participants.role IN ('owner', 'co_owner')
    )
  );

-- Allow owner/co_owner to update participant roles (but not kick owner)
CREATE POLICY "Owners can update participant roles"
  ON public.conversation_participants FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'co_owner')
    )
  );

-- Allow owner/co_owner to remove members (but not owner)
CREATE POLICY "Owners can remove non-owner members"
  ON public.conversation_participants FOR DELETE
  TO authenticated
  USING (
    conversation_participants.role != 'owner'
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
        AND cp.role IN ('owner', 'co_owner')
    )
  );

-- Allow owner to delete conversations
CREATE POLICY "Owner can delete conversation"
  ON public.conversations FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());
