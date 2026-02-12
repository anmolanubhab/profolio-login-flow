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
      const controller = new AbortController();
      fetchFriendRequests(controller.signal);
      fetchNotifications(controller.signal);

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
            fetchNotifications(controller.signal);
          }
        )
        .subscribe();

      return () => {
        controller.abort();
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriendRequests = async (signal?: AbortSignal) => {
    try {
      // Get current user's profile first
      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .abortSignal(signal)
        .maybeSingle();

      if (profileError) {
        if (profileError.code === 'ABORTED') return;
        throw profileError;
      }

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
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }

      // Fetch sender profiles
      const requestsWithProfiles = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('id', request.sender_id)
            .abortSignal(signal)
            .maybeSingle();

          return {
            ...request,
            sender_profile: profile || { display_name: 'Unknown User', avatar_url: '' }
          };
        })
      );

      setFriendRequests(requestsWithProfiles);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ABORTED') return;
      console.error('Error fetching friend requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async (signal?: AbortSignal) => {
    try {
      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .abortSignal(signal)
        .maybeSingle();

      if (profileError) {
        if (profileError.code === 'ABORTED') return;
        throw profileError;
      }

      if (!myProfile) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', myProfile.id)
        .order('created_at', { ascending: false })
        .limit(20)
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        console.error('Supabase notifications error:', error);
        throw error;
      }
      setNotifications(data || []);
    } catch (error: any) {
      if (error.name === 'AbortError' || error.code === 'ABORTED') return;
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
        <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full animate-pulse" />
            <div className="relative h-16 w-16 border-4 border-gray-100 border-t-[#833AB4] rounded-full animate-spin" />
          </div>
          <p className="text-[#5E6B7E] font-bold text-lg animate-pulse tracking-tight">Syncing your activity...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-[#0077B5]/10 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-[0.03] animate-gradient-shift" />
          <div className="max-w-5xl mx-auto py-20 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left animate-in fade-in slide-in-from-left-8 duration-700">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4] text-sm font-bold mb-6 border border-[#833AB4]/10">
                  <Bell className="h-4 w-4" />
                  <span>Real-time Updates</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tighter">
                  Activity Center
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Stay ahead with instant updates from your network and career opportunities.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-16 px-6">
          <div className="space-y-16">
            {/* Friend Requests Section */}
            {friendRequests.length > 0 && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-[#0077B5]/10 text-[#0077B5]">
                      <UserPlus className="h-6 w-6" />
                    </div>
                    <h2 className="text-2xl font-black text-[#1D2226] tracking-tight">Connection Requests</h2>
                  </div>
                  <span className="bg-[#0077B5]/10 text-[#0077B5] px-4 py-1.5 rounded-full text-xs font-bold border border-[#0077B5]/10">
                    {friendRequests.length} Pending
                  </span>
                </div>
                <div className="grid gap-6">
                  {friendRequests.map((request, index) => (
                    <Card 
                      key={request.id} 
                      className="group rounded-[2.5rem] border-gray-100 bg-white hover:shadow-2xl transition-all duration-500 overflow-hidden animate-in fade-in slide-in-from-bottom-4"
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <CardContent className="p-8">
                        <div className="flex flex-col sm:flex-row items-center gap-6">
                          <div className="relative">
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full group-hover:opacity-40 transition-opacity" />
                            <Avatar className="h-20 w-20 rounded-[2rem] ring-4 ring-white shadow-xl relative z-10">
                              <AvatarImage src={request.sender_profile.avatar_url} />
                              <AvatarFallback className="bg-gradient-to-br from-[#0077B5] to-[#E1306C] text-white font-black text-2xl">
                                {request.sender_profile.display_name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          <div className="flex-1 text-center sm:text-left min-w-0">
                            <h3 className="font-extrabold text-2xl text-[#1D2226] group-hover:text-[#833AB4] transition-colors tracking-tight">
                              {request.sender_profile.display_name}
                            </h3>
                            <p className="text-[#5E6B7E] font-medium mt-1 leading-relaxed">
                              wants to join your professional network
                            </p>
                            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
                              <span className="text-[10px] font-bold text-[#5E6B7E] uppercase tracking-widest px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                                {formatTime(request.created_at)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-4 w-full sm:w-auto">
                            <Button
                              size="lg"
                              onClick={() => handleAcceptRequest(request.id)}
                              disabled={processing === request.id}
                              className="flex-1 sm:flex-initial bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 shadow-xl shadow-[#833AB4]/25 h-14 font-bold transition-all transform hover:scale-105 active:scale-95"
                            >
                              {processing === request.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-6 w-6" />}
                            </Button>
                            <div className="relative p-[1px] rounded-full overflow-hidden flex-1 sm:flex-initial">
                              <div className="absolute inset-0 bg-gray-200" />
                              <Button
                                size="lg"
                                variant="outline"
                                onClick={() => handleRejectRequest(request.id)}
                                disabled={processing === request.id}
                                className="relative w-full bg-white hover:bg-gray-50 border-none rounded-full px-10 h-14 transition-all font-bold text-gray-500 shadow-lg shadow-black/5"
                              >
                                <X className="h-6 w-6" />
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

            {/* Other Notifications Section */}
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700" style={{ animationDelay: '200ms' }}>
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-2xl bg-[#833AB4]/10 text-[#833AB4]">
                    <Bell className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-black text-[#1D2226] tracking-tight">Recent Activity</h2>
                </div>
                {notifications.length > 0 && (
                  <span className="bg-gray-100 text-[#5E6B7E] px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200">
                    Latest {notifications.length} Updates
                  </span>
                )}
              </div>
              
              {notifications.length > 0 ? (
                <div className="grid gap-4">
                  {notifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification.type);
                    const isRead = notification.is_read;
                    
                    return (
                      <Card 
                        key={notification.id} 
                        className={`cursor-pointer group relative hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] border-gray-100 overflow-hidden animate-in fade-in slide-in-from-bottom-4 ${!isRead ? 'bg-gradient-to-r from-[#0077B5]/5 via-white to-white' : 'bg-white'}`}
                        style={{ animationDelay: `${(index * 50) + 300}ms` }}
                        onClick={() => handleNotificationClick(notification)}
                      >
                        {!isRead && (
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                        )}
                        <CardContent className="p-8">
                          <div className="flex items-center gap-6">
                            <div className="relative shrink-0">
                              <div className={`absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-0 group-hover:opacity-20 blur-xl rounded-full transition-opacity`} />
                              <Avatar className="h-16 w-16 rounded-[1.5rem] ring-4 ring-white shadow-lg relative z-10 transition-transform group-hover:scale-105">
                                <AvatarImage src={notification.payload?.sender_avatar} />
                                <AvatarFallback className="bg-gradient-to-br from-gray-50 to-gray-100 text-gray-400">
                                  <Icon className="h-7 w-7" />
                                </AvatarFallback>
                              </Avatar>
                              {!isRead && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-[#0077B5] to-[#E1306C] rounded-full ring-4 ring-white shadow-lg z-20 animate-pulse" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`text-lg leading-snug ${!isRead ? 'font-black text-[#1D2226]' : 'text-[#5E6B7E] font-medium'}`}>
                                {getNotificationMessage(notification)}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] font-bold text-[#5E6B7E] uppercase tracking-widest px-3 py-1 rounded-full bg-gray-50 border border-gray-100">
                                  {formatTime(notification.created_at)}
                                </span>
                                {!isRead && (
                                  <span className="text-[10px] font-black text-[#833AB4] uppercase tracking-widest">
                                    New Activity
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="p-3 rounded-full bg-gray-50 text-gray-400">
                                <Check className="h-5 w-5" />
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : friendRequests.length === 0 ? (
                <div className="bg-gray-50/30 rounded-[3rem] p-24 text-center border-2 border-dashed border-gray-100 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="relative mb-10">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                    <div className="relative bg-white h-28 w-28 rounded-[3rem] flex items-center justify-center mx-auto shadow-2xl">
                      <Bell className="h-14 w-14 text-gray-300" />
                    </div>
                  </div>
                  <h3 className="text-3xl font-extrabold text-[#1D2226] mb-4 tracking-tight">Your Activity is Clear</h3>
                  <p className="text-[#5E6B7E] font-medium max-w-sm mx-auto text-lg leading-relaxed">
                    You're all caught up! New notifications will appear here as they arrive.
                  </p>
                  <Button 
                    variant="outline"
                    className="mt-10 rounded-full px-10 h-14 font-bold border-2 border-[#833AB4]/20 hover:border-[#833AB4] hover:bg-[#833AB4]/5 text-[#833AB4] transition-all"
                    onClick={() => navigate('/dashboard')}
                  >
                    Back to Feed
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Notifications;
