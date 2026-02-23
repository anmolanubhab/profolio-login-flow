
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { useJobApplicants, Applicant } from '@/hooks/useJobApplicants';
import { ApplicantList } from '@/components/jobs/ApplicantList';
import { ApplicantDetailDrawer } from '@/components/jobs/ApplicantDetailDrawer';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Users } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const JobApplicantsPage = () => {
  const { user, signOut } = useAuth();
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { applicants, isLoading, updateStatus } = useJobApplicants(jobId || '');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Fetch job details for header
  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async ({ signal }) => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .abortSignal(signal)
        .maybeSingle();
      if (error) {
        if (error.code === 'ABORTED') return null;
        throw error;
      }
      return data;
    },
    enabled: !!jobId
  });

  const handleViewDetails = (applicant: Applicant) => {
    // If status is 'applied', mark as 'viewed' automatically
    if (applicant.status === 'applied') {
      updateStatus({ applicationId: applicant.id, status: 'viewed' });
    }
    setSelectedApplicant(applicant);
    setIsDrawerOpen(true);
  };

  const handleUpdateStatus = (id: string, status: Applicant['status']) => {
    updateStatus({ applicationId: id, status });
    // Update local state if selected
    if (selectedApplicant?.id === id) {
      setSelectedApplicant(prev => prev ? { ...prev, status } : null);
    }
  };

  if (isLoading) {
    return (
      <Layout user={user} onSignOut={handleSignOut}>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading applicants...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div 
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        {/* Gradient Hero Section */}
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-12 px-8 overflow-hidden">
          <div className="container max-w-4xl mx-auto relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(-1)}
                  className="rounded-full hover:bg-white/50 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                    Applicants
                    {job?.title && <span className="text-[#833AB4] font-normal block md:inline md:ml-3">for {job.title}</span>}
                  </h1>
                  <p className="text-gray-600 mt-2 flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#0077B5]" />
                    Manage candidates who applied to this position.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="container max-w-4xl mx-auto py-12 px-4">
        {!applicants || applicants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center bg-white border border-gray-100 rounded-[2rem] shadow-xl shadow-gray-200/50">
            <div className="bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 p-6 rounded-[2rem] mb-6">
              <Users className="h-12 w-12 text-[#833AB4]" />
            </div>
            <h3 className="font-bold text-2xl text-gray-900">No applicants yet</h3>
            <p className="text-gray-500 max-w-sm mt-3 text-lg leading-relaxed">
              Once candidates apply to this job, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6">
            <ApplicantList 
              applicants={applicants}
              onViewDetails={handleViewDetails}
              onUpdateStatus={handleUpdateStatus}
            />
          </div>
        )}

        <ApplicantDetailDrawer 
          applicant={selectedApplicant}
          open={isDrawerOpen}
          onOpenChange={setIsDrawerOpen}
          onUpdateStatus={handleUpdateStatus}
        />
      </div>
      </div>
    </Layout>
  );
};

export default JobApplicantsPage;
