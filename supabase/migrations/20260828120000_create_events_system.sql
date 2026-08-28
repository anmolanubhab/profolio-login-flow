-- Events feature: a LinkedIn-style events directory. Mirrors the groups /
-- group_members pair -- events are publicly readable, any authenticated user
-- can create one (must own it), and users RSVP by inserting their own row
-- into event_attendees. All ownership checks key off auth.uid() directly,
-- exactly like public.groups (not profiles.id).

CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  is_online BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE,
  cover_image_url TEXT,
  external_url TEXT,
  organizer_user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.event_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_events_starts_at ON public.events (starts_at);
CREATE INDEX idx_event_attendees_event_id ON public.event_attendees (event_id);
CREATE INDEX idx_event_attendees_user_id ON public.event_attendees (user_id);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- events: world-readable, creator must own the row, only organizer mutates.
CREATE POLICY "events_select_all" ON public.events
  FOR SELECT USING (true);

CREATE POLICY "events_insert_own" ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = organizer_user_id);

CREATE POLICY "events_update_organizer" ON public.events
  FOR UPDATE TO authenticated
  USING (auth.uid() = organizer_user_id)
  WITH CHECK (auth.uid() = organizer_user_id);

CREATE POLICY "events_delete_organizer" ON public.events
  FOR DELETE TO authenticated
  USING (auth.uid() = organizer_user_id);

-- event_attendees: attendee list is public; you may only add/remove yourself
-- (the event organizer may also remove an attendee).
CREATE POLICY "ea_select_all" ON public.event_attendees
  FOR SELECT USING (true);

CREATE POLICY "ea_insert_self" ON public.event_attendees
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ea_delete_self_or_organizer" ON public.event_attendees
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (SELECT e.organizer_user_id FROM public.events e WHERE e.id = event_attendees.event_id)
  );
