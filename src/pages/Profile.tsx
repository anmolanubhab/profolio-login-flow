import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import ProfileHeader from '@/components/profile/ProfileHeader';
import ProfileTabs from '@/components/profile/ProfileTabs';

const Profile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          navigate('/');
          return;
        }
        setUser(user);
        
        // Fetch profile ID - try to get existing or create if missing
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (profile) {
          setProfileId(profile.id);
        } else {
          // If profile doesn't exist, create it immediately to prevent blank screens
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({ user_id: user.id })
            .select('id')
            .single();
            
          if (newProfile) {
            setProfileId(newProfile.id);
          } else if (createError) {
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
        setLoading(false);
      }
    };

    getUser();
  }, [navigate, toast]);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      navigate('/');
    }
  };

  if (loading) {
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