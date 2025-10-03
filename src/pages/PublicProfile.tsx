import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User as UserType } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, Phone, Globe, Briefcase, UserPlus, UserCheck, 
  UserMinus, Eye, ArrowLeft, Lock 
} from 'lucide-react';
import ProfileTabs from '@/components/profile/ProfileTabs';

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  profession?: string;
  location?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  profile_visibility?: string;
}

const PublicProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [currentUser, setCurrentUser] = useState<UserType | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted' | 'blocked'>('none');
  const [isFollowing, setIsFollowing] = useState(false);
  const [viewRecorded, setViewRecorded] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setCurrentUser(user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (currentUser && userId) {
      fetchProfile();
      checkConnectionStatus();
      checkFollowStatus();
    }
  }, [currentUser, userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Profile not found",
          description: "This user's profile does not exist.",
          variant: "destructive",
        });
        navigate('/dashboard');
        return;
      }

      // Check if profile is accessible
      if (data.profile_visibility === 'private' && data.user_id !== currentUser?.id) {
        setProfile({ ...data, bio: undefined, phone: undefined, website: undefined });
      } else {
        setProfile(data);
      }

      // Record profile view
      if (!viewRecorded && currentUser && data.user_id !== currentUser.id) {
        recordProfileView(data.id);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const recordProfileView = async (profileId: string) => {
    try {
      const { data: viewerProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser?.id)
        .single();

      if (viewerProfile) {
        // Try to insert view, ignore if already exists
        await supabase
          .from('profile_views')
          .upsert({
            viewer_id: viewerProfile.id,
            viewed_profile_id: profileId,
            viewed_at: new Date().toISOString()
          }, { 
            onConflict: 'viewer_id,viewed_profile_id' 
          });
        
        setViewRecorded(true);

        // Create notification for profile owner
        await supabase
          .from('notifications')
          .insert({
            user_id: profileId,
            type: 'profile_view',
            payload: {
              viewer_name: currentUser?.email,
              viewer_id: viewerProfile.id
            }
          });
      }
    } catch (error) {
      console.error('Error recording profile view:', error);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser?.id)
        .single();

      const { data: theirProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!myProfile || !theirProfile) return;

      // Check for existing connection
      const { data: connection } = await supabase
        .from('connections')
        .select('*')
        .or(`and(user_id.eq.${myProfile.id},connection_id.eq.${theirProfile.id}),and(user_id.eq.${theirProfile.id},connection_id.eq.${myProfile.id})`)
        .maybeSingle();

      if (connection) {
        setConnectionStatus(connection.status);
      }

      // Check for pending friend request
      const { data: request } = await supabase
        .from('friend_requests')
        .select('*')
        .eq('sender_id', myProfile.id)
        .eq('receiver_id', theirProfile.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (request) {
        setConnectionStatus('pending');
      }
    } catch (error) {
      console.error('Error checking connection status:', error);
    }
  };

  const checkFollowStatus = async () => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser?.id)
        .single();

      const { data: theirProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!myProfile || !theirProfile) return;

      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', myProfile.id)
        .eq('following_id', theirProfile.id)
        .maybeSingle();

      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const handleSendRequest = async () => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser?.id)
        .single();

      const { data: theirProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!myProfile || !theirProfile) return;

      const { error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: myProfile.id,
          receiver_id: theirProfile.id,
          status: 'pending'
        });

      if (error) throw error;

      // Create notification
      await supabase
        .from('notifications')
        .insert({
          user_id: theirProfile.id,
          type: 'friend_request',
          payload: {
            sender_name: profile?.display_name || currentUser?.email,
            sender_id: myProfile.id
          }
        });

      setConnectionStatus('pending');
      toast({
        title: "Request sent",
        description: "Your connection request has been sent.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleFollow = async () => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser?.id)
        .single();

      const { data: theirProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!myProfile || !theirProfile) return;

      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', myProfile.id)
          .eq('following_id', theirProfile.id);

        if (error) throw error;
        setIsFollowing(false);
        toast({
          title: "Unfollowed",
          description: "You are no longer following this user.",
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: myProfile.id,
            following_id: theirProfile.id
          });

        if (error) throw error;

        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: theirProfile.id,
            type: 'new_follower',
            payload: {
              follower_name: profile?.display_name || currentUser?.email,
              follower_id: myProfile.id
            }
          });

        setIsFollowing(true);
        toast({
          title: "Following",
          description: "You are now following this user.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <Layout user={currentUser!} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  const isPrivate = profile?.profile_visibility === 'private' && profile?.user_id !== currentUser?.id;

  return (
    <Layout user={currentUser!} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-4xl">
        <Button
          variant="ghost"
          onClick={() => navigate('/dashboard')}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card className="mb-6 bg-gradient-card shadow-card border-0">
          <CardHeader className="pb-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-foreground">Profile</h2>
              <div className="flex gap-2">
                {connectionStatus === 'none' && (
                  <Button
                    size="sm"
                    onClick={handleSendRequest}
                    className="bg-primary hover:bg-primary/90"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Connect
                  </Button>
                )}
                {connectionStatus === 'pending' && (
                  <Button size="sm" variant="outline" disabled>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Request Sent
                  </Button>
                )}
                {connectionStatus === 'accepted' && (
                  <Button size="sm" variant="outline" disabled>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Connected
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={isFollowing ? "outline" : "default"}
                  onClick={handleFollow}
                >
                  {isFollowing ? (
                    <>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Unfollow
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Follow
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex flex-col items-center space-y-2">
                <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-background shadow-elegant">
                  <AvatarImage src={profile?.avatar_url} />
                  <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                    {profile?.display_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="flex-1 space-y-6">
                {isPrivate ? (
                  <div className="text-center py-8">
                    <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-foreground mb-2">Private Profile</h3>
                    <p className="text-muted-foreground">
                      This user's profile is private. Connect with them to view their full profile.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h1 className="text-3xl font-bold text-foreground">
                        {profile?.display_name || 'User'}
                      </h1>
                      {profile?.profession && (
                        <p className="text-lg text-primary font-semibold">
                          {profile.profession}
                        </p>
                      )}
                    </div>

                    {(profile?.location || profile?.phone || profile?.website) && (
                      <>
                        <Separator className="bg-muted/30" />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {profile?.location && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm">{profile.location}</span>
                            </div>
                          )}
                          {profile?.phone && (
                            <div className="flex items-center gap-3 text-muted-foreground">
                              <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-sm">{profile.phone}</span>
                            </div>
                          )}
                          {profile?.website && (
                            <div className="flex items-center gap-3 text-muted-foreground md:col-span-2">
                              <Globe className="h-4 w-4 text-primary flex-shrink-0" />
                              <a 
                                href={profile.website} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-sm text-primary hover:underline"
                              >
                                {profile.website}
                              </a>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {profile?.bio && (
                      <>
                        <Separator className="bg-muted/30" />
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">About</h4>
                          <p className="text-foreground leading-relaxed text-sm">
                            {profile.bio}
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {!isPrivate && profile && (
          <ProfileTabs userId={profile.user_id} />
        )}
      </div>
    </Layout>
  );
};

export default PublicProfile;