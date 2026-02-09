
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
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

  const { toast } = useToast();

  const handleBack = () => {
    navigate(-1);
  };

  const handleNotImplemented = (feature: string) => {
    toast({
      title: "Coming Soon",
      description: `${feature} will be available soon.`,
    });
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
      <div className="bg-background min-h-screen">
        {/* Header */}
        <div className="flex items-center gap-4 px-4 py-4 border-b border-border">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-6 w-6 text-foreground" />
          </button>
          <h1 className="text-2xl font-semibold text-foreground">
            Job preferences
          </h1>
          <div className="flex-1" />
          <button
            className="p-2 -mr-2 hover:bg-muted/50 rounded-full transition-colors"
            aria-label="Help"
            onClick={() => handleNotImplemented("Help Center")}
          >
            <HelpCircle className="h-6 w-6 text-foreground fill-foreground" />
          </button>
        </div>
        
        <div className="p-4">
          <JobPreferencesForm />
        </div>
      </div>
    </Layout>
  );
};

export default JobPreferences;
