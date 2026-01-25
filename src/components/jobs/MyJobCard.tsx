import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { MapPin, Briefcase, Calendar, Building2, Clock, CheckCircle, AlertCircle, XCircle, Video } from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface MyJobCardProps {
  application: Application;
  onWithdraw?: (id: string) => void;
}

export const MyJobCard = ({ application, onWithdraw }: MyJobCardProps) => {
  const [interview, setInterview] = useState<any>(null);

  useEffect(() => {
    if (application.status === 'interview') {
      fetchInterview();
    }
  }, [application.id, application.status]);

  const fetchInterview = async () => {
    const { data, error } = await supabase
      .from('job_interviews')
      .select('*')
      .eq('application_id', application.id)
      .maybeSingle();

    if (!error && data) {
      setInterview(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'applied': return 'secondary';
      case 'shortlisted': return 'default'; // amber-ish usually
      case 'interview': return 'default'; // purple-ish usually
      case 'offered': return 'default'; // green-ish usually
      case 'rejected': return 'destructive';
      case 'withdrawn': return 'outline';
      default: return 'secondary';
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            {application.job.companies?.logo_url ? (
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
              <CardTitle className="text-xl">{application.job.title}</CardTitle>
              <CardDescription>{application.job.companies?.name}</CardDescription>
            </div>
          </div>
          <Badge variant={getStatusColor(application.status) as any}>
            {application.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Applied {formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
          </div>
          <div className="flex items-center gap-1">
            <Briefcase className="w-4 h-4" />
            {application.job.employment_type}
          </div>
          <div className="flex items-center gap-1">
            <MapPin className="w-4 h-4" />
            {application.job.location}
          </div>
        </div>

        {/* Withdraw Button for Applied Status */}
        {application.status === 'applied' && onWithdraw && (
          <div className="mb-4">
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
                    Are you sure you want to withdraw your application for <strong>{application.job.title}</strong>? 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onWithdraw(application.id)}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Withdraw
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* Interview UI Guard */}
        {application.status === 'interview' && interview && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <h4 className="font-semibold mb-2 flex items-center gap-2">
              <Video className="w-4 h-4" />
              Interview Details
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type:</span>
                <span>{interview.interview_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{interview.scheduled_date} at {interview.scheduled_time}</span>
              </div>
              {interview.meeting_link && (
                 <div className="pt-2">
                   <Button size="sm" variant="outline" className="w-full" onClick={() => window.open(interview.meeting_link, '_blank')}>
                     Join Meeting
                   </Button>
                 </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
