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
    <div className="mx-4 mt-2 mb-4 border border-[#E8EBEF] rounded-[1.5rem] overflow-hidden bg-gray-50/30 hover:bg-gray-50/50 transition-colors duration-300">
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <Avatar className={`h-10 w-10 ring-2 ring-white shadow-sm transition-all duration-300 ${isCompany ? 'rounded-xl' : 'rounded-[0.9rem]'}`}>
          <AvatarImage src={avatar || undefined} alt={name || ''} className="object-cover" />
          <AvatarFallback className={`bg-gradient-to-br from-[#0077B5]/10 to-[#833AB4]/10 text-[#833AB4] font-bold ${isCompany ? 'rounded-xl' : 'rounded-[0.9rem]'}`}>
            {name?.[0]?.toUpperCase() || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-[14px] truncate text-[#1D2226] hover:text-[#0077B5] transition-colors cursor-pointer">
              {name}
            </h4>
            {isCompany && (
              <Badge className="h-4.5 px-2 text-[10px] font-bold bg-[#0077B5]/10 text-[#0077B5] border-0 rounded-full">
                Company
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12px] font-medium text-[#5E6B7E]">
            {subtitle && <span className="truncate max-w-[150px]">{subtitle}</span>}
            <span className="text-[#5E6B7E]/30">•</span>
            <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="-mt-2">
        <PostContent content={post.content} isCompact />
      </div>

      {/* Media */}
      {(post.image_url) && (
        <div className="pb-4">
          <PostMedia 
            src={post.image_url} 
            mediaType={(post.media_type as 'image' | 'video') || 'image'} 
            isCompact
          />
        </div>
      )}
    </div>
  );
};

export default SharedPost;
