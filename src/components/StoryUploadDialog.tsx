import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';

interface StoryUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded?: () => void;
}

// The "Create a story" upload flow -- shared between the feed's Stories
// tray and the Story Viewer's sidebar so there's exactly one upload
// implementation, not two copies drifting apart.
export function StoryUploadDialog({ open, onOpenChange, onUploaded }: StoryUploadDialogProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('You must be signed in.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', currentUser.id)
        .single();
      if (!profile) throw new Error('Profile not found');

      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('stories').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('stories').getPublicUrl(fileName);

      const { error: insertError } = await supabase.from('stories').insert({
        user_id: currentUser.id,
        media_url: publicUrl,
        media_type: file.type.startsWith('image/') ? 'image' : 'video',
      });
      if (insertError) throw insertError;

      toast({ title: 'Success', description: 'Story uploaded successfully!' });
      onOpenChange(false);
      onUploaded?.();
    } catch (error) {
      console.error('Error uploading story:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Could not upload story.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Create Story</h2>
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
            <Input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="story-upload-input"
            />
            <label htmlFor="story-upload-input" className="cursor-pointer flex flex-col items-center gap-2">
              <Plus className="h-12 w-12 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {uploading ? 'Uploading...' : 'Click to upload image or video'}
              </span>
            </label>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default StoryUploadDialog;
