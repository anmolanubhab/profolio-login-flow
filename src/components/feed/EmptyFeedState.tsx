import { FileText, Users, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyFeedStateProps {
  onCreatePost?: () => void;
}

const EmptyFeedState = ({ onCreatePost }: EmptyFeedStateProps) => {
  return (
    <div className="bg-card rounded-lg border border-border shadow-sm p-8 text-center">
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
        <FileText className="w-8 h-8 text-primary" />
      </div>
      
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No posts in your feed yet
      </h3>
      
      <p className="text-muted-foreground text-sm mb-6 max-w-sm mx-auto">
        Be the first to share something with your network! Start a conversation or share an update.
      </p>
      
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {onCreatePost && (
          <Button onClick={onCreatePost} className="gap-2">
            <Sparkles className="w-4 h-4" />
            Create a post
          </Button>
        )}
        <Button variant="outline" className="gap-2">
          <Users className="w-4 h-4" />
          Find connections
        </Button>
      </div>
      
      <div className="mt-8 pt-6 border-t border-border">
        <p className="text-xs text-muted-foreground">
          💡 Tip: Follow people and companies to see their updates in your feed
        </p>
      </div>
    </div>
  );
};

export default EmptyFeedState;
