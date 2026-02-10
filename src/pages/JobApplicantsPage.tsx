
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
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { applicants, isLoading, updateStatus } = useJobApplicants(jobId || '');
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch job details for header
  const { data: job } = useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await supabase
        .from('jobs')
        .select('title')
        .eq('id', jobId)
        .single();
      if (error) throw error;
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
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading applicants...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto py-6 px-4 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Applicants
            {job?.title && <span className="text-muted-foreground font-normal ml-2">for {job.title}</span>}
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage candidates who applied to this position.
          </p>
        </div>
      </div>

      {!applicants || applicants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10">
          <div className="bg-muted p-4 rounded-full mb-4">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-lg">No applicants yet</h3>
          <p className="text-muted-foreground max-w-sm mt-2">
            Once candidates apply to this job, they will appear here.
          </p>
        </div>
      ) : (
        <ApplicantList 
          applicants={applicants}
          onViewDetails={handleViewDetails}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      <ApplicantDetailDrawer 
        applicant={selectedApplicant}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onUpdateStatus={handleUpdateStatus}
      />
    </div>
    </Layout>
  );
};

export default JobApplicantsPage;
