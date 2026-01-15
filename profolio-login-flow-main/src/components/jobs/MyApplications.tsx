import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, FileText, Briefcase, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface Application {
  id: string;
  status: string;
  applied_at: string;
  cover_letter?: string;
  jobs: {
    id: string;
    title: string;
    location: string;
    employment_type: string;
    companies: {
      name: string;
      logo_url?: string;
    };
  };
  interviews?: {
    id: string;
    application_id: string;
    scheduled_date: string;
    scheduled_time: string;
    interview_type: string;
    status: string;
  }[];
}

export const MyApplications = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
          job_id,
          jobs (
            id,
            title,
            location,
            employment_type,
            companies (
              name,
              logo_url
            )
          )
        `)
        .eq('user_id', profile.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;

      const baseApplications = (data || []) as any[];

      if (baseApplications.length === 0) {
        setApplications([]);
        return;
      }

      const applicationIds = baseApplications.map(app => app.id);

      const { data: interviews } = await supabase
        .from('job_interviews')
        .select('id, application_id, scheduled_date, scheduled_time, interview_type, status')
        .in('application_id', applicationIds);

      const interviewsByApplication = new Map<string, any[]>();
      (interviews || []).forEach(interview => {
        const list = interviewsByApplication.get(interview.application_id) || [];
        list.push(interview);
        interviewsByApplication.set(interview.application_id, list);
      });

      const applicationsWithInterviews: Application[] = baseApplications.map(app => ({
        ...app,
        interviews: interviewsByApplication.get(app.id) || []
      }));

      setApplications(applicationsWithInterviews);
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied':
        return 'default';
      case 'reviewing':
        return 'secondary';
      case 'interview':
        return 'outline';
      case 'accepted':
        return 'default';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (applications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="w-12 h-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No applications yet</h3>
        <p className="text-sm text-muted-foreground">
          Start applying to jobs to see your applications here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {applications.map((app) => (
        <Card key={app.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex gap-4">
                {app.jobs.companies.logo_url && (
                  <img 
                    src={app.jobs.companies.logo_url} 
                    alt={app.jobs.companies.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div>
                  <CardTitle className="text-xl">{app.jobs.title}</CardTitle>
                  <CardDescription>{app.jobs.companies.name}</CardDescription>
                </div>
              </div>
              <Badge variant={getStatusColor(app.status)}>
                {app.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                Applied {formatDistanceToNow(new Date(app.applied_at), { addSuffix: true })}
              </div>
              <div className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {app.jobs.employment_type}
              </div>
            </div>
            {app.cover_letter && (
              <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                {app.cover_letter}
              </p>
            )}
            {app.interviews && app.interviews.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium">Interviews</p>
                <div className="space-y-2">
                  {app.interviews.map((interview) => {
                    const dateLabel = interview.scheduled_date
                      ? format(new Date(interview.scheduled_date), 'PPP')
                      : '';
                    return (
                      <div
                        key={interview.id}
                        className="flex items-center justify-between text-sm bg-muted/40 rounded-md px-3 py-2"
                      >
                        <div className="space-y-1">
                          <div className="font-medium">
                            {interview.interview_type} interview
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {dateLabel}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {interview.scheduled_time}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {interview.status}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
