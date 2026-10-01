
-- 1) Private schema for helper functions to remove them from PostgREST exposure
CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 2) Recreate helper functions in app_private
CREATE OR REPLACE FUNCTION app_private.is_conversation_member(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation_id AND user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION app_private.is_conversation_owner(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation_id AND user_id = _user_id AND role = 'owner')
$$;

CREATE OR REPLACE FUNCTION app_private.is_conversation_admin(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = _conversation_id AND user_id = _user_id AND role IN ('owner','co_owner'))
$$;

-- Lock down execute
REVOKE ALL ON FUNCTION app_private.is_conversation_member(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_conversation_owner(uuid,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_private.is_conversation_admin(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_conversation_member(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_conversation_owner(uuid,uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.is_conversation_admin(uuid,uuid) TO authenticated, service_role;

-- 3) Drop and recreate every policy that referenced the public helpers
-- calls
DROP POLICY IF EXISTS "Caller can initiate calls" ON public.calls;
DROP POLICY IF EXISTS "Members view conversation calls" ON public.calls;
CREATE POLICY "Caller can initiate calls" ON public.calls FOR INSERT TO authenticated
  WITH CHECK (caller_id = auth.uid() AND app_private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members view conversation calls" ON public.calls FOR SELECT TO authenticated
  USING (app_private.is_conversation_member(conversation_id, auth.uid()));

-- conversation_invites
DROP POLICY IF EXISTS "Admins can create invites" ON public.conversation_invites;
CREATE POLICY "Admins can create invites" ON public.conversation_invites FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND app_private.is_conversation_admin(conversation_id, auth.uid()));

-- conversation_participants
DROP POLICY IF EXISTS "Members can update their own participation" ON public.conversation_participants;
DROP POLICY IF EXISTS "Only owner can remove other members" ON public.conversation_participants;
DROP POLICY IF EXISTS "Only owner can update participant roles" ON public.conversation_participants;
DROP POLICY IF EXISTS "Owners and co-owners can add members" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can join non-private conversations or with accepted invit" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants of their conversations" ON public.conversation_participants;

CREATE POLICY "Members can update their own participation" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Only owner can remove other members" ON public.conversation_participants FOR DELETE TO authenticated
  USING (role <> 'owner' AND app_private.is_conversation_owner(conversation_id, auth.uid()));
CREATE POLICY "Only owner can update participant roles" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (app_private.is_conversation_owner(conversation_id, auth.uid()))
  WITH CHECK (app_private.is_conversation_owner(conversation_id, auth.uid()));
CREATE POLICY "Owners and co-owners can add members" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (app_private.is_conversation_admin(conversation_id, auth.uid()));
CREATE POLICY "Users can join non-private conversations or with accepted invit" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.is_private = false)
      OR EXISTS (SELECT 1 FROM public.conversation_invites ci WHERE ci.conversation_id = conversation_participants.conversation_id AND ci.invitee_id = auth.uid() AND ci.status = 'accepted')
      OR app_private.is_conversation_admin(conversation_id, auth.uid())
    )
  );
CREATE POLICY "Users can view participants of their conversations" ON public.conversation_participants FOR SELECT TO authenticated
  USING (app_private.is_conversation_member(conversation_id, auth.uid()));

-- Trigger to enforce role immutability for non-owners (fixes self-promotion finding)
CREATE OR REPLACE FUNCTION app_private.enforce_role_immutability()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT app_private.is_conversation_owner(OLD.conversation_id, auth.uid()) THEN
      RAISE EXCEPTION 'Only the owner can change participant roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION app_private.enforce_role_immutability() FROM PUBLIC;

DROP TRIGGER IF EXISTS enforce_role_immutability_trg ON public.conversation_participants;
CREATE TRIGGER enforce_role_immutability_trg
  BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_role_immutability();

-- conversations
DROP POLICY IF EXISTS "Admins can update their conversations" ON public.conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Admins can update their conversations" ON public.conversations FOR UPDATE TO authenticated
  USING (app_private.is_conversation_admin(id, auth.uid()));
CREATE POLICY "Users can view their conversations" ON public.conversations FOR SELECT TO authenticated
  USING (app_private.is_conversation_member(id, auth.uid()) OR owner_id = auth.uid());

-- message_reactions
DROP POLICY IF EXISTS "Members can add their own reactions" ON public.message_reactions;
DROP POLICY IF EXISTS "Members can view reactions" ON public.message_reactions;
CREATE POLICY "Members can add their own reactions" ON public.message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND app_private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Members can view reactions" ON public.message_reactions FOR SELECT TO authenticated
  USING (app_private.is_conversation_member(conversation_id, auth.uid()));

-- messages: fix WITH CHECK to prevent moving message to another conversation
DROP POLICY IF EXISTS "Authors can update their messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages to their conversations" ON public.messages;
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.messages;
CREATE POLICY "Authors can update their messages" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid() AND app_private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users can send messages to their conversations" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND app_private.is_conversation_member(conversation_id, auth.uid()));
CREATE POLICY "Users can view messages in their conversations" ON public.messages FOR SELECT TO authenticated
  USING (app_private.is_conversation_member(conversation_id, auth.uid()));

-- 4) Drop the now-unused public helper functions to clear the lint
DROP FUNCTION IF EXISTS public.is_conversation_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_owner(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_conversation_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.get_my_phone();

-- 5) Lock down remaining public security definer functions (trigger-only)
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role, supabase_auth_admin;
