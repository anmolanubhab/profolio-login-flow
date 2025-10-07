import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, FileText, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

      const { data, error } = await supabase
        .from('applications')
        .select(`
          *,
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
        .eq('user_id', user.id)
        .order('applied_at', { ascending: false });

      if (error) throw error;
      setApplications(data || []);
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
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
