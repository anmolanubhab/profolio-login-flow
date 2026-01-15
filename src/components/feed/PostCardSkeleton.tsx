import { Skeleton } from '@/components/ui/skeleton';

type PostCardSkeletonProps = {
  isCompanyPost?: boolean;
};

const PostCardSkeleton = ({ isCompanyPost = false }: PostCardSkeletonProps) => {
  return (
    <div
      className={
        isCompanyPost
          ? "bg-card mb-4 overflow-hidden"
          : "bg-card rounded-xl border border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden mb-4"
      }
    >
      {/* Header */}
      <div className="px-4 pt-3 pb-2 flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5 pt-0.5">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>

      {/* Content */}
      <div className="px-4 pb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[85%]" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* Media placeholder (FULL WIDTH for company post) */}
      <div className={isCompanyPost ? "-mx-4" : ""}>
        <Skeleton className="w-full h-56 rounded-none" />
      </div>

      {/* Engagement stats */}
      <div className="px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Skeleton className="h-[18px] w-[18px] rounded-full" />
          <Skeleton className="h-[18px] w-[18px] rounded-full -ml-2" />
          <Skeleton className="h-3 w-12 ml-1" />
        </div>
        <Skeleton className="h-3 w-28" />
      </div>

      {/* Action buttons */}
      <div className="px-1 py-0.5">
        <div className="flex items-center">
          <Skeleton className="flex-1 h-12 rounded-lg mx-0.5" />
          <Skeleton className="flex-1 h-12 rounded-lg mx-0.5" />
          <Skeleton className="flex-1 h-12 rounded-lg mx-0.5" />
          <Skeleton className="flex-1 h-12 rounded-lg mx-0.5" />
        </div>
      </div>

      {/* SINGLE divider line (LinkedIn-style) */}
      <hr className="border-t border-border/60" />
    </div>
  );
};

export default PostCardSkeleton;
