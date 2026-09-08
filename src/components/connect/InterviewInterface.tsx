import { useState, useEffect, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, Video, Plus, FileText, X, MessageSquareText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'cancelled';

/** Design-system status styling: subtle left border + tinted pill (no raw
 *  tailwind palette colours). */
const statusStyles = (status: string) => {
  switch (status) {
    case 'scheduled':
      return { border: 'border-l-primary', badge: 'border-primary/30 bg-primary/10 text-primary' };
    case 'in_progress':
      return { border: 'border-l-success', badge: 'border-success/30 bg-success/10 text-success' };
    case 'completed':
      return { border: 'border-l-muted-foreground/40', badge: 'border-border bg-muted text-muted-foreground' };
    case 'cancelled':
      return { border: 'border-l-destructive', badge: 'border-destructive/30 bg-destructive/10 text-destructive' };
    default:
      return { border: 'border-l-border', badge: 'border-border bg-muted text-muted-foreground' };
  }
};

interface InterviewInterfaceProps {
  user: User;
}

interface Interview {
  id: string;
  interviewer_id: string;
  interviewee_id: string;
  title: string;
  description?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  meeting_link?: string;
  notes?: string;
  created_at: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

const InterviewInterface = ({ user }: InterviewInterfaceProps) => {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInterview, setShowNewInterview] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { toast } = useToast();

  const [newInterview, setNewInterview] = useState({
    title: '',
    description: '',
    interviewee_id: '',
    scheduled_at: '',
    duration_minutes: 60,
  });

  useEffect(() => {
    fetchInterviews();
  }, [user.id]);

  useEffect(() => {
    // Set up real-time subscription for interviews
    const channel = supabase
      .channel('interviews-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'interviews'
        },
        () => {
          fetchInterviews();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchInterviews = async () => {
    try {
      const { data, error } = await supabase
        .from('interviews')
        .select('*')
        .or(`interviewer_id.eq.${user.id},interviewee_id.eq.${user.id}`)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      // Get profiles for participants
      const interviewsWithProfiles = await Promise.all(
        (data || []).map(async (interview) => {
          const otherParticipantId = interview.interviewer_id === user.id 
            ? interview.interviewee_id 
            : interview.interviewer_id;

          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherParticipantId!)
            .maybeSingle();

          return {
            ...interview,
            profiles: profile || { display_name: 'Unknown User', avatar_url: null }
          };
        })
      );

      setInterviews(interviewsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch interviews",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createInterview = async () => {
    if (!newInterview.title || !newInterview.scheduled_at || !newInterview.interviewee_id) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('interviews')
        .insert({
          ...newInterview,
          interviewer_id: user.id,
          meeting_link: `https://meet.jit.si/profolio-${Date.now()}` // Simple meeting link
        });

      if (error) throw error;

      setNewInterview({
        title: '',
        description: '',
        interviewee_id: '',
        scheduled_at: '',
        duration_minutes: 60,
      });
      setShowNewInterview(false);
      fetchInterviews();

      toast({
        title: "Success",
        description: "Interview scheduled successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to schedule interview",
        variant: "destructive",
      });
    }
  };

  const updateInterviewStatus = async (interviewId: string, status: string) => {
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ status })
        .eq('id', interviewId);

      if (error) throw error;

      fetchInterviews();
      toast({
        title: "Success",
        description: `Interview ${status}`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update interview status",
        variant: "destructive",
      });
    }
  };

  const updateInterviewNotes = async (interviewId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('interviews')
        .update({ notes })
        .eq('id', interviewId);

      if (error) throw error;

      fetchInterviews();
      toast({
        title: "Success",
        description: "Notes updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to update notes",
        variant: "destructive",
      });
    }
  };

  // Kept for the Details dialog badge; now routed through the design-system
  // status styling instead of raw palette classes.
  const getStatusColor = (status: string) => statusStyles(status).badge;

  const isInterviewer = (interview: Interview) => interview.interviewer_id === user.id;

  const counts = useMemo(
    () => ({
      all: interviews.length,
      scheduled: interviews.filter((i) => i.status === 'scheduled').length,
      completed: interviews.filter((i) => i.status === 'completed').length,
      cancelled: interviews.filter((i) => i.status === 'cancelled').length,
    }),
    [interviews],
  );

  const visibleInterviews = useMemo(
    () => (statusFilter === 'all' ? interviews : interviews.filter((i) => i.status === statusFilter)),
    [interviews, statusFilter],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      {/* Section header: title + subtitle stack; the action button drops to
          its own full-width row on mobile so it can never force an overflow. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight">Interviews</h2>
          <p className="text-sm text-muted-foreground">Manage your scheduled interviews</p>
        </div>
        <Dialog open={showNewInterview} onOpenChange={setShowNewInterview}>
          <DialogTrigger asChild>
            <Button className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Schedule New Interview</DialogTitle>
              <DialogDescription>
                Set up a video interview with a candidate or interviewer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Interview Title</Label>
                <Input
                  id="title"
                  value={newInterview.title}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Frontend Developer Interview"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interviewee">Interviewee ID</Label>
                <Input
                  id="interviewee"
                  value={newInterview.interviewee_id}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, interviewee_id: e.target.value }))}
                  placeholder="Enter user ID"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="datetime">Date & Time</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={newInterview.scheduled_at}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, scheduled_at: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select 
                  value={newInterview.duration_minutes.toString()} 
                  onValueChange={(value) => setNewInterview(prev => ({ ...prev, duration_minutes: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newInterview.description}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Interview details, requirements, etc."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={createInterview}>
                Schedule Interview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status filters -- client-side only; horizontally scrollable so the
          chips never wrap or overflow the page on a narrow screen. */}
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 scrollbar-hide">
        {([
          ['all', 'All'],
          ['scheduled', 'Scheduled'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setStatusFilter(key)}
            aria-pressed={statusFilter === key}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              statusFilter === key
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
            )}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      {/* Interview cards -- full-width, min-w-0 everywhere so long titles /
          names / notes wrap instead of stretching the card. Subtle left
          status border replaces heavy nested boxes. */}
      <div className="grid gap-3">
        {visibleInterviews.map((interview) => {
          const s = statusStyles(interview.status);
          const note = interview.notes || interview.description;
          return (
            <Card
              key={interview.id}
              className={cn('min-w-0 overflow-hidden border-l-4 shadow-none', s.border)}
            >
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 flex-1 break-words font-semibold leading-snug">
                    {interview.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn('shrink-0 whitespace-nowrap capitalize', s.badge)}
                  >
                    {interview.status.replace('_', ' ')}
                  </Badge>
                </div>

                <div className="grid gap-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {format(new Date(interview.scheduled_at), 'PP')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(interview.scheduled_at), 'EEEE')}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="font-medium">
                        {format(new Date(interview.scheduled_at), 'p')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ({interview.duration_minutes} minutes)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">
                    {isInterviewer(interview) ? 'Interviewee' : 'Interviewer'}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarImage src={interview.profiles?.avatar_url} />
                      <AvatarFallback>
                        {interview.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 break-words text-sm font-medium">
                      {interview.profiles?.display_name || 'Unknown User'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
                  <MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn('min-w-0 break-words', !note && 'text-muted-foreground')}>
                    {note || 'No additional notes'}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  {interview.status === 'scheduled' && interview.meeting_link && (
                    <Button
                      size="sm"
                      className="min-w-0 flex-1 sm:flex-none"
                      onClick={() => window.open(interview.meeting_link, '_blank')}
                    >
                      <Video className="mr-1.5 h-4 w-4" />
                      Join
                    </Button>
                  )}
                  {interview.status === 'scheduled' && isInterviewer(interview) && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-w-0 flex-1 sm:flex-none"
                      onClick={() => updateInterviewStatus(interview.id, 'in_progress')}
                    >
                      Start
                    </Button>
                  )}
                  {interview.status === 'in_progress' && (
                    <Button
                      size="sm"
                      className="min-w-0 flex-1 sm:flex-none"
                      onClick={() => updateInterviewStatus(interview.id, 'completed')}
                    >
                      Complete
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-w-0 flex-1 sm:flex-none"
                    onClick={() => {
                      setSelectedInterview(interview);
                      setShowDetails(true);
                    }}
                  >
                    <FileText className="mr-1.5 h-4 w-4" />
                    Details
                  </Button>
                  {interview.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-w-0 flex-1 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:flex-none"
                      onClick={() => updateInterviewStatus(interview.id, 'cancelled')}
                    >
                      <X className="mr-1.5 h-4 w-4" />
                      Cancel
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}

        {visibleInterviews.length === 0 && (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
            <Calendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              {statusFilter === 'all'
                ? 'No interviews scheduled'
                : `No ${statusFilter} interviews`}
            </p>
            {statusFilter === 'all' && (
              <>
                <p className="mt-1 text-xs text-muted-foreground">
                  Schedule your first interview to get started.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setShowNewInterview(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Schedule Interview
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Interview Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{selectedInterview?.title}</DialogTitle>
            <DialogDescription>
              Interview details and notes
            </DialogDescription>
          </DialogHeader>
          {selectedInterview && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                <div>
                  <Label className="text-sm font-medium">Date & Time</Label>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedInterview.scheduled_at), 'PPP p')}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Duration</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInterview.duration_minutes} minutes
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Status</Label>
                  <Badge className={getStatusColor(selectedInterview.status)}>
                    {selectedInterview.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    {isInterviewer(selectedInterview) ? 'Interviewee' : 'Interviewer'}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedInterview.profiles?.display_name || 'Unknown User'}
                  </p>
                </div>
              </div>

              {selectedInterview.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedInterview.description}
                  </p>
                </div>
              )}

              {selectedInterview.meeting_link && (
                <div>
                  <Label className="text-sm font-medium">Meeting Link</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={selectedInterview.meeting_link}
                      readOnly
                      className="min-w-0 text-sm"
                    />
                    <Button
                      size="sm"
                      onClick={() => window.open(selectedInterview.meeting_link, '_blank')}
                    >
                      Open
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-sm font-medium">Notes</Label>
                <Textarea
                  placeholder="Add interview notes..."
                  value={selectedInterview.notes || ''}
                  onChange={(e) => {
                    if (selectedInterview) {
                      setSelectedInterview({
                        ...selectedInterview,
                        notes: e.target.value
                      });
                    }
                  }}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={() => {
                if (selectedInterview) {
                  updateInterviewNotes(selectedInterview.id, selectedInterview.notes || '');
                  setShowDetails(false);
                }
              }}
            >
              Save Notes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewInterface;