import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Calendar, Clock, Video, Plus, Users, FileText, Phone } from 'lucide-react';
import { format } from 'date-fns';

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
            .single();

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-100 text-blue-800';
      case 'in_progress':
        return 'bg-green-100 text-green-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const isInterviewer = (interview: Interview) => interview.interviewer_id === user.id;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Interviews</h2>
        <Dialog open={showNewInterview} onOpenChange={setShowNewInterview}>
          <DialogTrigger asChild>
            <Button>
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

      {/* Interviews List */}
      <div className="grid gap-4">
        {interviews.map((interview) => (
          <Card key={interview.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{interview.title}</h3>
                    <Badge className={getStatusColor(interview.status)}>
                      {interview.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(interview.scheduled_at), 'PPP')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {format(new Date(interview.scheduled_at), 'p')} ({interview.duration_minutes}m)
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={interview.profiles?.avatar_url} />
                      <AvatarFallback>
                        {interview.profiles?.display_name?.[0] || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">
                      {isInterviewer(interview) ? 'Interviewing: ' : 'Interviewer: '}
                      {interview.profiles?.display_name || 'Unknown User'}
                    </span>
                  </div>

                  {interview.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {interview.description}
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {interview.status === 'scheduled' && (
                    <>
                      {interview.meeting_link && (
                        <Button
                          size="sm"
                          onClick={() => window.open(interview.meeting_link, '_blank')}
                          className="flex items-center gap-2"
                        >
                          <Video className="h-4 w-4" />
                          Join Meeting
                        </Button>
                      )}
                      {isInterviewer(interview) && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateInterviewStatus(interview.id, 'in_progress')}
                        >
                          Start Interview
                        </Button>
                      )}
                    </>
                  )}

                  {interview.status === 'in_progress' && (
                    <Button
                      size="sm"
                      onClick={() => updateInterviewStatus(interview.id, 'completed')}
                    >
                      Complete Interview
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedInterview(interview);
                      setShowDetails(true);
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    Details
                  </Button>

                  {interview.status === 'scheduled' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateInterviewStatus(interview.id, 'cancelled')}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {interviews.length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No interviews scheduled</h3>
              <p className="text-muted-foreground text-center mb-4">
                Schedule your first interview to get started with video interviews.
              </p>
              <Button onClick={() => setShowNewInterview(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Schedule Interview
              </Button>
            </CardContent>
          </Card>
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
              <div className="grid grid-cols-2 gap-4">
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
                      className="text-sm"
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