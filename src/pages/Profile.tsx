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
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ user_id: user.id })
            .select('id')
            .single();

          if (newProfile?.id) {
            setProfileId(newProfile.id);
            await refreshProfile();
          } else if (createError) {
            if ((createError as any).code === '23505') {
              const { data: existing, error: fetchErr } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .single();
              if (existing?.id) {
                setProfileId(existing.id);
                await refreshProfile();
              } else if (fetchErr) {
                console.error('Profile fetch after duplicate failed:', fetchErr);
              }
            } else {
              console.error('Error creating profile:', createError);
              toast({
                title: "Profile Error",
                description: "Could not initialize profile. Please refresh.",
                variant: "destructive",
              });
            }
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
      <div className="w-full bg-white pb-20 min-h-screen">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="w-full py-12 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  My Profile
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Manage your professional identity and showcase your career achievements.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full">
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
      </div>
    </Layout>
  );
};

export default Profile;
