
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
      <div className="bg-white min-h-screen">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-12 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Job Preferences
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Tell us what you're looking for to get better job recommendations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-8 px-0 sm:px-4">
          <JobPreferencesForm />
        </div>
      </div>
    </Layout>
  );
};

export default JobPreferences;
