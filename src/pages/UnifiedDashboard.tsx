import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import { CreateCompanyPostButton } from '@/components/company/CreateCompanyPostButton';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';

const UnifiedDashboard = () => {
  const { user, signOut } = useAuth();

  if (!user) return null;

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="max-w-2xl mx-auto space-y-4 sm:space-y-6">
        {/* Pending Company Invitations - Only shows if there are pending invitations */}
        <CompanyInvitationsCard />
        
        {/* Stories Row */}
        <Stories />
        
        {/* Company Post Button - Only shows if user manages companies */}
        <CreateCompanyPostButton />
        
        {/* Main Feed */}
        <Feed />
      </div>
    </Layout>
  );
};

export default UnifiedDashboard;
