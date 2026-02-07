
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobAnalytics } from '@/hooks/useJobAnalytics';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Users, CheckCircle2, XCircle, MessageSquare, TrendingUp, BarChart3, Lock, History } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeAlert } from '@/components/monetization/UpgradeAlert';

const JobInsightsPage = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const { data: analytics, isLoading: isAnalyticsLoading, error } = useJobAnalytics(jobId);
  const { data: subscription } = useSubscription();
  const [jobTitle, setJobTitle] = useState<string>('');
  const [isLoadingJob, setIsLoadingJob] = useState(true);

  useEffect(() => {
    const fetchJobDetails = async () => {
      if (!jobId) return;
      
      const { data, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();
        
      if (data) {
        setJobTitle(data.title);
      }
      setIsLoadingJob(false);
    };

    fetchJobDetails();
  }, [jobId]);

  const handleBack = () => {
    navigate('/jobs/my-jobs');
  };

  if (error) {
    return (
      <div className="container py-8 max-w-4xl">
        <Button variant="ghost" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Jobs
        </Button>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center text-center p-6">
              <XCircle className="h-12 w-12 text-destructive mb-4" />
              <h2 className="text-xl font-semibold mb-2">Error Loading Insights</h2>
              <p className="text-muted-foreground">
                {error.message === 'Access denied' 
                  ? "You don't have permission to view insights for this job." 
                  : "We couldn't load the analytics for this job. Please try again later."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Button variant="ghost" size="sm" onClick={handleBack} className="-ml-3 h-8">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Job Insights</h1>
          <div className="flex items-center gap-2">
             {isLoadingJob ? (
               <Skeleton className="h-6 w-48" />
             ) : (
               <p className="text-lg text-muted-foreground">
                 Performance metrics for <span className="font-medium text-foreground">{jobTitle}</span>
               </p>
             )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 gap-1 pl-2 pr-3">
             <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
             Live Updates
          </Badge>
        </div>
      </div>

      {isAnalyticsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           {[1, 2, 3, 4].map((i) => (
             <Card key={i}>
               <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                 <CardTitle className="text-sm font-medium"><Skeleton className="h-4 w-24" /></CardTitle>
               </CardHeader>
               <CardContent>
                 <Skeleton className="h-8 w-16 mb-2" />
                 <Skeleton className="h-3 w-32" />
               </CardContent>
             </Card>
           ))}
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.views || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Unique page visits
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Applications</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.total_applications || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {analytics?.views ? Math.round(((analytics.total_applications || 0) / analytics.views) * 100) : 0}% conversion rate
                </p>
              </CardContent>
            </Card>

            <Card className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Sent</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.messages_sent || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Outreach messages
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pipeline Status */}
          <div className="grid gap-4 md:grid-cols-2">
             <Card className="col-span-1">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <BarChart3 className="h-5 w-5" />
                   Application Pipeline
                 </CardTitle>
                 <CardDescription>Current status distribution of candidates</CardDescription>
               </CardHeader>
               <CardContent>
                 <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                           <div className="h-3 w-3 rounded-full bg-green-500" />
                           <span>Shortlisted</span>
                        </div>
                        <span className="font-medium">{analytics?.shortlisted || 0}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-green-500" 
                          style={{ width: `${analytics?.total_applications ? ((analytics.shortlisted || 0) / analytics.total_applications) * 100 : 0}%` }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                           <div className="h-3 w-3 rounded-full bg-red-500" />
                           <span>Rejected</span>
                        </div>
                        <span className="font-medium">{analytics?.rejected || 0}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-red-500" 
                          style={{ width: `${analytics?.total_applications ? ((analytics.rejected || 0) / analytics.total_applications) * 100 : 0}%` }} 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                           <div className="h-3 w-3 rounded-full bg-blue-500" />
                           <span>In Review / Pending</span>
                        </div>
                        <span className="font-medium">
                          {(analytics?.total_applications || 0) - (analytics?.shortlisted || 0) - (analytics?.rejected || 0)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-500" 
                          style={{ width: `${analytics?.total_applications ? (((analytics.total_applications || 0) - (analytics.shortlisted || 0) - (analytics.rejected || 0)) / analytics.total_applications) * 100 : 0}%` }} 
                        />
                      </div>
                    </div>
                 </div>
               </CardContent>
             </Card>

             <Card className="col-span-1 bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
               <CardHeader>
                 <CardTitle className="flex items-center gap-2">
                   <TrendingUp className="h-5 w-5 text-primary" />
                   Performance Tips
                 </CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                 <div className="flex gap-3 items-start">
                   <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                     <span className="text-xs font-bold text-primary">1</span>
                   </div>
                   <p className="text-sm text-muted-foreground">
                     Jobs with detailed descriptions and salary ranges get <strong>40% more applications</strong>.
                   </p>
                 </div>
                 <div className="flex gap-3 items-start">
                   <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                     <span className="text-xs font-bold text-primary">2</span>
                   </div>
                   <p className="text-sm text-muted-foreground">
                     Responding to candidates within 48 hours improves your employer brand score.
                   </p>
                 </div>
                 <div className="flex gap-3 items-start">
                   <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                     <span className="text-xs font-bold text-primary">3</span>
                   </div>
                   <p className="text-sm text-muted-foreground">
                     Share your job post on social media to increase visibility.
                   </p>
                 </div>
               </CardContent>
             </Card>
          </div>

          {/* Extended History - Pro Feature */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <History className="h-5 w-5" />
              30-Day History
            </h2>
            
            {subscription?.features.canViewExtendedAnalytics ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Views & Applications Over Time</CardTitle>
                  <CardDescription>Performance trend for the last 30 days</CardDescription>
                </CardHeader>
                <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground bg-muted/20 rounded-md m-6 border border-dashed">
                  Chart visualization coming soon
                </CardContent>
              </Card>
            ) : (
              <div className="relative">
                <Card className="blur-[2px] opacity-60 pointer-events-none select-none">
                  <CardHeader>
                    <CardTitle className="text-sm font-medium">Views & Applications Over Time</CardTitle>
                    <CardDescription>Performance trend for the last 30 days</CardDescription>
                  </CardHeader>
                  <CardContent className="h-[200px] flex items-end gap-2 px-6 pb-2 items-center justify-center">
                    <div className="w-full h-full bg-muted/20 rounded-md" />
                  </CardContent>
                </Card>
                <div className="absolute inset-0 flex items-center justify-center p-6">
                  <UpgradeAlert 
                    title="Unlock Extended History" 
                    description="See how your job performs over time with 30-day historical data."
                    className="max-w-md shadow-lg border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
                    onUpgrade={() => navigate('/settings')}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default JobInsightsPage;
