import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import { UserApplicationsCard } from '@/components/jobs/UserApplicationsCard';

const MyApplications = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header Section */}
        <div className="space-y-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Applications</h1>
            <p className="text-muted-foreground">Track the status of jobs you've applied to</p>
          </div>
        </div>

        {/* Main Content */}
        <UserApplicationsCard />
      </div>
    </Layout>
  );
};

export default MyApplications;
