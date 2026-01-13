import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserApplications } from '@/hooks/use-company-jobs';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, MapPin, Calendar, Building2, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type ApplicationStatus = 'applied' | 'shortlisted' | 'interview' | 'offered' | 'rejected' | 'withdrawn';

const statusColors: Record<ApplicationStatus, string> = {
  applied: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  shortlisted: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  interview: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  offered: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  withdrawn: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

const statusLabels: Record<ApplicationStatus, string> = {
  applied: 'Applied',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offered',
  rejected: 'Not Selected',
  withdrawn: 'Withdrawn',
};

export const UserApplicationsCard = () => {
  const { applications, isLoading, withdrawApplication, refetch } = useUserApplications();
  const { toast } = useToast();

  const handleWithdraw = async (applicationId: string) => {
    const result = await withdrawApplication(applicationId);
    if (result.success) {
      toast({ title: 'Application withdrawn', description: 'Your application has been withdrawn' });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return null;
  }

  return (
    <Card className="border-none shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          My Applications
          <Badge variant="secondary" className="ml-2">{applications.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {applications.slice(0, 5).map((application) => (
          <div 
            key={application.id} 
            className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50"
          >
            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
              {(application.job as any)?.companies?.logo_url ? (
                <img 
                  src={(application.job as any).companies.logo_url} 
                  alt="Company"
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <Building2 className="h-5 w-5 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Link 
                    to="/jobs" 
                    className="font-medium text-sm hover:underline line-clamp-1"
                  >
                    {application.job?.title || 'Job Title'}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {(application.job as any)?.companies?.name || application.job?.company_name || 'Company'}
                  </p>
                </div>
                <Badge className={statusColors[application.status]}>
                  {statusLabels[application.status]}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                {application.job?.location && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span className="truncate max-w-[100px]">{application.job.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
                </div>
              </div>

              {application.status === 'applied' && (
                <div className="mt-2">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-destructive">
                        <XCircle className="h-3 w-3 mr-1" />
                        Withdraw
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to withdraw your application for {application.job?.title}? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          onClick={() => handleWithdraw(application.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Withdraw
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          </div>
        ))}

        {applications.length > 5 && (
          <Link to="/jobs">
            <Button variant="ghost" size="sm" className="w-full text-primary">
              View all {applications.length} applications
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
};
