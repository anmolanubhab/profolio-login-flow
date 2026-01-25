import { useEffect, useState } from 'react';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MyJobCard } from '@/components/jobs/MyJobCard';
import { useUserApplications } from '@/hooks/use-company-jobs';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, Bookmark } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const MyJobs = () => {
  const { user, signOut } = useAuth();
  const { applications, isLoading, withdrawApplication } = useUserApplications();
  const { toast } = useToast();
  
  // Filter applications
  const appliedJobs = applications.filter(app => app.status === 'applied');
  const inProgressJobs = applications.filter(app => ['shortlisted', 'interview'].includes(app.status));
  const archivedJobs = applications.filter(app => ['rejected', 'withdrawn'].includes(app.status));
  // Saved jobs logic is currently a placeholder as per requirements and available data
  const savedJobs: any[] = []; 

  const handleWithdraw = async (applicationId: string) => {
    const result = await withdrawApplication(applicationId);
    if (result.success) {
      toast({ 
        title: 'Application withdrawn', 
        description: 'Your application has been successfully withdrawn' 
      });
    } else {
      toast({ 
        title: 'Error', 
        description: result.error, 
        variant: 'destructive' 
      });
    }
  };

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="container mx-auto max-w-4xl py-6">
        <h1 className="text-3xl font-bold mb-6">My Jobs</h1>
        
        <Tabs defaultValue="saved" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="in_progress">In Progress</TabsTrigger>
            <TabsTrigger value="applied">Applied</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="space-y-4">
             <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card text-card-foreground shadow-sm">
                <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No saved jobs</h3>
                <p className="text-sm text-muted-foreground">
                  Jobs you save will appear here.
                </p>
             </div>
          </TabsContent>

          <TabsContent value="in_progress" className="space-y-4">
            {isLoading ? (
               <SkeletonList />
            ) : inProgressJobs.length > 0 ? (
              inProgressJobs.map(app => (
                <MyJobCard key={app.id} application={app as any} />
              ))
            ) : (
              <EmptyState title="No jobs in progress" message="Applications you are shortlisted or interviewing for will appear here." />
            )}
          </TabsContent>

          <TabsContent value="applied" className="space-y-4">
            {isLoading ? (
               <SkeletonList />
            ) : appliedJobs.length > 0 ? (
              appliedJobs.map(app => (
                <MyJobCard 
                  key={app.id} 
                  application={app as any} 
                  onWithdraw={handleWithdraw}
                />
              ))
            ) : (
              <EmptyState title="No active applications" message="Jobs you have applied to will appear here." />
            )}
          </TabsContent>

          <TabsContent value="archived" className="space-y-4">
            {isLoading ? (
               <SkeletonList />
            ) : archivedJobs.length > 0 ? (
              archivedJobs.map(app => (
                <MyJobCard key={app.id} application={app as any} />
              ))
            ) : (
              <EmptyState title="No archived jobs" message="Rejected or withdrawn applications will appear here." />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

const SkeletonList = () => (
  <div className="space-y-4">
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-48 w-full" />
    ))}
  </div>
);

const EmptyState = ({ title, message }: { title: string, message: string }) => (
  <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card text-card-foreground shadow-sm">
    <Briefcase className="w-12 h-12 text-muted-foreground mb-4" />
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground">{message}</p>
  </div>
);

export default MyJobs;
