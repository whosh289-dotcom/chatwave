
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

GRANT SELECT, INSERT, DELETE ON public.blocked_users TO authenticated;
GRANT ALL ON public.blocked_users TO service_role;

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
ON public.blocked_users FOR SELECT TO authenticated
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

CREATE POLICY "Users can create their own blocks"
ON public.blocked_users FOR INSERT TO authenticated
WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "Users can remove their own blocks"
ON public.blocked_users FOR DELETE TO authenticated
USING (blocker_id = auth.uid());

CREATE INDEX IF NOT EXISTS blocked_users_blocker_idx ON public.blocked_users(blocker_id);
CREATE INDEX IF NOT EXISTS blocked_users_blocked_idx ON public.blocked_users(blocked_id);
