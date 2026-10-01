
-- Messages: reply, gif, type, deleted_for_everyone
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS deleted_for_everyone boolean NOT NULL DEFAULT false;

-- Participants: read receipts, mute, pin
ALTER TABLE public.conversation_participants
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS muted_until timestamptz,
  ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

-- Allow message author to update their own messages (delete-for-everyone / edit)
DROP POLICY IF EXISTS "Authors can update their messages" ON public.messages;
CREATE POLICY "Authors can update their messages"
ON public.messages FOR UPDATE TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Allow participants to update their own row (mark read, mute, pin)
DROP POLICY IF EXISTS "Members can update their own participation" ON public.conversation_participants;
CREATE POLICY "Members can update their own participation"
ON public.conversation_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Reactions
CREATE TABLE IF NOT EXISTS public.message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT ALL ON public.message_reactions TO service_role;

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view reactions"
ON public.message_reactions FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Members can add their own reactions"
ON public.message_reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
);

CREATE POLICY "Users can remove their own reactions"
ON public.message_reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Realtime
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.message_reactions REPLICA IDENTITY FULL;
ALTER TABLE public.conversation_participants REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
