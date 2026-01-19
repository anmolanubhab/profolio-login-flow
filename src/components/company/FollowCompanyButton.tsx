import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserPlus, UserMinus, Loader2 } from 'lucide-react';

interface FollowCompanyButtonProps {
  isFollowing: boolean;
  onFollow: () => Promise<boolean>;
  onUnfollow: () => Promise<boolean>;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
}

export const FollowCompanyButton = ({
  isFollowing,
  onFollow,
  onUnfollow,
  size = 'default',
  showText = true
}: FollowCompanyButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    if (isFollowing) {
      await onUnfollow();
    } else {
      await onFollow();
    }
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <Button variant="outline" size={size} disabled>
        <Loader2 className="w-4 h-4 animate-spin" />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (isFollowing) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={handleClick}
        className="border-primary text-primary hover:bg-primary/10"
      >
        <UserMinus className="w-4 h-4" />
        {showText && <span className="ml-2">Following</span>}
      </Button>
    );
  }

  return (
    <Button
      size={size}
      onClick={handleClick}
      className="bg-primary hover:bg-primary/90"
    >
      <UserPlus className="w-4 h-4" />
      {showText && <span className="ml-2">Follow</span>}
    </Button>
  );
};
