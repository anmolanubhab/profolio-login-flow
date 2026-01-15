import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserCheck, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface FollowButtonProps {
  targetProfileId: string;
  targetName?: string;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  className?: string;
}

export const FollowButton = ({ 
  targetProfileId, 
  targetName = 'this user',
  size = 'sm',
  variant = 'outline',
  showText = true,
  className
}: FollowButtonProps) => {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    checkFollowStatus();
  }, [targetProfileId]);

  const checkFollowStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!myProfile) {
        setIsLoading(false);
        return;
      }

      // Don't show follow button for own profile
      if (myProfile.id === targetProfileId) {
        setIsLoading(false);
        return;
      }

      setCurrentProfileId(myProfile.id);

      const { data } = await supabase
        .from('followers')
        .select('id')
        .eq('follower_id', myProfile.id)
        .eq('following_id', targetProfileId)
        .maybeSingle();

      setIsFollowing(!!data);
    } catch (error) {
      console.error('Error checking follow status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentProfileId) {
      toast({
        title: 'Sign in required',
        description: 'Please sign in to follow users.',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('followers')
          .delete()
          .eq('follower_id', currentProfileId)
          .eq('following_id', targetProfileId);

        if (error) throw error;
        
        setIsFollowing(false);
        toast({
          title: 'Unfollowed',
          description: `You unfollowed ${targetName}`,
        });
      } else {
        // Follow
        const { error } = await supabase
          .from('followers')
          .insert({
            follower_id: currentProfileId,
            following_id: targetProfileId
          });

        if (error) throw error;

        // Create notification
        await supabase
          .from('notifications')
          .insert({
            user_id: targetProfileId,
            type: 'new_follower',
            payload: {
              follower_id: currentProfileId
            }
          });

        setIsFollowing(true);
        toast({
          title: 'Following',
          description: `You are now following ${targetName}`,
        });
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Don't render if loading or viewing own profile
  if (isLoading || !currentProfileId || currentProfileId === targetProfileId) {
    return null;
  }

  return (
    <Button
      size={size}
      variant={isFollowing ? 'secondary' : variant}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        handleFollow();
      }}
      disabled={isUpdating}
      className={cn(
        "gap-1.5 transition-all",
        isFollowing && "text-muted-foreground",
        className
      )}
    >
      {isUpdating ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isFollowing ? (
        <UserCheck className="h-4 w-4" />
      ) : (
        <UserPlus className="h-4 w-4" />
      )}
      {showText && (
        <span className="hidden sm:inline">
          {isFollowing ? 'Following' : 'Follow'}
        </span>
      )}
    </Button>
  );
};
