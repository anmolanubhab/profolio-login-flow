import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { MapPin, Briefcase, Calendar, Building2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

interface Application {
  id: string;
  status: string;
  applied_at: string;
  cover_letter?: string;
  job: {
    id: string;
    title: string;
    location: string;
    employment_type: string;
    companies: {
      name: string;
      logo_url?: string;
    };
  };
}

export const UserApplicationsCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchApplications();
    }
  }, [user]);

  const fetchApplications = async () => {
    if (!user) return;
    
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          applied_at,
          cover_letter,
          job:jobs(
            id,
            title,
            location,
            employment_type,
            companies(
              name,
              logo_url
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = (data || []).map((app: any) => ({
        ...app,
        job: {
          ...app.job,
          companies: app.job?.companies || { name: 'Unknown Company' }
        }
      }));

      setApplications(transformedData);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (applicationId: string) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);

      if (error) throw error;

      toast({
        title: 'Application withdrawn',
        description: 'Your application has been withdrawn successfully.',
      });

      fetchApplications();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'secondary';
      case 'shortlisted': return 'default';
      case 'interview': return 'default';
      case 'offered': return 'default';
      case 'rejected': return 'destructive';
      case 'withdrawn': return 'outline';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'applied': return '📝';
      case 'shortlisted': return '⭐';
      case 'interview': return '🎯';
      case 'offered': return '🎉';
      case 'rejected': return '❌';
      case 'withdrawn': return '↩️';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="No applications yet"
        description="Start exploring jobs and apply to positions that match your skills."
        action={
          <Button asChild>
            <a href="/jobs">Browse Jobs</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((application) => (
        <Card key={application.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                {application.job?.companies?.logo_url ? (
                  <img 
                    src={application.job.companies.logo_url} 
                    alt={application.job.companies.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <CardTitle className="text-lg">{application.job?.title || 'Unknown Position'}</CardTitle>
                  <CardDescription>{application.job?.companies?.name || 'Unknown Company'}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusColor(application.status) as any} className="flex items-center gap-1">
                <span>{getStatusIcon(application.status)}</span>
                <span className="capitalize">{application.status}</span>
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Applied {formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
              </div>
              {application.job?.employment_type && (
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4" />
                  {application.job.employment_type}
                </div>
              )}
              {application.job?.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {application.job.location}
                </div>
              )}
            </div>

            {/* Withdraw Button for Applied Status */}
            {application.status === 'applied' && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
