import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserApplications } from '@/hooks/use-company-jobs';
import { useToast } from '@/hooks/use-toast';
import { Briefcase, MapPin, Calendar, Building2, XCircle, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

const statusConfig: Record<ApplicationStatus, { 
  color: string; 
  label: string; 
  icon: typeof CheckCircle;
  description: string;
}> = {
  applied: { 
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300', 
    label: 'Applied',
    icon: Clock,
    description: 'Your application is being reviewed'
  },
  shortlisted: { 
    color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300', 
    label: 'Shortlisted',
    icon: CheckCircle,
    description: 'Great! You\'ve been shortlisted'
  },
  interview: { 
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300', 
    label: 'Interview',
    icon: Calendar,
    description: 'Interview scheduled'
  },
  offered: { 
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300', 
    label: 'Offered',
    icon: CheckCircle,
    description: 'Congratulations! You received an offer'
  },
  rejected: { 
    color: 'bg-red-100/70 text-red-700 dark:bg-red-900/30 dark:text-red-400', 
    label: 'Not Selected',
    icon: AlertCircle,
    description: 'This position has been filled'
  },
  withdrawn: { 
    color: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400', 
    label: 'Withdrawn',
    icon: XCircle,
    description: 'You withdrew your application'
  },
};

export const UserApplicationsCard = () => {
  const { applications, isLoading, withdrawApplication } = useUserApplications();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);

  const handleWithdraw = async (applicationId: string) => {
    const result = await withdrawApplication(applicationId);
    if (result.success) {
      toast({ 
        title: 'Application withdrawn', 
        description: 'Your application has been successfully withdrawn' 
      });
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <Card className="border-none shadow-sm">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3 p-3 bg-muted/30 rounded-lg">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (applications.length === 0) {
    return null;
  }

  const activeApplications = applications.filter(a => !['rejected', 'withdrawn'].includes(a.status));
  const hasActiveApplications = activeApplications.length > 0;

  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-2">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                My Applications
                <Badge 
                  variant={hasActiveApplications ? "default" : "secondary"} 
                  className="ml-1"
                >
                  {applications.length}
                </Badge>
              </CardTitle>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="space-y-2 pt-0">
            {applications.slice(0, 5).map((application) => {
              const status = statusConfig[application.status];
              const StatusIcon = status.icon;
              
              return (
                <div 
                  key={application.id} 
                  className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-lg bg-background flex items-center justify-center shrink-0 shadow-sm">
                    {(application.job as any)?.companies?.logo_url ? (
                      <img 
                        src={(application.job as any).companies.logo_url} 
                        alt="Company"
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Link 
                          to="/jobs" 
                          className="font-semibold text-sm hover:text-primary hover:underline line-clamp-1 transition-colors"
                        >
                          {application.job?.title || 'Job Title'}
                        </Link>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(application.job as any)?.companies?.name || application.job?.company_name || 'Company'}
                        </p>
                      </div>
                      <Badge className={`${status.color} shrink-0 gap-1`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
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

                    {/* Status message */}
                    <p className="text-xs text-muted-foreground/80 mt-1.5 italic">
                      {status.description}
                    </p>

                    {application.status === 'applied' && (
                      <div className="mt-2">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-xs text-muted-foreground hover:text-destructive p-0"
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Withdraw Application
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Withdraw Application?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to withdraw your application for <strong>{application.job?.title}</strong>? 
                                This action cannot be undone.
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
              );
            })}

            {applications.length > 5 && (
              <Link to="/jobs" className="block">
                <Button variant="ghost" size="sm" className="w-full text-primary hover:text-primary hover:bg-primary/10">
                  View all {applications.length} applications →
                </Button>
              </Link>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};
