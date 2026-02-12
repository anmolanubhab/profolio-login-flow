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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-[#1D2226] tracking-tight">Your Interviews</h2>
          <p className="text-[#5E6B7E] text-sm font-medium mt-1">Manage and attend your scheduled video interviews.</p>
        </div>
        <Dialog open={showNewInterview} onOpenChange={setShowNewInterview}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-lg shadow-[#833AB4]/20 border-none transition-all duration-300">
              <Plus className="h-4 w-4 mr-2" />
              Schedule Interview
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Schedule New Interview</DialogTitle>
              <DialogDescription className="text-[#5E6B7E]">
                Set up a video interview with a candidate or interviewer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title" className="text-sm font-semibold text-[#1D2226]">Interview Title</Label>
                <Input
                  id="title"
                  value={newInterview.title}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Frontend Developer Interview"
                  className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="interviewee" className="text-sm font-semibold text-[#1D2226]">Interviewee ID</Label>
                <Input
                  id="interviewee"
                  value={newInterview.interviewee_id}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, interviewee_id: e.target.value }))}
                  placeholder="Enter user ID"
                  className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="datetime" className="text-sm font-semibold text-[#1D2226]">Date & Time</Label>
                <Input
                  id="datetime"
                  type="datetime-local"
                  value={newInterview.scheduled_at}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4]"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration" className="text-sm font-semibold text-[#1D2226]">Duration (minutes)</Label>
                <Select 
                  value={newInterview.duration_minutes.toString()} 
                  onValueChange={(value) => setNewInterview(prev => ({ ...prev, duration_minutes: parseInt(value) }))}
                >
                  <SelectTrigger className="rounded-xl border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="90">1.5 hours</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description" className="text-sm font-semibold text-[#1D2226]">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={newInterview.description}
                  onChange={(e) => setNewInterview(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Interview details, requirements, etc."
                  className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4] min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="submit" 
                onClick={createInterview}
                className="w-full rounded-full bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-lg shadow-[#833AB4]/20 border-none h-11 font-bold"
              >
                Schedule Interview
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Interviews List */}
      <div className="grid gap-6">
        {interviews.map((interview, index) => (
          <Card 
            key={interview.id} 
            className="group hover:shadow-xl transition-all duration-500 border-none shadow-sm rounded-[2rem] overflow-hidden animate-in fade-in slide-in-from-bottom-4"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className={`w-full md:w-2 bg-gradient-to-b ${
                  interview.status === 'scheduled' ? 'from-[#0077B5] to-[#833AB4]' :
                  interview.status === 'in_progress' ? 'from-green-400 to-emerald-600' :
                  'from-gray-300 to-gray-400'
                }`} />
                <div className="flex-1 p-6 md:p-8">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-4">
                        <h3 className="font-bold text-xl text-[#1D2226] tracking-tight group-hover:text-[#833AB4] transition-colors">
                          {interview.title}
                        </h3>
                        <Badge className={`rounded-full px-3 py-1 font-semibold border-none ${
                          interview.status === 'scheduled' ? 'bg-blue-50 text-[#0077B5]' :
                          interview.status === 'in_progress' ? 'bg-green-50 text-green-600' :
                          interview.status === 'completed' ? 'bg-gray-50 text-gray-600' :
                          'bg-red-50 text-red-600'
                        }`}>
                          {interview.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-[#5E6B7E] font-medium mb-6">
                        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                          <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center shadow-sm text-[#833AB4]">
                            <Calendar className="h-4 w-4" />
                          </div>
                          <span>{format(new Date(interview.scheduled_at), 'PPP')}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-2xl border border-gray-100/50">
                          <div className="h-8 w-8 rounded-xl bg-white flex items-center justify-center shadow-sm text-[#E1306C]">
                            <Clock className="h-4 w-4" />
                          </div>
                          <span>{format(new Date(interview.scheduled_at), 'p')} ({interview.duration_minutes}m)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mb-6 p-1 pr-4 w-fit bg-gray-50/50 rounded-full border border-gray-100/30">
                        <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                          <AvatarImage src={interview.profiles?.avatar_url} />
                          <AvatarFallback className="bg-gradient-to-br from-[#0077B5] to-[#833AB4] text-white">
                            {interview.profiles?.display_name?.[0] || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs text-[#5E6B7E] font-bold uppercase tracking-wider">
                            {isInterviewer(interview) ? 'Interviewing' : 'Interviewer'}
                          </p>
                          <p className="text-sm font-bold text-[#1D2226]">
                            {interview.profiles?.display_name || 'Unknown User'}
                          </p>
                        </div>
                      </div>

                      {interview.description && (
                        <p className="text-[#5E6B7E] text-sm leading-relaxed line-clamp-2 italic">
                          "{interview.description}"
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row lg:flex-col gap-3 min-w-[180px]">
                      {interview.status === 'scheduled' && (
                        <>
                          {interview.meeting_link && (
                            <Button
                              onClick={() => window.open(interview.meeting_link, '_blank')}
                              className="rounded-full bg-gradient-to-r from-[#0077B5] to-[#833AB4] text-white hover:opacity-90 shadow-lg shadow-[#0077B5]/20 font-bold h-11"
                            >
                              <Video className="h-4 w-4 mr-2" />
                              Join Meeting
                            </Button>
                          )}
                          {isInterviewer(interview) && (
                            <Button
                              variant="outline"
                              onClick={() => updateInterviewStatus(interview.id, 'in_progress')}
                              className="rounded-full border-gray-200 hover:bg-gray-50 text-[#1D2226] font-bold h-11 transition-all"
                            >
                              Start Interview
                            </Button>
                          )}
                        </>
                      )}

                      {interview.status === 'in_progress' && (
                        <Button
                          onClick={() => updateInterviewStatus(interview.id, 'completed')}
                          className="rounded-full bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:opacity-90 shadow-lg shadow-green-500/20 font-bold h-11"
                        >
                          Complete Interview
                        </Button>
                      )}

                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedInterview(interview);
                            setShowDetails(true);
                          }}
                          className="flex-1 rounded-full text-[#5E6B7E] hover:text-[#833AB4] hover:bg-[#833AB4]/5 font-bold h-11 transition-all"
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Details
                        </Button>

                        {interview.status === 'scheduled' && (
                          <Button
                            variant="ghost"
                            onClick={() => updateInterviewStatus(interview.id, 'cancelled')}
                            className="rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 font-bold h-11 transition-all"
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {interviews.length === 0 && (
          <Card className="border-2 border-dashed border-gray-100 bg-gray-50/30 rounded-[2.5rem]">
            <CardContent className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full" />
                <div className="relative h-20 w-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-[#833AB4]">
                  <Calendar className="h-10 w-10" />
                </div>
              </div>
              <h3 className="text-2xl font-bold text-[#1D2226] mb-2 tracking-tight">No interviews scheduled</h3>
              <p className="text-[#5E6B7E] font-medium max-w-sm mb-8 leading-relaxed">
                Schedule your first interview to get started with video interviews and coordination.
              </p>
              <Button 
                onClick={() => setShowNewInterview(true)}
                className="rounded-full px-8 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-xl shadow-[#833AB4]/25 border-none h-12 font-bold transition-all transform hover:scale-105 active:scale-95"
              >
                <Plus className="h-5 w-5 mr-2" />
                Schedule Interview
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Interview Details Dialog */}
      <Dialog open={showDetails} onOpenChange={setShowDetails}>
        <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
          <div className="h-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
          <div className="p-8">
            <DialogHeader className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <DialogTitle className="text-2xl font-bold text-[#1D2226] tracking-tight">{selectedInterview?.title}</DialogTitle>
                {selectedInterview && (
                  <Badge className={`rounded-full px-3 py-1 font-semibold border-none ${
                    selectedInterview.status === 'scheduled' ? 'bg-blue-50 text-[#0077B5]' :
                    selectedInterview.status === 'in_progress' ? 'bg-green-50 text-green-600' :
                    selectedInterview.status === 'completed' ? 'bg-gray-50 text-gray-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {selectedInterview.status.replace('_', ' ')}
                  </Badge>
                )}
              </div>
              <DialogDescription className="text-[#5E6B7E] font-medium">
                View interview details and manage session notes.
              </DialogDescription>
            </DialogHeader>

            {selectedInterview && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Date & Time</Label>
                    <div className="flex items-center gap-2 text-[#1D2226] font-bold">
                      <Calendar className="h-4 w-4 text-[#0077B5]" />
                      {format(new Date(selectedInterview.scheduled_at), 'PPP p')}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Duration</Label>
                    <div className="flex items-center gap-2 text-[#1D2226] font-bold">
                      <Clock className="h-4 w-4 text-[#833AB4]" />
                      {selectedInterview.duration_minutes} minutes
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">
                      {isInterviewer(selectedInterview) ? 'Interviewee' : 'Interviewer'}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={selectedInterview.profiles?.avatar_url} />
                        <AvatarFallback className="bg-gray-100 text-[10px]">
                          {selectedInterview.profiles?.display_name?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[#1D2226] font-bold">{selectedInterview.profiles?.display_name || 'Unknown User'}</span>
                    </div>
                  </div>
                </div>

                {selectedInterview.description && (
                  <div className="space-y-2 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Description</Label>
                    <p className="text-[#1D2226] text-sm leading-relaxed">
                      {selectedInterview.description}
                    </p>
                  </div>
                )}

                {selectedInterview.meeting_link && (
                  <div className="space-y-3">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Meeting Link</Label>
                    <div className="flex gap-2">
                      <div className="flex-1 bg-gray-50 rounded-xl px-4 py-2 border border-gray-200 text-sm font-mono text-[#5E6B7E] truncate">
                        {selectedInterview.meeting_link}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => window.open(selectedInterview.meeting_link, '_blank')}
                        className="rounded-xl bg-[#1D2226] hover:bg-black text-white font-bold px-4"
                      >
                        Open
                      </Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Session Notes</Label>
                  <Textarea
                    placeholder="Capture key points from the interview..."
                    value={selectedInterview.notes || ''}
                    onChange={(e) => {
                      if (selectedInterview) {
                        setSelectedInterview({
                          ...selectedInterview,
                          notes: e.target.value
                        });
                      }
                    }}
                    className="rounded-2xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4] min-h-[120px] bg-gray-50/50"
                  />
                </div>
              </div>
            )}
            <DialogFooter className="mt-10">
              <Button
                onClick={() => {
                  if (selectedInterview) {
                    updateInterviewNotes(selectedInterview.id, selectedInterview.notes || '');
                    setShowDetails(false);
                  }
                }}
                className="w-full rounded-full bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-lg shadow-[#833AB4]/20 border-none h-12 font-bold"
              >
                Save Notes
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InterviewInterface;