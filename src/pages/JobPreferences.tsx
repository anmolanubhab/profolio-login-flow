
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { JobPreferencesForm } from '@/components/jobs/JobPreferencesForm';
import { Loader2 } from 'lucide-react';

const JobPreferences = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-3xl py-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Job Preferences</h1>
        </div>
        
        <JobPreferencesForm />
      </div>
    </Layout>
  );
};

export default JobPreferences;
