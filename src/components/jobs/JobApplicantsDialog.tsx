import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useJobApplicants } from '@/hooks/use-company-jobs';
import { Loader2, MoreVertical, FileText, User, Mail, Calendar, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface JobApplicantsDialogProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobTitle: string;
}

const statusColors: Record<string, string> = {
  applied: 'bg-blue-100 text-blue-800',
  shortlisted: 'bg-purple-100 text-purple-800',
  interview: 'bg-yellow-100 text-yellow-800',
  offered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  withdrawn: 'bg-gray-100 text-gray-800',
};

const statusLabels: Record<string, string> = {
  applied: 'Pending',
  shortlisted: 'Reviewed',
  interview: 'Interviewing',
  offered: 'Hired/Offered',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function JobApplicantsDialog({ jobId, open, onOpenChange, jobTitle }: JobApplicantsDialogProps) {
  const { applicants, isLoading, updateApplicationStatus } = useJobApplicants(jobId || undefined);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedCoverLetter, setSelectedCoverLetter] = useState<{name: string, content: string} | null>(null);

  const handleStatusUpdate = async (applicationId: string, newStatus: any, profileId?: string) => {
    setUpdatingId(applicationId);
    const result = await updateApplicationStatus(applicationId, newStatus, profileId, jobTitle);
    setUpdatingId(null);

    if (result.success) {
      toast({
        title: "Status updated",
        description: `Applicant status changed to ${statusLabels[newStatus] || newStatus}`,
      });
    } else {
      toast({
        title: "Update failed",
        description: result.error,
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Applicants for {jobTitle}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : applicants.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No applicants yet for this position.</p>
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {applicants.map((applicant) => (
                <div
                  key={applicant.id}
                  className="flex items-start justify-between p-4 border rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={applicant.profile?.avatar_url || undefined} />
                      <AvatarFallback>{applicant.profile?.display_name?.[0] || '?'}</AvatarFallback>
                    </Avatar>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-lg">
                          {applicant.profile?.display_name || applicant.profile?.full_name || 'Anonymous User'}
                        </h3>
                        <Badge variant="secondary" className={statusColors[applicant.status] || 'bg-gray-100'}>
                          {statusLabels[applicant.status] || applicant.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        {applicant.profile?.profession || 'No profession listed'}
                        <span className="text-gray-300">•</span>
                        <Calendar className="h-3 w-3" />
                        Applied {format(new Date(applicant.applied_at), 'MMM d, yyyy')}
                      </p>

                      <div className="flex gap-2 mt-2">
                        {applicant.cover_letter && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs"
                            onClick={() => setSelectedCoverLetter({
                              name: applicant.profile?.display_name || 'Applicant',
                              content: applicant.cover_letter!
                            })}
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Cover Letter
                          </Button>
                        )}
                        <Button  
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs"
                          onClick={() => navigate(`/profile/${applicant.user_id}`)}
                        >
                          <User className="h-3 w-3 mr-1" />
                          View Profile
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" disabled={updatingId === applicant.id}>
                          {updatingId === applicant.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <span className="mr-2">Change Status</span>
                          )}
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'shortlisted', applicant.user_id)}>
                          Mark as Reviewed
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'interview', applicant.user_id)}>
                          Schedule Interview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'offered', applicant.user_id)}>
                          Mark as Hired/Offered
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleStatusUpdate(applicant.id, 'rejected', applicant.user_id)} className="text-destructive">
                          Reject Application
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>

      <Dialog open={!!selectedCoverLetter} onOpenChange={(open) => !open && setSelectedCoverLetter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cover Letter - {selectedCoverLetter?.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="whitespace-pre-wrap text-sm p-4">
              {selectedCoverLetter?.content}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
