import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';
import { ProfileCompletionCard } from '@/components/profile/ProfileCompletionCard';

const UnifiedDashboard = () => {
  const {
    user,
    signOut
  } = useAuth();
  if (!user) return null;
  return <Layout user={user} onSignOut={signOut}>
      {/* Desktop Alignment Wrapper: Matches NavBar centering logic */}
      <div className="w-full items-center justify-start flex flex-col gap-0 px-0">
        <div className="w-full max-w-full sm:max-w-2xl space-y-0 sm:space-y-6 mx-0 bg-primary-foreground pl-0">
          
          <ProfileCompletionCard />
          
          <CompanyInvitationsCard />

          <Stories />

          <Feed />

        </div>
      </div>
    </Layout>;
};
export default UnifiedDashboard;