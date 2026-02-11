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
        <div className="flex flex-col items-center justify-center min-h-screen">
          <Loader2 className="h-12 w-12 animate-spin text-[#833AB4] mb-4" />
          <p className="text-gray-500 font-medium">Updating your notifications...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-12 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Notifications
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Stay updated with your network and career opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-3xl mx-auto py-12 px-6">
          <div className="space-y-10">
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <UserPlus className="h-5 w-5 text-[#833AB4]" />
                  <h2 className="text-xl font-bold text-gray-900">Connection Requests</h2>
                </div>
                <div className="grid gap-4">
                  {friendRequests.map((request) => (
                    <Card key={request.id} className="rounded-[2rem] border-gray-100 bg-gradient-to-br from-[#0077B5]/5 to-[#E1306C]/5 overflow-hidden border-2 border-[#833AB4]/10 shadow-lg shadow-[#833AB4]/5">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14 rounded-2xl ring-4 ring-white">
                            <AvatarImage src={request.sender_profile.avatar_url} />
                            <AvatarFallback className="bg-gradient-to-br from-[#0077B5] to-[#E1306C] text-white font-bold text-lg">
                              {request.sender_profile.display_name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900">
                              {request.sender_profile.display_name}
                            </h3>
                            <p className="text-sm text-gray-600">
                              wants to connect with you
                            </p>
                            <p className="text-xs text-gray-400 mt-1 font-medium uppercase tracking-wider">
                              {formatTime(request.created_at)}
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <Button
                              size="sm"
                              onClick={() => handleAcceptRequest(request.id)}
                              disabled={processing === request.id}
                              className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-6 shadow-md shadow-[#833AB4]/20 h-10"
                            >
                              {processing === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-5 w-5" />}
                            </Button>
                            <div className="relative p-[1px] rounded-full overflow-hidden">
                              <div className="absolute inset-0 bg-gray-200" />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={processing === request.id}
                                className="relative bg-white hover:bg-gray-50 border-none rounded-full px-6 h-10 transition-all"
                              >
                                <X className="h-5 w-5 text-gray-500" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Other Notifications */}
            {notifications.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-2">
                  <Bell className="h-5 w-5 text-[#833AB4]" />
                  <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                </div>
                <div className="grid gap-4">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type);
                    return (
                      <Card 
                        key={notification.id} 
                        className={`cursor-pointer hover:shadow-xl transition-all duration-300 rounded-[2rem] border-gray-100 overflow-hidden group ${!notification.is_read ? 'bg-gradient-to-r from-[#0077B5]/5 to-transparent border-l-4 border-l-[#833AB4]' : 'bg-white'}`}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-center gap-4">
                            <Avatar className="h-12 w-12 rounded-xl ring-2 ring-gray-50 group-hover:scale-110 transition-transform">
                              <AvatarImage src={notification.payload?.sender_avatar} />
                              <AvatarFallback className="bg-gray-100 text-gray-400">
                                <Icon className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className={`text-base ${!notification.is_read ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                {getNotificationMessage(notification)}
                              </p>
                              <p className="text-xs text-gray-400 mt-1 font-medium">
                                {formatTime(notification.created_at)}
                              </p>
                            </div>
                            {!notification.is_read && (
                              <div className="w-3 h-3 bg-gradient-to-r from-[#0077B5] to-[#E1306C] rounded-full shadow-lg shadow-[#833AB4]/30" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {friendRequests.length === 0 && notifications.length === 0 && (
              <div className="bg-gray-50/50 rounded-[2rem] p-16 text-center border-2 border-dashed border-gray-200">
                <div className="bg-white h-24 w-24 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-sm">
                  <Bell className="h-12 w-12 text-gray-300" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">All caught up!</h3>
                <p className="text-gray-500 max-w-xs mx-auto text-lg">
                  You have no new notifications at the moment.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Notifications;
