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
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto pt-6 pb-12 px-4 sm:px-6 relative">
            <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-6 md:gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tighter">
                  My Job Journey
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Track your applications, interviews, and career progress in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-12 px-0 sm:px-4">
          <Tabs defaultValue="saved" className="w-full">
            <div className="flex justify-center mb-10 px-4 sm:px-0">
              <TabsList className="bg-gray-100/50 p-1.5 rounded-2xl h-auto grid grid-cols-4 w-full max-w-2xl">
                <TabsTrigger 
                  value="saved" 
                  className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-sm font-semibold"
                >
                  Saved
                </TabsTrigger>
                <TabsTrigger 
                  value="in_progress" 
                  className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-sm font-semibold"
                >
                  In Progress
                </TabsTrigger>
                <TabsTrigger 
                  value="applied" 
                  className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-sm font-semibold"
                >
                  Applied
                </TabsTrigger>
                <TabsTrigger 
                  value="archived" 
                  className="rounded-xl px-4 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-sm font-semibold"
                >
                  Archived
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="space-y-6">
              <TabsContent value="saved" className="focus-visible:outline-none px-4 sm:px-0">
                 <div className="bg-gray-50/50 rounded-none sm:rounded-[2rem] p-16 text-center border-0 sm:border-2 border-dashed border-gray-200">
                    <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Bookmark className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No saved jobs</h3>
                    <p className="text-gray-500 max-w-xs mx-auto">
                      Jobs you save while browsing will appear here for easy access.
                    </p>
                 </div>
              </TabsContent>

              <TabsContent value="in_progress" className="focus-visible:outline-none space-y-4">
                {isLoading ? (
                   <SkeletonList />
                ) : inProgressJobs.length > 0 ? (
                  inProgressJobs.map(app => (
                    <MyJobCard key={app.id} application={app as any} />
                  ))
                ) : (
                  <div className="px-4 sm:px-0">
                    <div className="bg-gray-50/50 rounded-none sm:rounded-[2rem] p-16 text-center border-0 sm:border-2 border-dashed border-gray-200">
                      <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Briefcase className="h-10 w-10 text-gray-300" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">Nothing in progress</h3>
                      <p className="text-gray-500 max-w-xs mx-auto">
                        Applications you are shortlisted or interviewing for will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="applied" className="focus-visible:outline-none space-y-4">
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
                  <div className="px-4 sm:px-0">
                    <div className="bg-gray-50/50 rounded-none sm:rounded-[2rem] p-16 text-center border-0 sm:border-2 border-dashed border-gray-200">
                      <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Briefcase className="h-10 w-10 text-gray-300" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No applications yet</h3>
                      <p className="text-gray-500 max-w-xs mx-auto">
                        Start applying to jobs to track your professional growth.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="archived" className="focus-visible:outline-none space-y-4">
                {isLoading ? (
                   <SkeletonList />
                ) : archivedJobs.length > 0 ? (
                  archivedJobs.map(app => (
                    <MyJobCard key={app.id} application={app as any} />
                  ))
                ) : (
                  <div className="px-4 sm:px-0">
                    <div className="bg-gray-50/50 rounded-none sm:rounded-[2rem] p-16 text-center border-0 sm:border-2 border-dashed border-gray-200">
                      <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                        <Briefcase className="h-10 w-10 text-gray-300" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No archived jobs</h3>
                      <p className="text-gray-500 max-w-xs mx-auto">
                        Rejected or withdrawn applications will be archived here.
                      </p>
                    </div>
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
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
