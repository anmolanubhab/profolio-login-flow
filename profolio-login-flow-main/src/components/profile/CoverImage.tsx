import { useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface CoverImageProps {
  coverUrl?: string | null;
  isOwner: boolean;
  userId: string;
  onUpdate?: (newUrl: string) => void;
}

const defaultCover = 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1200&h=300&fit=crop';

export const CoverImage = ({ coverUrl, isOwner, userId, onUpdate }: CoverImageProps) => {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please select an image under 5MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const { secureUpload } = await import('@/lib/secure-upload');
      const result = await secureUpload({
        bucket: 'avatars',
        file: file,
        userId: userId
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      // Update profile with cover URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: result.url })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      onUpdate?.(result.url!);
      toast({
        title: 'Cover updated',
        description: 'Your cover image has been updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative w-full h-32 sm:h-48 md:h-56 overflow-hidden rounded-t-xl">
      <img
        src={coverUrl || defaultCover}
        alt="Profile cover"
        className={cn(
          "w-full h-full object-cover transition-opacity duration-300",
          isUploading && "opacity-50"
        )}
      />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      
      {isOwner && (
        <label 
          htmlFor="cover-upload" 
          className="absolute bottom-3 right-3"
        >
          <Button
            size="sm"
            variant="secondary"
            className="gap-2 bg-background/80 backdrop-blur-sm hover:bg-background"
            disabled={isUploading}
            asChild
          >
            <span>
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isUploading ? 'Uploading...' : 'Edit Cover'}
              </span>
            </span>
          </Button>
          <input
            id="cover-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
            disabled={isUploading}
          />
        </label>
      )}
    </div>
  );
};
