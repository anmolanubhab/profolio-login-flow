import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPayload {
  sender_name?: string;
  sender_avatar?: string;
  message?: string;
  job_title?: string;
  post_id?: string;
  profile_id?: string;
  company_name?: string;
  location?: string;
  conversation_id?: string;
  connection_id?: string;
}

interface Notification {
  id: string;
  user_id: string;
  type: string;
  payload: NotificationPayload;
  is_read: boolean;
  created_at: string;
}

interface NotificationBellProps {
  userId: string;
}

export const NotificationBell = ({ userId }: NotificationBellProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchNotifications();
    setupRealtimeSubscription();

    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userId]);

  useEffect(() => {
    if (page > 0) {
      loadMoreNotifications();
    }
  }, [page]);

  const fetchNotifications = async () => {
    try {
      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(ITEMS_PER_PAGE);

      if (error) throw error;

      setNotifications((data || []) as Notification[]);
      setUnreadCount(data?.filter(n => !n.is_read).length || 0);
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const loadMoreNotifications = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .range(page * ITEMS_PER_PAGE, (page + 1) * ITEMS_PER_PAGE - 1);

      if (error) throw error;

      setNotifications(prev => [...prev, ...((data || []) as Notification[])]);
      setHasMore((data?.length || 0) === ITEMS_PER_PAGE);
    } catch (error) {
      console.error('Error loading more notifications:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        async (payload) => {
          const newNotification = payload.new as unknown as Notification;
          
          // Check if notification is for current user
          const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('user_id', userId)
            .single();

          if (profile && newNotification.user_id === profile.id) {
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            
            // Show toast notification
            const message = getNotificationMessage(newNotification);
            toast.success(message, {
              description: 'Just now',
              duration: 4000,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async () => {
    if (unreadCount === 0) return;

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) return;

      const unreadNotifications = notifications
        .filter(n => !n.is_read)
        .map(n => n.id);

      if (unreadNotifications.length > 0) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .in('id', unreadNotifications);

        setNotifications(prev =>
          prev.map(n => ({ ...n, is_read: true }))
        );
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const handleBellClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      markAsRead();
    }
  };

  const getNotificationMessage = (notification: Notification): string => {
    const { type, payload } = notification;
    const senderName = payload.sender_name || 'Someone';

    switch (type) {
      case 'like':
        return `${senderName} liked your post`;
      case 'comment':
        return `${senderName} commented on your post`;
      case 'share':
        return `${senderName} shared your post`;
      case 'connection_request':
        return `${senderName} sent you a connection request`;
      case 'connection_accepted':
        return `${senderName} accepted your connection request`;
      case 'profile_view':
        return `${senderName} viewed your profile`;
      case 'profile_save':
        return `${senderName} saved your profile`;
      case 'new_job':
        return `New job posted: ${payload.job_title || 'Check it out'}`;
      case 'message':
        return `${senderName} sent you a message`;
      default:
        return payload.message || 'New notification';
    }
  };

  const getNotificationLink = (notification: Notification): string => {
    const { type, payload } = notification;

    switch (type) {
      case 'like':
      case 'comment':
      case 'share':
        return `/dashboard?post=${payload.post_id}`;
      case 'connection_request':
      case 'connection_accepted':
        return '/network';
      case 'profile_view':
      case 'profile_save':
        return '/profile';
      case 'new_job':
        return '/jobs';
      case 'message':
        return '/connect';
      default:
        return '/notifications';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    const link = getNotificationLink(notification);
    window.location.href = link;
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleBellClick}
        className="menu-button relative"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <Badge 
            variant="destructive" 
            className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs animate-scale-in"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </Badge>
        )}
      </button>

      {isOpen && (
        <div 
          className="dropdown-menu w-96 max-w-[calc(100vw-2rem)] animate-fade-in"
          style={{ 
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 0.5rem)',
            zIndex: 1000,
          }}
        >
          <div className="p-3 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base">Notifications</h3>
              {notifications.length > 0 && (
                <button
                  onClick={() => window.location.href = '/notifications'}
                  className="text-sm text-primary hover:underline"
                >
                  View All
                </button>
              )}
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full p-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left ${
                      !notification.is_read ? 'bg-primary/5' : ''
                    }`}
                  >
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={notification.payload.sender_avatar} />
                      <AvatarFallback>
                        {notification.payload.sender_name?.charAt(0) || 'N'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm line-clamp-2">
                        {getNotificationMessage(notification)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                    )}
                  </button>
                ))}

                {hasMore && (
                  <button
                    onClick={() => setPage(prev => prev + 1)}
                    className="w-full p-3 text-sm text-primary hover:bg-secondary/50 transition-colors"
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
