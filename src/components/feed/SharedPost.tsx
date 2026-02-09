import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import PostContent from './PostContent';
import PostMedia from './PostMedia';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface SharedPostProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    media_type: string | null;
    created_at: string;
    user_id: string;
    posted_as: 'user' | 'company';
    company_id: string | null;
    company_name: string | null;
    company_logo: string | null;
    profiles: {
      display_name: string | null;
      avatar_url: string | null;
      profession: string | null;
    } | null;
  };
}

const SharedPost = ({ post }: SharedPostProps) => {
  const isCompany = post.posted_as === 'company';
  const name = isCompany ? post.company_name : post.profiles?.display_name || 'Unknown User';
  const avatar = isCompany ? post.company_logo : post.profiles?.avatar_url;
  const subtitle = isCompany ? 'Company' : post.profiles?.profession;

  return (
    <div className="mx-4 mt-2 mb-3 border rounded-lg overflow-hidden bg-muted/10">
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        <Avatar className="h-10 w-10 border border-border/50">
          <AvatarImage src={avatar || undefined} alt={name || ''} />
          <AvatarFallback>{name?.[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm truncate text-foreground/90 hover:underline cursor-pointer">
              {name}
            </h4>
            {isCompany && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
                Company
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {subtitle && <span className="truncate max-w-[150px]">{subtitle}</span>}
            <span>•</span>
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="-mt-1">
        <PostContent content={post.content} />
      </div>

      {/* Media */}
      {(post.image_url) && (
        <div className="pb-3 px-3">
          <PostMedia 
            src={post.image_url} 
            mediaType={(post.media_type as 'image' | 'video') || 'image'} 
          />
        </div>
      )}
    </div>
  );
};

export default SharedPost;
