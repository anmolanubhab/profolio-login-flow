import { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, Image, Video, X, Loader2 } from 'lucide-react';

interface Company {
  id: string;
  name: string;
  logo_url: string | null;
}

interface CompanyPostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: { company_id: string; company: Company }[];
  onPostCreated?: () => void;
}

export const CompanyPostDialog = ({
  open,
  onOpenChange,
  companies,
  onPostCreated
}: CompanyPostDialogProps) => {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(companies[0]?.company_id || '');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const selectedCompany = companies.find(c => c.company_id === selectedCompanyId)?.company;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB for images, 100MB for videos)
    const maxSize = type === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${type === 'image' ? '10MB' : '100MB'}`,
        variant: 'destructive',
      });
      return;
    }

    setMediaFile(file);
    setMediaType(type);
    
    if (type === 'image') {
      const reader = new FileReader();
      reader.onloadend = () => setMediaPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(URL.createObjectURL(file));
    }
  };

  const removeMedia = () => {
    if (mediaPreview && mediaType === 'video') {
      URL.revokeObjectURL(mediaPreview);
    }
    setMediaFile(null);
    setMediaPreview(null);
  };

  const handlePost = async () => {
    if (!content.trim() && !mediaFile) {
      toast({
        title: 'Empty post',
        description: 'Please add some content or media to your post.',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedCompanyId || !selectedCompany) {
      toast({
        title: 'No company selected',
        description: 'Please select a company to post as.',
        variant: 'destructive',
      });
      return;
    }

    setIsPosting(true);
    setUploadProgress(0);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const signal = new AbortController().signal;
      let mediaUrl: string | null = null;

      // Upload media if present
      if (mediaFile) {
        setUploadProgress(20);
        const bucket = mediaType === 'image' ? 'post-images' : 'post-videos';
        const fileExt = mediaFile.name.split('.').pop();
        const fileName = `company-${selectedCompanyId}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(fileName, mediaFile);

        if (uploadError) throw uploadError;
        setUploadProgress(60);

        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
        setUploadProgress(80);
      }

      // Create the post
      const { error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          content: content.trim(),
          image_url: mediaUrl,
          media_type: mediaFile ? mediaType : null,
          posted_as: 'company',
          company_id: selectedCompanyId,
          company_name: selectedCompany.name,
          company_logo: selectedCompany.logo_url,
          status: 'published'
        })
        .abortSignal(signal);

      if (postError) throw postError;
      setUploadProgress(100);

      toast({
        title: 'Post published',
        description: `Posted as ${selectedCompany.name}`,
      });

      // Reset form
      setContent('');
      removeMedia();
      onOpenChange(false);
      onPostCreated?.();
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
      console.error('Error creating company post:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create post. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
      setUploadProgress(0);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Create Company Post
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Company selector */}
          <div className="space-y-2">
            <Label>Post as</Label>
            <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent>
                {companies.map(({ company_id, company }) => (
                  <SelectItem key={company_id} value={company_id}>
                    <div className="flex items-center gap-2">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="w-5 h-5 rounded object-cover" />
                      ) : (
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span>{company.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Post preview header */}
          {selectedCompany && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Avatar className="h-10 w-10">
                {selectedCompany.logo_url ? (
                  <AvatarImage src={selectedCompany.logo_url} />
                ) : null}
                <AvatarFallback className="bg-primary/10">
                  <Building2 className="w-5 h-5 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">{selectedCompany.name}</p>
                <p className="text-xs text-muted-foreground">Posting as company</p>
              </div>
            </div>
          )}

          {/* Content textarea */}
          <Textarea
            placeholder="What would you like to share on behalf of your company?"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[120px] resize-none"
          />

          {/* Media preview */}
          {mediaPreview && (
            <div className="relative">
              {mediaType === 'image' ? (
                <img
                  src={mediaPreview}
                  alt="Preview"
                  className="w-full max-h-64 object-cover rounded-lg"
                />
              ) : (
                <video
                  src={mediaPreview}
                  className="w-full max-h-64 rounded-lg"
                  controls
                />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={removeMedia}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Upload progress */}
          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}

          {/* Media buttons */}
          <div className="flex gap-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleMediaSelect(e, 'image')}
              ref={imageInputRef}
              className="hidden"
            />
            <input
              type="file"
              accept="video/*"
              onChange={(e) => handleMediaSelect(e, 'video')}
              ref={videoInputRef}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => imageInputRef.current?.click()}
              disabled={isPosting}
            >
              <Image className="w-4 h-4 mr-2" />
              Photo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => videoInputRef.current?.click()}
              disabled={isPosting}
            >
              <Video className="w-4 h-4 mr-2" />
              Video
            </Button>
          </div>

          {/* Submit button */}
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isPosting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handlePost}
              disabled={isPosting || (!content.trim() && !mediaFile)}
              className="bg-primary hover:bg-primary/90"
            >
              {isPosting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                'Post'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
