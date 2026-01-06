import { Skeleton } from '@/components/ui/skeleton';

const PostCardSkeleton = () => {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
      
      {/* Content */}
      <div className="px-4 pb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
      
      {/* Media placeholder */}
      <Skeleton className="w-full h-64" />
      
      {/* Engagement stats */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
      
      {/* Action buttons */}
      <div className="border-t border-border px-2 py-1">
        <div className="flex items-center justify-around">
          <Skeleton className="h-10 w-20 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-20 rounded-lg" />
          <Skeleton className="h-10 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default PostCardSkeleton;
