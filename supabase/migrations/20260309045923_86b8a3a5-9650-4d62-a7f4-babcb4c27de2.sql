
-- Add privacy columns to conversations
ALTER TABLE public.conversations 
  ADD COLUMN is_private boolean NOT NULL DEFAULT false,
  ADD COLUMN is_encrypted boolean NOT NULL DEFAULT false,
  ADD COLUMN owner_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000';

-- Create conversation_invites table
CREATE TABLE public.conversation_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  inviter_id uuid NOT NULL,
  invitee_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, invitee_id)
);

ALTER TABLE public.conversation_invites ENABLE ROW LEVEL SECURITY;

-- Invitees can view their own invites
CREATE POLICY "Users can view their invites"
  ON public.conversation_invites FOR SELECT
  TO authenticated
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid());

-- Conversation owners/participants can create invites
CREATE POLICY "Users can create invites"
  ON public.conversation_invites FOR INSERT
  TO authenticated
  WITH CHECK (inviter_id = auth.uid());

-- Invitees can update (accept/reject) their own invites
CREATE POLICY "Users can respond to their invites"
  ON public.conversation_invites FOR UPDATE
  TO authenticated
  USING (invitee_id = auth.uid());

-- Add realtime for invites
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_invites;
