import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';

const UnifiedDashboard = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      {/* Desktop Alignment Wrapper: Matches NavBar centering logic */}
      <div className="w-full flex justify-center lg:px-6">
        <div className="w-full max-w-2xl space-y-4 sm:space-y-6">
          
          <CompanyInvitationsCard />

          <Stories />

          <Feed />

        </div>
      </div>
    </Layout>
  );
};

export default UnifiedDashboard;
