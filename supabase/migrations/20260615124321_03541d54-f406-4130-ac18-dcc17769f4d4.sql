
CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id uuid NOT NULL,
  callee_id uuid NOT NULL,
  call_type text NOT NULL DEFAULT 'audio',
  status text NOT NULL DEFAULT 'ringing',
  started_at timestamptz NOT NULL DEFAULT now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer NOT NULL DEFAULT 0
);

GRANT SELECT, INSERT, UPDATE ON public.calls TO authenticated;
GRANT ALL ON public.calls TO service_role;

ALTER TABLE public.calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view conversation calls"
ON public.calls FOR SELECT TO authenticated
USING (public.is_conversation_member(conversation_id, auth.uid()));

CREATE POLICY "Caller can initiate calls"
ON public.calls FOR INSERT TO authenticated
WITH CHECK (
  caller_id = auth.uid()
  AND public.is_conversation_member(conversation_id, auth.uid())
);

CREATE POLICY "Participants can update call status"
ON public.calls FOR UPDATE TO authenticated
USING (caller_id = auth.uid() OR callee_id = auth.uid())
WITH CHECK (caller_id = auth.uid() OR callee_id = auth.uid());

ALTER TABLE public.calls REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.calls;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS calls_conversation_idx ON public.calls(conversation_id, started_at DESC);
