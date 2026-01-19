import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobApplicants } from '@/hooks/use-company-jobs';
import { useToast } from '@/hooks/use-toast';
import { User, MapPin, Calendar, FileText, Mail, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';

interface JobApplicantsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  companyId?: string;
}

type ApplicationStatus = 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';

const statusColors: Record<ApplicationStatus, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  shortlisted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  interview: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  offered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export const JobApplicantsDialog = ({ open, onOpenChange, jobId, jobTitle }: JobApplicantsDialogProps) => {
  const { applicants, isLoading, updateApplicationStatus } = useJobApplicants(jobId);
  const { toast } = useToast();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleStatusChange = async (applicationId: string, newStatus: ApplicationStatus, applicantProfileId?: string) => {
    if (!applicationId) return;
    if (updatingId === applicationId) return;

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
                        <Link to={`/profile/${applicant.profile?.id}`}>
                          <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                            <ExternalLink className="h-3 w-3" />
                            View Profile
                          </Button>
                        </Link>
                      </div>
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
