import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Eye, UserCheck, UserMinus, Clock, X } from 'lucide-react';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  profession?: string;
  location?: string;
  avatar_url?: string;
  profile_visibility?: string;
}

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'accepted';

const Network = () => {
  const [user, setUser] = useState<User | null>(null);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [requestIds, setRequestIds] = useState<Record<string, string>>({});
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
    };

    getUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchMyProfileId();
      fetchProfiles();
    }
  }, [user]);

  const fetchMyProfileId = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (data) setMyProfileId(data.id);
  };

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProfiles(profiles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = profiles.filter(profile => 
        profile.display_name?.toLowerCase().includes(query) ||
        profile.profession?.toLowerCase().includes(query) ||
        profile.location?.toLowerCase().includes(query)
      );
      setFilteredProfiles(filtered);
    }
  }, [searchQuery, profiles]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out private profiles unless connected
      const visibleProfiles = data?.filter(profile => 
        profile.profile_visibility === 'public' || 
        profile.profile_visibility === 'connections_only'
      ) || [];

      setProfiles(visibleProfiles);
      setFilteredProfiles(visibleProfiles);
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

  useEffect(() => {
    if (myProfileId && profiles.length > 0) {
      fetchStatuses();
    }
  }, [myProfileId, profiles]);

  const fetchStatuses = async () => {
    if (!myProfileId) return;
    const profileIds = profiles.map((p) => p.id);
    if (profileIds.length === 0) return;

    try {
      const statuses: Record<string, ConnectionStatus> = {};
      const reqIds: Record<string, string> = {};

      // Accepted/blocked connections in either direction
      const { data: connections } = await supabase
        .from('connections')
        .select('user_id, connection_id, status')
        .or(`user_id.eq.${myProfileId},connection_id.eq.${myProfileId}`);

      (connections || []).forEach((c) => {
        if (c.status !== 'accepted') return;
        const otherId = c.user_id === myProfileId ? c.connection_id : c.user_id;
        if (profileIds.includes(otherId)) {
          statuses[otherId] = 'accepted';
        }
      });

      // Sent friend requests
      const { data: sentRequests } = await supabase
        .from('friend_requests')
        .select('id, receiver_id, status')
        .eq('sender_id', myProfileId)
        .in('receiver_id', profileIds);

      (sentRequests || []).forEach((r) => {
        if (statuses[r.receiver_id]) return;
        reqIds[r.receiver_id] = r.id;
        if (r.status === 'pending') statuses[r.receiver_id] = 'pending_sent';
      });

      // Received friend requests
      const { data: receivedRequests } = await supabase
        .from('friend_requests')
        .select('id, sender_id, status')
        .eq('receiver_id', myProfileId)
        .in('sender_id', profileIds);

      (receivedRequests || []).forEach((r) => {
        if (statuses[r.sender_id]) return;
        reqIds[r.sender_id] = r.id;
        if (r.status === 'pending') statuses[r.sender_id] = 'pending_received';
      });

      setConnectionStatuses(statuses);
      setRequestIds(reqIds);

      // Following status
      const { data: followData } = await supabase
        .from('followers')
        .select('following_id')
        .eq('follower_id', myProfileId)
        .in('following_id', profileIds);

      setFollowingSet(new Set((followData || []).map((f) => f.following_id)));
    } catch (error) {
      console.error('Error fetching connection/follow statuses:', error);
    }
  };

  const setLoadingFor = (profileId: string, isLoading: boolean) => {
    setActionLoading((prev) => ({ ...prev, [profileId]: isLoading }));
  };

  const handleSendRequest = async (targetProfile: Profile) => {
    if (!myProfileId || !user) return;
    if (rateLimiter.isRateLimited(`friend_request_${user.id}`, RATE_LIMITS.MESSAGE_SEND)) {
      const timeRemaining = Math.ceil(rateLimiter.getTimeUntilReset(`friend_request_${user.id}`) / 1000);
      toast({
        title: "Too many requests",
        description: `Please wait ${timeRemaining} seconds before sending another request.`,
        variant: "destructive",
      });
      return;
    }

    setLoadingFor(targetProfile.id, true);
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('user_id', user.id)
        .single();

      if (!myProfile) throw new Error('Profile not found');

      const { data: newRequest, error } = await supabase
        .from('friend_requests')
        .insert({
          sender_id: myProfile.id,
          receiver_id: targetProfile.id,
          status: 'pending'
        })
        .select('id')
        .single();

      if (error) throw error;

      await supabase
        .from('notifications')
        .insert({
          user_id: targetProfile.id,
          type: 'friend_request',
          payload: {
            sender_name: myProfile.display_name || user.email,
            sender_id: myProfile.id
          }
        });

      setRequestIds((prev) => ({ ...prev, [targetProfile.id]: newRequest.id }));
      setConnectionStatuses((prev) => ({ ...prev, [targetProfile.id]: 'pending_sent' }));
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
    } finally {
      setLoadingFor(targetProfile.id, false);
    }
  };

  const handleCancelRequest = async (targetProfile: Profile) => {
    const requestId = requestIds[targetProfile.id];
    if (!requestId) return;

    setLoadingFor(targetProfile.id, true);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      setRequestIds((prev) => {
        const next = { ...prev };
        delete next[targetProfile.id];
        return next;
      });
      setConnectionStatuses((prev) => ({ ...prev, [targetProfile.id]: 'none' }));
      toast({
        title: "Request cancelled",
        description: "Your connection request has been cancelled.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingFor(targetProfile.id, false);
    }
  };

  const handleAcceptRequest = async (targetProfile: Profile) => {
    const requestId = requestIds[targetProfile.id];
    if (!requestId || !myProfileId) return;

    setLoadingFor(targetProfile.id, true);
    try {
      const { error: updateError } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      const { error: connectionError } = await supabase
        .from('connections')
        .insert({
          user_id: myProfileId,
          connection_id: targetProfile.id,
          status: 'accepted'
        });

      if (connectionError) throw connectionError;

      setConnectionStatuses((prev) => ({ ...prev, [targetProfile.id]: 'accepted' }));
      toast({
        title: "Request accepted",
        description: "You are now connected!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingFor(targetProfile.id, false);
    }
  };

  const handleFollow = async (targetProfile: Profile) => {
    if (!myProfileId) return;
    const isFollowing = followingSet.has(targetProfile.id);

    setLoadingFor(`follow_${targetProfile.id}`, true);
    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', myProfileId)
          .eq('following_id', targetProfile.id);

        if (error) throw error;
        setFollowingSet((prev) => {
          const next = new Set(prev);
          next.delete(targetProfile.id);
          return next;
        });
        toast({
          title: "Unfollowed",
          description: "You are no longer following this user.",
        });
      } else {
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: myProfileId,
            following_id: targetProfile.id
          });

        if (error) throw error;

        await supabase
          .from('notifications')
          .insert({
            user_id: targetProfile.id,
            type: 'new_follower',
            payload: {
              follower_name: targetProfile.display_name || user?.email,
              follower_id: myProfileId
            }
          });

        setFollowingSet((prev) => new Set(prev).add(targetProfile.id));
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
    } finally {
      setLoadingFor(`follow_${targetProfile.id}`, false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <Layout user={user!} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Discover People</h1>
          <p className="text-muted-foreground">Connect with professionals and expand your network</p>
        </div>

        <Card className="mb-6 bg-gradient-card shadow-card border-0">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, profession, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-muted focus:border-primary/50"
              />
            </div>
          </CardHeader>
        </Card>

        {filteredProfiles.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <p className="text-muted-foreground">
              {searchQuery ? 'No profiles found matching your search.' : 'No profiles available yet.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-elegant">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                        {profile.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-2 w-full">
                      <h3 className="font-semibold text-lg text-foreground">
                        {profile.display_name || 'User'}
                      </h3>
                      {profile.profession && (
                        <p className="text-sm text-primary font-medium">
                          {profile.profession}
                        </p>
                      )}
                      {profile.location && (
                        <p className="text-sm text-muted-foreground">
                          {profile.location}
                        </p>
                      )}
                      {profile.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                          {profile.bio}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 w-full pt-2">
                      <div className="flex gap-2 w-full">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewProfile(profile.id)}
                          className="flex-1"
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Profile
                        </Button>
                        <Button
                          variant={followingSet.has(profile.id) ? "outline" : "secondary"}
                          size="sm"
                          onClick={() => handleFollow(profile)}
                          disabled={actionLoading[`follow_${profile.id}`]}
                          className="flex-1"
                        >
                          {followingSet.has(profile.id) ? (
                            <>
                              <UserMinus className="h-4 w-4 mr-2" />
                              Following
                            </>
                          ) : (
                            <>
                              <Eye className="h-4 w-4 mr-2" />
                              Follow
                            </>
                          )}
                        </Button>
                      </div>

                      {(!connectionStatuses[profile.id] || connectionStatuses[profile.id] === 'none') && (
                        <Button
                          size="sm"
                          onClick={() => handleSendRequest(profile)}
                          disabled={actionLoading[profile.id]}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          <UserPlus className="h-4 w-4 mr-2" />
                          {actionLoading[profile.id] ? 'Sending...' : 'Connect'}
                        </Button>
                      )}
                      {connectionStatuses[profile.id] === 'pending_sent' && (
                        <div className="flex gap-2 w-full">
                          <Button size="sm" variant="outline" disabled className="flex-1">
                            <Clock className="h-4 w-4 mr-2" />
                            Request Sent
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCancelRequest(profile)}
                            disabled={actionLoading[profile.id]}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      {connectionStatuses[profile.id] === 'pending_received' && (
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(profile)}
                          disabled={actionLoading[profile.id]}
                          className="w-full bg-primary hover:bg-primary/90"
                        >
                          <UserCheck className="h-4 w-4 mr-2" />
                          {actionLoading[profile.id] ? 'Accepting...' : 'Accept Request'}
                        </Button>
                      )}
                      {connectionStatuses[profile.id] === 'accepted' && (
                        <Button size="sm" variant="outline" disabled className="w-full">
                          <UserCheck className="h-4 w-4 mr-2" />
                          Connected
                        </Button>
                      )}
                    </div>

                    {profile.profile_visibility && (
                      <Badge variant="secondary" className="text-xs">
                        {profile.profile_visibility === 'public' ? 'Public' : 'Connections Only'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Network;