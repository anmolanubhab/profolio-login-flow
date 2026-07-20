import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, FileText, User, X, Video as VideoIcon, Images, BarChart3, Plus, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS } from '@/lib/rate-limiter';

interface PostInputProps {
  user?: {
    email?: string;
    avatar?: string;
  };
  onPostCreated?: () => void;
}

// A post carries at most one kind of rich attachment at a time (matches how
// LinkedIn's own composer works) -- picking a new one clears whatever was
// selected before.
type AttachmentMode = 'none' | 'image' | 'carousel' | 'video' | 'document' | 'poll';

interface OwnedCompany {
  id: string;
  name: string;
  logo_url: string | null;
}

const MAX_CAROUSEL_IMAGES = 10;
const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;
const POST_AS_SELF = 'self';

const PostInput = ({ user, onPostCreated }: PostInputProps) => {
  const [postContent, setPostContent] = useState('');
  const [mode, setMode] = useState<AttachmentMode>('none');
  const [isPosting, setIsPosting] = useState(false);

  // "Post as" -- only shown when the current user owns at least one company
  // (mirrors CompanySelector.tsx's owner_id-only scoping used elsewhere for
  // job posting; doesn't yet extend to company_members/admin roles).
  const [ownedCompanies, setOwnedCompanies] = useState<OwnedCompany[]>([]);
  const [postAsCompanyId, setPostAsCompanyId] = useState<string>(POST_AS_SELF);

  useEffect(() => {
    const loadOwnedCompanies = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', authUser.id).single();
      if (!profile) return;
      const { data } = await supabase.from('companies').select('id, name, logo_url').eq('owner_id', profile.id);
      setOwnedCompanies(data || []);
    };
    loadOwnedCompanies();
  }, []);

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [carouselFiles, setCarouselFiles] = useState<File[]>([]);
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);

  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const clearAttachments = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setCarouselFiles([]);
    setCarouselPreviews([]);
    setSelectedVideo(null);
    setVideoPreview(null);
    setSelectedDocument(null);
    setPollOptions(['', '']);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (carouselInputRef.current) carouselInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
  };

  const switchMode = (next: AttachmentMode) => {
    if (mode === next) {
      // Toggling the same attachment type off again.
      clearAttachments();
      setMode('none');
      return;
    }
    clearAttachments();
    setMode(next);
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid file type", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    setMode('image');
    setSelectedImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleCarouselSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    const invalid = files.find((f) => !f.type.startsWith('image/'));
    if (invalid) {
      toast({ title: "Invalid file type", description: "Carousel posts only support images.", variant: "destructive" });
      return;
    }

    const combined = [...carouselFiles, ...files].slice(0, MAX_CAROUSEL_IMAGES);
    setMode('carousel');
    setCarouselFiles(combined);

    Promise.all(
      combined.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.readAsDataURL(file);
          })
      )
    ).then(setCarouselPreviews);
  };

  const removeCarouselImage = (index: number) => {
    const nextFiles = carouselFiles.filter((_, i) => i !== index);
    setCarouselFiles(nextFiles);
    setCarouselPreviews((prev) => prev.filter((_, i) => i !== index));
    if (nextFiles.length === 0) setMode('none');
  };

  const handleVideoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast({ title: "Invalid file type", description: "Please select a video file.", variant: "destructive" });
      return;
    }
    setMode('video');
    setSelectedVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const handleDocumentSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: "Invalid file type", description: "Document posts currently support PDF only.", variant: "destructive" });
      return;
    }
    setMode('document');
    setSelectedDocument(file);
  };

  const updatePollOption = (index: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const addPollOption = () => {
    if (pollOptions.length >= MAX_POLL_OPTIONS) return;
    setPollOptions((prev) => [...prev, '']);
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length <= MIN_POLL_OPTIONS) return;
    setPollOptions((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = () => {
    if (isPosting) return false;
    if (mode === 'poll') {
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      return postContent.trim().length > 0 && validOptions.length >= MIN_POLL_OPTIONS;
    }
    if (mode === 'carousel') return carouselFiles.length >= 2;
    if (mode === 'video') return !!selectedVideo;
    if (mode === 'document') return !!selectedDocument;
    return postContent.trim().length > 0 || !!selectedImage;
  };

  const handlePost = async () => {
    if (!canSubmit()) return;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      toast({ title: "Authentication required", description: "Please log in to create a post.", variant: "destructive" });
      return;
    }

    if (rateLimiter.isRateLimited(`post_create_${currentUser.id}`, RATE_LIMITS.POST_CREATE)) {
      const resetTime = rateLimiter.getTimeUntilReset(`post_create_${currentUser.id}`);
      toast({
        title: "Rate limit exceeded",
        description: `Please wait ${Math.ceil(resetTime / 1000)} seconds before posting again.`,
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const { sanitizeTextContent } = await import('@/lib/input-sanitizer');
      const sanitizedContent = sanitizeTextContent(postContent);

      const postingAsCompany = postAsCompanyId !== POST_AS_SELF
        ? ownedCompanies.find((c) => c.id === postAsCompanyId)
        : undefined;

      if (mode === 'poll') {
        const validOptions = pollOptions.map((o) => sanitizeTextContent(o.trim())).filter(Boolean);
        // Posts + poll + options are created atomically server-side, so a
        // failure partway through can never leave a poll-typed post with no
        // actual poll behind it.
        const { error } = await supabase.rpc('create_poll_post', {
          p_content: sanitizedContent,
          p_options: validOptions,
          ...(postingAsCompany
            ? { p_company_id: postingAsCompany.id, p_company_name: postingAsCompany.name, p_company_logo: postingAsCompany.logo_url || undefined }
            : {}),
        });
        if (error) throw error;
      } else {
        const { secureUpload } = await import('@/lib/secure-upload');

        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        let documentUrl: string | null = null;
        let documentName: string | null = null;
        let carouselUrls: string[] | null = null;
        let postType: 'text' | 'carousel' | 'document' | 'video' = 'text';

        if (mode === 'image' && selectedImage) {
          const result = await secureUpload({ bucket: 'post-images', file: selectedImage, userId: currentUser.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          imageUrl = result.url!;
        } else if (mode === 'carousel' && carouselFiles.length >= 2) {
          const uploaded: string[] = [];
          for (const file of carouselFiles) {
            const result = await secureUpload({ bucket: 'post-images', file, userId: currentUser.id });
            if (!result.success) throw new Error(result.error || 'Upload failed');
            uploaded.push(result.url!);
          }
          carouselUrls = uploaded;
          postType = 'carousel';
        } else if (mode === 'video' && selectedVideo) {
          const result = await secureUpload({ bucket: 'post-videos', file: selectedVideo, userId: currentUser.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          videoUrl = result.url!;
          postType = 'video';
        } else if (mode === 'document' && selectedDocument) {
          const result = await secureUpload({ bucket: 'post-documents', file: selectedDocument, userId: currentUser.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          documentUrl = result.url!;
          documentName = selectedDocument.name;
          postType = 'document';
        }

        const { error } = await supabase.from('posts').insert({
          content: sanitizedContent,
          image_url: imageUrl,
          video_url: videoUrl,
          document_url: documentUrl,
          document_name: documentName,
          carousel_urls: carouselUrls,
          post_type: postType,
          user_id: currentUser.id,
          ...(postingAsCompany
            ? { posted_as: 'company', company_id: postingAsCompany.id, company_name: postingAsCompany.name, company_logo: postingAsCompany.logo_url }
            : {}),
        });

        if (error) throw error;
      }

      toast({ title: "Post created!", description: "Your post has been shared successfully." });

      setPostContent('');
      clearAttachments();
      setMode('none');
      onPostCreated?.();

    } catch (error: any) {
      console.error('Error creating post:', error);
      toast({
        title: "Error creating post",
        description: error?.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <Card className="bg-card shadow-card rounded-xl border-border">
      <CardContent className="p-4 sm:p-5">
        {ownedCompanies.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">Posting as</span>
            <Select value={postAsCompanyId} onValueChange={setPostAsCompanyId}>
              <SelectTrigger className="h-8 w-auto text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={POST_AS_SELF}>
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4" /> Myself
                  </span>
                </SelectItem>
                {ownedCompanies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Post Input Area */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={user?.avatar} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {user?.email?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            <Textarea
              placeholder={mode === 'poll' ? "Ask a question…" : "Share your achievement, upload a certificate, or update your resume…"}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              className="min-h-[60px] resize-none border-0 bg-secondary text-sm placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary rounded-lg px-4 py-3 transition-all duration-200"
            />
          </div>
        </div>

        {/* Image Preview */}
        {mode === 'image' && imagePreview && (
          <div className="mt-4 relative">
            <img src={imagePreview} alt="Preview" className="max-h-64 w-full object-cover rounded-lg" />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={() => switchMode('none')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Carousel Preview */}
        {mode === 'carousel' && carouselPreviews.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {carouselPreviews.map((src, i) => (
              <div key={i} className="relative shrink-0">
                <img src={src} alt={`Slide ${i + 1}`} className="h-32 w-32 object-cover rounded-lg" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6 rounded-full"
                  onClick={() => removeCarouselImage(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {carouselFiles.length < MAX_CAROUSEL_IMAGES && (
              <button
                type="button"
                className="h-32 w-32 shrink-0 rounded-lg border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                onClick={() => carouselInputRef.current?.click()}
              >
                <Plus className="h-6 w-6" />
              </button>
            )}
          </div>
        )}
        {mode === 'carousel' && carouselFiles.length < 2 && (
          <p className="mt-2 text-xs text-muted-foreground">Add at least 2 images to make a carousel post.</p>
        )}

        {/* Video Preview */}
        {mode === 'video' && videoPreview && (
          <div className="mt-4 relative">
            <video src={videoPreview} controls className="max-h-64 w-full rounded-lg bg-black" />
            <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={() => switchMode('none')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Document Preview */}
        {mode === 'document' && selectedDocument && (
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-secondary p-3">
            <FileText className="h-8 w-8 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{selectedDocument.name}</div>
              <div className="text-xs text-muted-foreground">{(selectedDocument.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => switchMode('none')}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Poll builder */}
        {mode === 'poll' && (
          <div className="mt-4 space-y-2">
            {pollOptions.map((option, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  placeholder={`Option ${i + 1}`}
                  value={option}
                  onChange={(e) => updatePollOption(i, e.target.value)}
                  maxLength={80}
                />
                {pollOptions.length > MIN_POLL_OPTIONS && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removePollOption(i)}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            {pollOptions.length < MAX_POLL_OPTIONS && (
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={addPollOption}>
                <Plus className="h-4 w-4 mr-1.5" /> Add option
              </Button>
            )}
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
        <input ref={carouselInputRef} type="file" accept="image/*" multiple onChange={handleCarouselSelect} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        <input ref={documentInputRef} type="file" accept="application/pdf" onChange={handleDocumentSelect} className="hidden" />

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'image' ? 'text-primary bg-secondary' : ''}`}
              onClick={() => (mode === 'image' ? switchMode('none') : imageInputRef.current?.click())}
              disabled={isPosting}
            >
              <Camera className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Photo</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'carousel' ? 'text-primary bg-secondary' : ''}`}
              onClick={() => (mode === 'carousel' ? switchMode('none') : carouselInputRef.current?.click())}
              disabled={isPosting}
            >
              <Images className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Carousel</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'video' ? 'text-primary bg-secondary' : ''}`}
              onClick={() => (mode === 'video' ? switchMode('none') : videoInputRef.current?.click())}
              disabled={isPosting}
            >
              <VideoIcon className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Video</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'document' ? 'text-primary bg-secondary' : ''}`}
              onClick={() => (mode === 'document' ? switchMode('none') : documentInputRef.current?.click())}
              disabled={isPosting}
            >
              <FileText className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Document</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'poll' ? 'text-primary bg-secondary' : ''}`}
              onClick={() => switchMode('poll')}
              disabled={isPosting}
            >
              <BarChart3 className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Poll</span>
            </Button>
          </div>

          <Button
            onClick={handlePost}
            size="sm"
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-6 text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canSubmit()}
          >
            {isPosting ? "Posting..." : "Post"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostInput;
