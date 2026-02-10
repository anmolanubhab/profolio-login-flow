import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, MessageCircle, UserPlus, Award, Check, X, ThumbsUp, MessageSquare, Share2, Eye, Briefcase, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { Layout } from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';

interface FriendRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender_profile: {
    display_name: string;
    avatar_url: string;
  };
}

interface Notification {
  id: string;
  type: string;
  payload: any;
  is_read: boolean;
  created_at: string;
}

const Notifications = () => {
  const { user, signOut } = useAuth();
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchFriendRequests();
      fetchNotifications();

      // Set up real-time subscription for notifications
      const channel = supabase
        .channel('notifications-page')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'notifications'
          },
          () => {
            fetchNotifications();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriendRequests = async () => {
    try {
      // Get current user's profile first
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!myProfile) return;

      const { data, error } = await supabase
        .from('friend_requests')
        .select(`
          id,
          sender_id,
          receiver_id,
          status,
          created_at
        `)
        .eq('receiver_id', myProfile.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch sender profiles
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', request.sender_id)
            .single();

          return {
            ...request,
            sender_profile: profile || { display_name: 'Unknown User', avatar_url: '' }
          };
        })
      );

      setFriendRequests(requestsWithProfiles);
    } catch (error: any) {
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!myProfile) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', myProfile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Supabase notifications error:', error);
        throw error;
      }
      setNotifications(data || []);
    } catch (error: any) {
      console.error('Error fetching notifications:', error);
      // Don't show toast for now to avoid spamming the user if it's a persistent error
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Friend request accepted!",
      });

      fetchFriendRequests();
      fetchNotifications();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    setProcessing(requestId);
    try {
      const { error } = await supabase
        .from('friend_requests')
        .update({ status: 'rejected' })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Friend request rejected",
      });

      fetchFriendRequests();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(null);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return ThumbsUp;
      case 'comment':
        return MessageSquare;
      case 'share':
        return Share2;
      case 'connection_request':
      case 'connection_accepted':
        return UserPlus;
      case 'profile_view':
      case 'profile_save':
        return Eye;
      case 'new_job':
      case 'application_submitted':
      case 'new_application':
        return Briefcase;
      case 'application_shortlisted':
      case 'application_offered':
        return Star;
      case 'application_rejected':
      case 'application_interview':
      case 'interview_scheduled':
      case 'interview_completed':
      case 'interview_selected':
      case 'interview_rejected':
        return Briefcase;
      case 'message':
        return MessageCircle;
      case 'certificate':
        return Award;
      case 'skill_endorsement':
        return Star;
      case 'new_follower':
        return UserPlus;
      default:
        return Bell;
    }
  };

  const getNotificationMessage = (notification: Notification) => {
    const { type, payload } = notification;
    const senderName = payload?.sender_name || payload?.follower_name || 'Someone';
    const jobTitle = payload?.job_title || 'a position';

    switch (type) {
      case 'like':
        return `${senderName} liked your post`;
      case 'comment':
        return `${senderName} commented on your post`;
      case 'share':
        return `${senderName} shared your post`;
      case 'connection_request':
        return `${senderName} wants to connect with you`;
      case 'connection_accepted':
        return `${senderName} accepted your connection request`;
      case 'profile_view':
        return `${senderName} viewed your profile`;
      case 'profile_save':
        return `${senderName} saved your profile`;
      case 'new_follower':
        return `${senderName} started following you`;
      case 'new_job':
        return `New job opportunity: ${jobTitle}`;
      case 'application_submitted':
        return `Your application for ${jobTitle} was submitted`;
      case 'new_application':
        return `New application received for ${jobTitle}`;
      case 'application_shortlisted':
        return `Great news! You've been shortlisted for ${jobTitle}`;
      case 'application_rejected':
        return `Update on your application for ${jobTitle}`;
      case 'application_offered':
        return `Congratulations! You received an offer for ${jobTitle}`;
      case 'application_interview':
        return `Interview scheduled for ${jobTitle}`;
      case 'interview_scheduled':
        return `Interview scheduled for ${jobTitle}`;
      case 'interview_completed':
        return `Interview completed for ${jobTitle}`;
      case 'interview_selected':
        return `You were selected for ${jobTitle}`;
      case 'interview_rejected':
        return `You were not selected for ${jobTitle}`;
      case 'message':
        return `${senderName}: ${payload?.message || 'sent you a message'}`;
      case 'skill_endorsement':
        return `${senderName} endorsed your ${payload?.skill_name || 'skill'}`;
      default:
        return payload?.message || 'You have a new notification';
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notification.id);
    }

    // Navigate based on type
    const { type, payload } = notification;
    switch (type) {
      case 'like':
      case 'comment':
      case 'share':
        navigate(`/dashboard?post=${payload?.post_id}`);
        break;
      case 'connection_request':
      case 'connection_accepted':
        navigate('/network');
        break;
      case 'profile_view':
      case 'profile_save':
      case 'skill_endorsement':
        navigate('/profile');
        break;
      case 'new_job':
      case 'application_submitted':
      case 'new_application':
      case 'application_shortlisted':
      case 'application_rejected':
      case 'application_offered':
      case 'application_interview':
      case 'interview_scheduled':
      case 'interview_completed':
      case 'interview_selected':
      case 'interview_rejected':
        navigate('/jobs');
        break;
      case 'message':
        navigate('/connect');
        break;
      default:
        break;
    }
  };

  const formatTime = (dateString: string) => {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  if (loading) {
    return (
      <Layout user={user} onSignOut={signOut}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="space-y-4">
        {/* Main Title */}
        <h1 className="text-2xl font-bold text-foreground px-1">Notifications</h1>

        {/* Friend Requests Section */}
          {friendRequests.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2">Friend Requests</h2>
              {friendRequests.map((request) => (
                <Card key={request.id} className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={request.sender_profile.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {request.sender_profile.display_name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">
                          {request.sender_profile.display_name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Sent you a friend request
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(request.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          disabled={processing === request.id}
                          className="bg-success hover:bg-success/90"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id)}
                          disabled={processing === request.id}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}

          {/* Other Notifications */}
          {notifications.length > 0 && (
            <>
              <h2 className="text-lg font-semibold text-foreground mb-2 mt-6">All Notifications</h2>
              {notifications.map((notification) => {
                const Icon = getNotificationIcon(notification.type);
                return (
                  <Card 
                    key={notification.id} 
                    className={`cursor-pointer hover:shadow-md transition-shadow ${!notification.is_read ? 'bg-primary/5' : ''}`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={notification.payload?.sender_avatar} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            <Icon className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="text-sm">
                            {getNotificationMessage(notification)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatTime(notification.created_at)}
                          </p>
                        </div>
                        {!notification.is_read && (
                          <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}

          {friendRequests.length === 0 && notifications.length === 0 && (
            <Card className="p-12 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No notifications yet</p>
            </Card>
          )}
        </div>
    </Layout>
  );
};

export default Notifications;
