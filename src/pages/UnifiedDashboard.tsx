import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/Layout';
import Feed from '@/components/Feed';
import Stories from '@/components/Stories';
import PostInput from '@/components/PostInput';
import { CompanyInvitationsCard } from '@/components/company/CompanyInvitationsCard';
import { ProfileCompletionCard } from '@/components/profile/ProfileCompletionCard';

const UnifiedDashboard = () => {
  const {
    user,
    signOut
  } = useAuth();
  const [feedRefresh, setFeedRefresh] = useState(0);
  if (!user) return null;
  return <Layout user={user} onSignOut={signOut}>
      <div className="w-full flex flex-col gap-0 px-0">
        <div className="w-full lg:max-w-4xl mx-0 lg:mx-auto bg-primary-foreground px-4 sm:px-6 lg:px-0">
          <div className="space-y-0 sm:space-y-4 lg:space-y-6">
            <ProfileCompletionCard />
            <CompanyInvitationsCard />
            <Stories />
            <div className="hidden lg:block">
              <PostInput
                user={{ email: user.email ?? undefined }}
                onPostCreated={() => setFeedRefresh((prev) => prev + 1)}
              />
            </div>
            <Feed refresh={feedRefresh} />
          </div>
        </div>
      </div>
    </Layout>;
};
export default UnifiedDashboard;
