import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { useJobApplicants } from '@/hooks/use-company-jobs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { User, MapPin, Calendar, FileText, Mail, ExternalLink, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface JobApplicantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  companyId: string;
}

type ApplicationStatus = 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';

type InterviewStatus = 'scheduled' | 'completed' | 'selected' | 'rejected';

const statusColors: Record<ApplicationStatus, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  shortlisted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  interview: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  offered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export const JobApplicantsDialog = ({ open, onOpenChange, jobId, jobTitle, companyId }: JobApplicantsDialogProps) => {
  const { applicants, isLoading, updateApplicationStatus, refetch } = useJobApplicants(jobId);
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [schedulingForId, setSchedulingForId] = useState<string | null>(null);
  const [schedulingDate, setSchedulingDate] = useState('');
  const [schedulingTime, setSchedulingTime] = useState('');
  const [schedulingType, setSchedulingType] = useState<'HR' | 'Technical' | 'Manager' | ''>('');
  const [schedulingNotes, setSchedulingNotes] = useState('');
  const [savingInterview, setSavingInterview] = useState(false);
  const [updatingInterviewId, setUpdatingInterviewId] = useState<string | null>(null);

  const handleStatusChange = async (applicationId: string, newStatus: ApplicationStatus, applicantProfileId?: string) => {
    if (!applicationId) return;
    if (updatingId === applicationId) return; // prevent duplicate rapid updates

    setUpdatingId(applicationId);
    const result = await updateApplicationStatus(applicationId, newStatus, applicantProfileId, jobTitle);
    
    if (result.success) {
      toast({
        title: 'Status Updated',
        description: `Application status changed to ${newStatus}`,
      });
    } else {
      console.error('Failed to update status:', result.error);
      toast({
        title: 'Error',
        description: 'Failed to update status. Please try again.',
        variant: 'destructive',
      });
    }
    setUpdatingId(null);
  };

  const resetSchedulingForm = () => {
    setSchedulingForId(null);
    setSchedulingDate('');
    setSchedulingTime('');
    setSchedulingType('');
    setSchedulingNotes('');
  };

  const createCompanyInterviewNotification = async (
    event: 'scheduled' | 'completed',
    interview: {
      interview_type: string;
      scheduled_date: string;
      scheduled_time: string;
      status: string;
    }
  ) => {
    try {
      const { data: members } = await supabase
        .from('company_members')
        .select('user_id')
        .eq('company_id', companyId);

      const { data: company } = await supabase
        .from('companies')
        .select('owner_id, name')
        .eq('id', companyId)
        .single();

      const recipientIds = new Set<string>();
      (members || []).forEach(member => {
        if (member.user_id) {
          recipientIds.add(member.user_id);
        }
      });
      if (company?.owner_id) {
        recipientIds.add(company.owner_id);
      }

      if (recipientIds.size === 0) {
        return;
      }

      const type = event === 'scheduled' ? 'interview_scheduled' : 'interview_completed';

      const rows = Array.from(recipientIds).map(userId => ({
        user_id: userId,
        type,
        payload: {
          job_title: jobTitle,
          interview_type: interview.interview_type,
          scheduled_date: interview.scheduled_date,
          scheduled_time: interview.scheduled_time,
          status: interview.status
        }
      }));

      await supabase.from('notifications').insert(rows);
    } catch (error) {
      console.error('Error creating company interview notification', error);
    }
  };

  const handleScheduleInterview = async (applicant: any) => {
    if (!schedulingDate || !schedulingTime || !schedulingType) {
      toast({
        title: 'Missing information',
        description: 'Please select date, time and interview type',
        variant: 'destructive',
      });
      return;
    }
    if (!jobId || !companyId || !applicant?.id || !applicant?.user_id) {
      console.error('Missing IDs for scheduling interview', { jobId, companyId, applicant });
      toast({ title: 'Error', description: 'Unable to schedule interview', variant: 'destructive' });
      return;
    }
    if (savingInterview) return; // prevent double submit

    setSavingInterview(true);
    try {
      const { data, error } = await supabase
        .from('job_interviews')
        .insert({
          job_id: jobId,
          application_id: applicant.id,
          company_id: companyId,
          candidate_id: applicant.user_id,
          scheduled_date: schedulingDate,
          scheduled_time: schedulingTime,
          interview_type: schedulingType,
          status: 'scheduled',
          notes: schedulingNotes.trim() || null,
        })
        .select('interview_type, scheduled_date, scheduled_time, status')
        .single();

      if (error) throw error;

      if (applicant.status !== 'interview') {
        await updateApplicationStatus(applicant.id, 'interview', applicant.profile?.id, jobTitle);
      }

      if (data) {
        try {
          await createCompanyInterviewNotification('scheduled', data);
        } catch (e) {
          console.error('Failed to create company notification after scheduling interview', e);
        }
      }

      toast({
        title: 'Interview scheduled',
        description: 'Interview has been scheduled for this applicant',
      });

      resetSchedulingForm();
      await refetch();
    } catch (error: any) {
      console.error('Error scheduling interview:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule interview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingInterview(false);
    }
  };

  const handleInterviewStatusChange = async (
    applicant: any,
    interviewId: string,
    currentStatus: InterviewStatus,
    newStatus: InterviewStatus,
    interviewType: string
  ) => {
    if (!interviewId) return;
    if (currentStatus === newStatus) return;
    if (updatingInterviewId === interviewId) return; // prevent duplicate rapid updates

    setUpdatingInterviewId(interviewId);
    try {
      const { error } = await supabase
        .from('job_interviews')
        .update({ status: newStatus })
        .eq('id', interviewId);

      if (error) throw error;

      if (newStatus === 'completed') {
        try {
          await createCompanyInterviewNotification('completed', {
            interview_type: interviewType,
            scheduled_date: '',
            scheduled_time: '',
            status: newStatus
          });
        } catch (e) {
          console.error('Failed to create company notification for completed interview', e);
        }
      }

      if (newStatus === 'selected' || newStatus === 'rejected') {
        const candidateProfileId = applicant.profile?.id || applicant.user_id;
        if (candidateProfileId) {
          try {
            await supabase.from('notifications').insert({
              user_id: candidateProfileId,
              type: newStatus === 'selected' ? 'interview_selected' : 'interview_rejected',
              payload: {
                job_title: jobTitle,
                status: newStatus,
                interview_type: interviewType,
              }
            });
          } catch (e) {
            console.error('Notification insert failed for interview decision:', e);
          }
        }
      }

      toast({
        title: 'Interview updated',
        description: `Interview marked as ${newStatus}`,
      });

      await refetch();
    } catch (error: any) {
      console.error('Error updating interview status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update interview. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingInterviewId(null);
    }
  };

  const handleEditInterviewNotes = async (interviewId: string, currentNotes: string | null) => {
    if (!interviewId) return;
    const value = window.prompt('Internal notes for this interview', currentNotes || '');
    if (value === null) return;
    try {
      const { error } = await supabase
        .from('job_interviews')
        .update({ notes: value.trim() || null })
        .eq('id', interviewId);

      if (error) throw error;

      toast({
        title: 'Notes updated',
        description: 'Internal notes have been saved',
      });

      await refetch();
    } catch (error: any) {
      console.error('Error updating interview notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to update notes. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Applicants for {jobTitle}</DialogTitle>
          <DialogDescription>
            {applicants.length} {applicants.length === 1 ? 'applicant' : 'applicants'} for this position
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {isLoading ? (
            <>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </>
          ) : applicants.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No applicants yet</h3>
              <p className="text-sm text-muted-foreground">
                Applicants will appear here once they apply
              </p>
            </div>
          ) : (
            applicants.map((applicant) => (
              <Card key={applicant.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={applicant.profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {applicant.profile?.display_name?.charAt(0) || 
                         applicant.profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link 
                            to={`/profile/${applicant.profile?.id}`}
                            className="font-semibold text-foreground hover:underline"
                          >
                            {applicant.profile?.display_name || applicant.profile?.full_name || 'Unknown'}
                          </Link>
                          {applicant.profile?.profession && (
                            <p className="text-sm text-muted-foreground">
                              {applicant.profile.profession}
                            </p>
                          )}
                        </div>
                        <Badge className={statusColors[applicant.status]}>
                          {applicant.status}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Applied {formatDistanceToNow(new Date(applicant.applied_at), { addSuffix: true })}
                        </div>
                        {applicant.profile?.location && (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {applicant.profile.location}
                          </div>
                        )}
                        {applicant.profile?.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${applicant.profile.email}`} className="hover:underline">
                              {applicant.profile.email}
                            </a>
                          </div>
                        )}
                      </div>

                      {applicant.cover_letter && (
                        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground mb-1">
                            <FileText className="h-3 w-3" />
                            Cover Letter
                          </div>
                          <p className="text-sm text-foreground line-clamp-3">
                            {applicant.cover_letter}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4">
                        <Select
                          value={applicant.status}
                          onValueChange={(value: ApplicationStatus) => 
                            handleStatusChange(applicant.id, value, applicant.profile?.id)
                          }
                          disabled={updatingId === applicant.id || applicant.status === 'withdrawn'}
                        >
                          <SelectTrigger className="w-40 h-8 text-xs">
                            <SelectValue placeholder="Change status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="applied">Applied</SelectItem>
                            <SelectItem value="shortlisted">Shortlisted</SelectItem>
                            <SelectItem value="interview">Interview</SelectItem>
                            <SelectItem value="offered">Offered</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        {applicant.status === 'shortlisted' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setSchedulingForId(prev =>
                                prev === applicant.id ? null : applicant.id
                              );
                              setSchedulingDate('');
                              setSchedulingTime('');
                              setSchedulingType('');
                              setSchedulingNotes('');
                            }}
                          >
                            Schedule Interview
                          </Button>
                        )}
                        <Link to={`/profile/${applicant.profile?.id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            View Profile
                          </Button>
                        </Link>
                      </div>

                      {schedulingForId === applicant.id && (
                        <div className="mt-4 space-y-3 border-t pt-3">
                          <div className="flex flex-wrap gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Date</p>
                              <Input
                                type="date"
                                value={schedulingDate}
                                onChange={(e) => setSchedulingDate(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Time</p>
                              <Input
                                type="time"
                                value={schedulingTime}
                                onChange={(e) => setSchedulingTime(e.target.value)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs font-medium">Type</p>
                              <Select
                                value={schedulingType}
                                onValueChange={(value: 'HR' | 'Technical' | 'Manager') =>
                                  setSchedulingType(value)
                                }
                              >
                                <SelectTrigger className="w-32 h-8 text-xs">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="HR">HR</SelectItem>
                                  <SelectItem value="Technical">Technical</SelectItem>
                                  <SelectItem value="Manager">Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-medium">Internal notes</p>
                            <Input
                              value={schedulingNotes}
                              onChange={(e) => setSchedulingNotes(e.target.value)}
                              placeholder="Visible only to your company"
                              className="text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-8 text-xs"
                              disabled={savingInterview}
                              onClick={() => handleScheduleInterview(applicant)}
                            >
                              {savingInterview ? 'Scheduling...' : 'Save Interview'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 text-xs"
                              onClick={resetSchedulingForm}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}

                      {applicant.interviews && applicant.interviews.length > 0 && (
                        <div className="mt-4 space-y-2 border-t pt-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Interviews
                          </p>
                          <div className="space-y-2">
                            {applicant.interviews.map((interview) => {
                              const dateLabel = interview.scheduled_date
                                ? format(new Date(interview.scheduled_date), 'PPP')
                                : '';
                              return (
                                <div
                                  key={interview.id}
                                  className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/40 p-2"
                                >
                                  <div className="space-y-1 text-xs">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className="px-2 py-0.5 text-[10px]">
                                        {interview.interview_type} interview
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="px-2 py-0.5 text-[10px]"
                                      >
                                        {interview.status}
                                      </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        <span>{dateLabel}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span>{interview.scheduled_time}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Select
                                      value={interview.status as InterviewStatus}
                                      onValueChange={(value: InterviewStatus) =>
                                        handleInterviewStatusChange(
                                          applicant,
                                          interview.id,
                                          interview.status as InterviewStatus,
                                          value,
                                          interview.interview_type
                                        )
                                      }
                                      disabled={updatingInterviewId === interview.id}
                                    >
                                      <SelectTrigger className="w-32 h-8 text-xs">
                                        <SelectValue placeholder="Update" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="scheduled">Scheduled</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="selected">Selected</SelectItem>
                                        <SelectItem value="rejected">Rejected</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 text-[11px]"
                                      onClick={() =>
                                        handleEditInterviewNotes(interview.id, interview.notes)
                                      }
                                    >
                                      Notes
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
