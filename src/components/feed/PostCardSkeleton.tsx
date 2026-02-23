import { Skeleton } from '@/components/ui/skeleton';

type PostCardSkeletonProps = {
  isCompanyPost?: boolean;
};

const PostCardSkeleton = ({ isCompanyPost = false }: PostCardSkeletonProps) => {
  return (
    <div
      className="bg-white overflow-hidden mb-6 rounded-xl sm:rounded-2xl border border-[#E8EBEF]/60 shadow-sm animate-pulse"
    >
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-start gap-4">
        <Skeleton className="h-14 w-14 rounded-[1.25rem] flex-shrink-0 bg-[#F3F6F8]" />
        <div className="flex-1 space-y-2.5 pt-1.5">
          <Skeleton className="h-5 w-40 bg-[#F3F6F8] rounded-full" />
          <Skeleton className="h-4 w-32 bg-[#F3F6F8] rounded-full" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl bg-[#F3F6F8]" />
      </div>

      {/* Content */}
      <div className="px-8 pb-6 space-y-3.5">
        <Skeleton className="h-4 w-full bg-[#F3F6F8] rounded-full" />
        <Skeleton className="h-4 w-[92%] bg-[#F3F6F8] rounded-full" />
        <Skeleton className="h-4 w-[65%] bg-[#F3F6F8] rounded-full" />
      </div>

      {/* Media placeholder */}
      <div className="w-full mb-6">
        <Skeleton className="w-full h-80 bg-[#F3F6F8]" />
      </div>

      {/* Engagement stats */}
      <div className="px-8 py-5 flex items-center justify-between border-b border-[#E8EBEF]/40">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2.5">
            <Skeleton className="h-7 w-7 rounded-full bg-[#F3F6F8] border-2 border-white" />
            <Skeleton className="h-7 w-7 rounded-full bg-[#F3F6F8] border-2 border-white" />
          </div>
          <Skeleton className="h-4 w-20 bg-[#F3F6F8] rounded-full" />
        </div>
        <Skeleton className="h-4 w-28 bg-[#F3F6F8] rounded-full" />
      </div>

      {/* Action buttons */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="flex-1 h-[52px] rounded-[1.25rem] bg-[#F3F6F8]" />
          <Skeleton className="flex-1 h-[52px] rounded-[1.25rem] bg-[#F3F6F8]" />
          <Skeleton className="flex-1 h-[52px] rounded-[1.25rem] bg-[#F3F6F8]" />
          <Skeleton className="flex-1 h-[52px] rounded-[1.25rem] bg-[#F3F6F8]" />
        </div>
      </div>
    </div>
  );
};

export default PostCardSkeleton;
