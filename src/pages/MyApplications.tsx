import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { UserApplicationsCard } from '@/components/jobs/UserApplicationsCard';
import { Briefcase, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const MyApplications = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/dashboard" className="hover:text-primary transition-colors">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground font-medium">My Applications</span>
          </nav>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Applications</h1>
              <p className="text-muted-foreground">Track the status of jobs you've applied to</p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <UserApplicationsCard />
      </div>
    </Layout>
  );
};

export default MyApplications;
