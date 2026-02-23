
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
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
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(circle at top left, #c7d2fe, #e9d5ff, #bfdbfe)" }}
      >
        {/* Hero */}
        <div className="relative w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-500 rounded-b-3xl py-16 px-8 backdrop-blur-xl bg-white/10 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <Button
                  variant="ghost"
                  className="bg-white rounded-full shadow-md hover:bg-indigo-50 hover:scale-105 transition h-9 px-4"
                  onClick={() => navigate('/settings')}
                >
                  <ArrowLeft className="h-4 w-4 mr-2 text-indigo-600" />
                  Back
                </Button>
                <h1 className="text-white text-3xl md:text-5xl font-extrabold tracking-tight mt-4">
                  Job Preferences
                </h1>
                <p className="text-white/80 text-base md:text-xl mt-2">
                  Tell us what you're looking for to get better job recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto py-8 px-6">
          <JobPreferencesForm />
        </div>
      </div>
    </Layout>
  );
};

export default JobPreferences;
