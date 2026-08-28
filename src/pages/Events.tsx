import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarDays, Plus, MapPin, Video, Users, ExternalLink, Trash2 } from 'lucide-react';

interface EventItem {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  is_online: boolean;
  starts_at: string;
  ends_at: string | null;
  cover_image_url: string | null;
  external_url: string | null;
  organizer_user_id: string;
  attendeeCount: number;
  isAttending: boolean;
  isOrganizer: boolean;
}

const Events = () => {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [rsvpId, setRsvpId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newStartsAt, setNewStartsAt] = useState('');
  const [newEndsAt, setNewEndsAt] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newExternalUrl, setNewExternalUrl] = useState('');
  const [newIsOnline, setNewIsOnline] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: eventsData, error } = await supabase
        .from('events')
        .select('*')
        .order('starts_at', { ascending: true });

      if (error) throw error;

      const { data: rsvps } = await supabase
        .from('event_attendees')
        .select('event_id')
        .eq('user_id', user.id);

      const myEventIds = new Set((rsvps || []).map((r) => r.event_id));

      const withCounts: EventItem[] = await Promise.all(
        (eventsData || []).map(async (e) => {
          const { count } = await supabase
            .from('event_attendees')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', e.id);
          return {
            ...e,
            attendeeCount: count || 0,
            isAttending: myEventIds.has(e.id),
            isOrganizer: e.organizer_user_id === user.id,
          };
        })
      );

      setEvents(withCounts);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const resetForm = () => {
    setNewTitle('');
    setNewDescription('');
    setNewStartsAt('');
    setNewEndsAt('');
    setNewLocation('');
    setNewExternalUrl('');
    setNewIsOnline(false);
  };

  const handleCreateEvent = async () => {
    if (!user || !newTitle.trim()) {
      toast({ title: 'Title required', description: 'Please enter an event title.', variant: 'destructive' });
      return;
    }
    if (!newStartsAt) {
      toast({ title: 'Start date required', description: 'Please pick when the event starts.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('events')
        .insert({
          title: newTitle.trim(),
          description: newDescription.trim() || null,
          location: newIsOnline ? null : newLocation.trim() || null,
          is_online: newIsOnline,
          starts_at: new Date(newStartsAt).toISOString(),
          ends_at: newEndsAt ? new Date(newEndsAt).toISOString() : null,
          external_url: newExternalUrl.trim() || null,
          organizer_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Organizer auto-attends their own event.
      await supabase.from('event_attendees').insert({
        event_id: data.id,
        user_id: user.id,
      });

      toast({ title: 'Event created', description: `"${data.title}" is live.` });
      setShowCreateDialog(false);
      resetForm();
      fetchEvents();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleRsvp = async (event: EventItem) => {
    if (!user) return;
    setRsvpId(event.id);
    try {
      if (event.isAttending) {
        const { error } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_id', event.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('event_attendees')
          .insert({ event_id: event.id, user_id: user.id });
        if (error) throw error;
      }
      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                isAttending: !e.isAttending,
                attendeeCount: e.isAttending ? Math.max(0, e.attendeeCount - 1) : e.attendeeCount + 1,
              }
            : e
        )
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRsvpId(null);
    }
  };

  const handleDeleteEvent = async (event: EventItem) => {
    if (!user) return;
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setRsvpId(event.id);
    try {
      const { error } = await supabase.from('events').delete().eq('id', event.id);
      if (error) throw error;
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      toast({ title: 'Event deleted' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRsvpId(null);
    }
  };

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at || e.starts_at).getTime() >= now);
  const past = events.filter((e) => new Date(e.ends_at || e.starts_at).getTime() < now);

  const renderCard = (event: EventItem) => (
    <Card key={event.id} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth overflow-hidden">
      {event.cover_image_url && (
        <img src={event.cover_image_url} alt="" className="h-32 w-full object-cover" />
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center justify-center w-12 h-12 rounded-lg bg-primary/10 text-primary shrink-0">
            <span className="text-[10px] font-semibold uppercase leading-none">
              {format(new Date(event.starts_at), 'MMM')}
            </span>
            <span className="text-lg font-bold leading-none">
              {format(new Date(event.starts_at), 'd')}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-lg text-foreground line-clamp-2">{event.title}</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(event.starts_at), 'EEE, MMM d, yyyy • h:mm a')}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {event.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center">
            {event.is_online ? (
              <>
                <Video className="w-4 h-4 mr-1" /> Online
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-1" /> {event.location || 'Location TBD'}
              </>
            )}
          </span>
          <span className="flex items-center">
            <Users className="w-4 h-4 mr-1" />
            {event.attendeeCount} {event.attendeeCount === 1 ? 'attendee' : 'attendees'}
          </span>
        </div>
        {event.isOrganizer && (
          <Badge variant="secondary" className="text-xs">Organizer</Badge>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant={event.isAttending ? 'outline' : 'default'}
            size="sm"
            className="flex-1"
            onClick={() => handleToggleRsvp(event)}
            disabled={rsvpId === event.id}
          >
            {event.isAttending ? 'Attending' : 'Attend'}
          </Button>
          {event.external_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={event.external_url} target="_blank" rel="noopener noreferrer" aria-label="Open event link">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          )}
          {event.isOrganizer && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleDeleteEvent(event)}
              disabled={rsvpId === event.id}
              aria-label="Delete event"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout user={user} onSignOut={handleSignOut}>
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Events</h1>
            <p className="text-muted-foreground">Discover events from your network and host your own</p>
          </div>

          <Dialog
            open={showCreateDialog}
            onOpenChange={(open) => {
              setShowCreateDialog(open);
              if (!open) resetForm();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create an event
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create an event</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. Frontend Meetup: React Patterns"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="event-starts">Starts</Label>
                    <Input
                      id="event-starts"
                      type="datetime-local"
                      value={newStartsAt}
                      onChange={(e) => setNewStartsAt(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-ends">Ends (optional)</Label>
                    <Input
                      id="event-ends"
                      type="datetime-local"
                      value={newEndsAt}
                      onChange={(e) => setNewEndsAt(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="event-online">Online event</Label>
                  <Switch id="event-online" checked={newIsOnline} onCheckedChange={setNewIsOnline} />
                </div>
                {!newIsOnline && (
                  <div className="space-y-2">
                    <Label htmlFor="event-location">Location</Label>
                    <Input
                      id="event-location"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                      placeholder="e.g. Bengaluru, India"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="event-url">Event link (optional)</Label>
                  <Input
                    id="event-url"
                    value={newExternalUrl}
                    onChange={(e) => setNewExternalUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-description">Description</Label>
                  <Textarea
                    id="event-description"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="What is this event about? (optional)"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateEvent} disabled={creating}>
                  {creating ? 'Creating...' : 'Create event'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {events.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No events yet. Be the first to create one!</p>
          </Card>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-4">Upcoming events</h2>
              {upcoming.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing coming up right now.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {upcoming.map(renderCard)}
                </div>
              )}
            </section>

            {past.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold text-foreground mb-4">Past events</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-70">
                  {past.map(renderCard)}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Events;
