import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabs from '@/components/profile/ProfileTabs';
import { useAuth } from '@/contexts/AuthContext';

const Profile = () => {
  const { user, profile, loading: authLoading, refreshProfile, signOut } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [creatingProfile, setCreatingProfile] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const initProfile = async () => {
      if (authLoading) return;

      if (!user) {
        navigate('/');
        return;
      }

      if (profile) {
        setProfileId(profile.id);
        return;
      }

      // Only attempt creation if we have a user but no profile and aren't already creating
      if (!profile && !creatingProfile) {
        setCreatingProfile(true);
        try {
          // If profile doesn't exist, create it immediately to prevent blank screens
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ user_id: user.id })
            .select('id')
            .single();
            
          if (newProfile) {
            setProfileId(newProfile.id);
            await refreshProfile(); // Sync with context
          } else if (createError) {
            console.error('Error creating profile:', createError);
            toast({
              title: "Profile Error",
              description: "Could not initialize profile. Please refresh.",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error in profile initialization:', error);
        } finally {
          setCreatingProfile(false);
        }
      }
    };

    initProfile();
  }, [user, profile, authLoading, navigate, toast, creatingProfile, refreshProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (authLoading || (user && !profileId && creatingProfile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Fallback if user is missing (should be handled by navigate)
  if (!user) {
    return null; 
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-4xl pb-20">
        <ProfileHeader userId={user.id} />
        {/* Only render tabs if we have a profile ID, otherwise show a loader or empty state */}
        {profileId ? (
          <ProfileTabs userId={user.id} profileId={profileId} isOwnProfile={true} />
        ) : (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Initializing profile...</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Profile;