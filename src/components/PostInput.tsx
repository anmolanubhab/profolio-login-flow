import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import PostComposerEditor from '@/components/post/PostComposerEditor';
import {
  createEmptyDoc,
  docToJson,
  isDocEmpty,
  MAX_POST_CHARS,
  type RichDoc,
} from '@/lib/posts/richText';
import {
  POLL_DURATIONS,
  DEFAULT_POLL_DURATION,
  POLL_MAX_OPTION,
  validatePoll,
  type PollDuration,
} from '@/lib/posts/poll';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PostImageEditor from '@/components/post/PostImageEditor';
import { draftFromFile, uploadDraftImages, type DraftImage } from '@/lib/posts/mediaDrafts';
import { isAcceptableImage, mediaToJson, MAX_POST_IMAGES, readImageSize } from '@/lib/posts/media';
import { reconcilePostMediaTags } from '@/lib/posts/mediaTags';
import { Camera, FileText, User, X, Video as VideoIcon, BarChart3, Plus, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { rateLimiter, RATE_LIMITS, isServerRateLimitError, SERVER_RATE_LIMIT_MESSAGE } from '@/lib/rate-limiter';

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

const MAX_POLL_OPTIONS = 6;
const MIN_POLL_OPTIONS = 2;
const POST_AS_SELF = 'self';

const PostInput = ({ user, onPostCreated }: PostInputProps) => {
  // Rich-text document (Phase 6A). `postPlainText` is the flattened mirror kept
  // in sync by the editor — used for validation and the `posts.content` column.
  const [doc, setDoc] = useState<RichDoc>(createEmptyDoc);
  const [postPlainText, setPostPlainText] = useState('');
  const [mode, setMode] = useState<AttachmentMode>('none');
  const [isPosting, setIsPosting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

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

  // Phase 6C: photos flow through the PostImageEditor (crop + ALT + reorder).
  const [photoDrafts, setPhotoDrafts] = useState<DraftImage[]>([]);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);

  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollDuration, setPollDuration] = useState<PollDuration>(DEFAULT_POLL_DURATION);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const clearAttachments = () => {
    setPhotoDrafts([]);
    setImageEditorOpen(false);
    setSelectedVideo(null);
    setVideoPreview(null);
    setSelectedDocument(null);
    setPollOptions(['', '']);
    setPollDuration(DEFAULT_POLL_DURATION);
    if (imageInputRef.current) imageInputRef.current.value = '';
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

  // Photo button -> OS picker -> open the editor seeded with the picked files
  // (matching LinkedIn's "Photo -> Editor" flow).
  const handlePhotosPicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).slice(0, MAX_POST_IMAGES);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (files.length === 0) return;
    const drafts: DraftImage[] = [];
    for (const f of files) {
      const err = isAcceptableImage(f);
      if (err) {
        toast({ title: 'Photo skipped', description: err, variant: 'destructive' });
        continue;
      }
      const d = await draftFromFile(f);
      const size = await readImageSize(d.src);
      d.w = size.w || undefined;
      d.h = size.h || undefined;
      drafts.push(d);
    }
    if (drafts.length === 0) return;
    clearAttachments();
    setMode('image');
    setPhotoDrafts(drafts);
    setImageEditorOpen(true);
  };

  const openPhotoPicker = () => {
    if (photoDrafts.length > 0) setImageEditorOpen(true);
    else imageInputRef.current?.click();
  };

  const removeAllPhotos = () => {
    clearAttachments();
    setMode('none');
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
    if (postPlainText.length > MAX_POST_CHARS) return false;
    if (mode === 'poll') {
      return validatePoll(postPlainText, pollOptions) === null;
    }
    if (mode === 'image') return photoDrafts.length >= 1;
    if (mode === 'video') return !!selectedVideo;
    if (mode === 'document') return !!selectedDocument;
    return postPlainText.trim().length > 0;
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
      const sanitizedContent = sanitizeTextContent(postPlainText);
      // Only persist the rich doc when it actually carries text — an
      // image-only post stays a plain-text (NULL content_rich) row so the
      // renderer's legacy path handles it and the entity trigger no-ops.
      const richForInsert = isDocEmpty(doc) ? null : doc;

      const postingAsCompany = postAsCompanyId !== POST_AS_SELF
        ? ownedCompanies.find((c) => c.id === postAsCompanyId)
        : undefined;

      if (mode === 'poll') {
        const pollError = validatePoll(postPlainText, pollOptions);
        if (pollError) {
          toast({ title: 'Poll needs a fix', description: pollError, variant: 'destructive' });
          setIsPosting(false);
          return;
        }
        const validOptions = pollOptions.map((o) => sanitizeTextContent(o.trim())).filter(Boolean);
        // Post + poll + options are created atomically server-side (and the RPC
        // re-validates duration / dedupe / limits), so a failure partway
        // through can never leave a poll-typed post with no poll behind it.
        const { data: newPollPostId, error } = await supabase.rpc('create_poll_post', {
          p_content: sanitizedContent,
          p_options: validOptions,
          p_duration: pollDuration,
          ...(postingAsCompany
            ? { p_company_id: postingAsCompany.id, p_company_name: postingAsCompany.name, p_company_logo: postingAsCompany.logo_url || undefined }
            : {}),
        });
        if (error) throw error;
        // Attach the rich version of the question so @mentions / #hashtags /
        // formatting render (and the sync_post_entities trigger fires on the
        // content_rich UPDATE, just like a normal post).
        if (newPollPostId && !isDocEmpty(doc)) {
          await supabase.from('posts').update({ content_rich: docToJson(doc) }).eq('id', newPollPostId as string);
        }
      } else {
        const { secureUpload } = await import('@/lib/secure-upload');

        let imageUrl: string | null = null;
        let videoUrl: string | null = null;
        let documentUrl: string | null = null;
        let documentName: string | null = null;
        let carouselUrls: string[] | null = null;
        let mediaJson: ReturnType<typeof mediaToJson> | null = null;
        let postType: 'text' | 'carousel' | 'document' | 'video' = 'text';

        if (mode === 'image' && photoDrafts.length > 0) {
          const media = await uploadDraftImages(
            photoDrafts,
            currentUser.id,
            photoDrafts.length > 1
              ? (done, total) => setUploadProgress({ done, total })
              : undefined,
          );
          mediaJson = mediaToJson(media);
          imageUrl = media[0]?.url ?? null;
          carouselUrls = media.length > 1 ? media.map((m) => m.url) : null;
          postType = media.length > 1 ? 'carousel' : 'text';
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

        const { data: inserted, error } = await supabase.from('posts').insert({
          content: sanitizedContent,
          content_rich: docToJson(richForInsert),
          image_url: imageUrl,
          video_url: videoUrl,
          document_url: documentUrl,
          document_name: documentName,
          carousel_urls: carouselUrls,
          media: mediaJson,
          post_type: postType,
          user_id: currentUser.id,
          ...(postingAsCompany
            ? { posted_as: 'company', company_id: postingAsCompany.id, company_name: postingAsCompany.name, company_logo: postingAsCompany.logo_url }
            : {}),
        }).select('id').single();

        if (error) throw error;

        // Persist photo tags (people attached to specific images). Separate
        // from caption @mentions; each new tag fires one photo_tag notification.
        if (inserted?.id && mode === 'image' && photoDrafts.some((d) => d.tags.length > 0)) {
          await reconcilePostMediaTags(
            inserted.id,
            photoDrafts.map((d) => ({ mediaKey: d.mediaKey, tags: d.tags })),
          );
        }
      }

      toast({ title: "Post created!", description: "Your post has been shared successfully." });

      setDoc(createEmptyDoc());
      setPostPlainText('');
      clearAttachments();
      setMode('none');
      onPostCreated?.();

    } catch (error: any) {
      console.error('Error creating post:', error);
      if (isServerRateLimitError(error)) {
        toast({
          title: "Slow down",
          description: SERVER_RATE_LIMIT_MESSAGE,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Error creating post",
          description: error?.message || "Something went wrong. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsPosting(false);
      setUploadProgress(null);
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

          <div className="flex-1 min-w-0">
            <div className="rounded-lg bg-secondary px-3 py-2 focus-within:ring-1 focus-within:ring-primary transition-all duration-200">
              <PostComposerEditor
                value={doc}
                onChange={(nextDoc, text) => {
                  setDoc(nextDoc);
                  setPostPlainText(text);
                }}
                placeholder={mode === 'poll'
                  ? 'Ask a question…'
                  : 'Share your achievement, upload a certificate, or update your resume…'}
                disabled={isPosting}
                minHeight="60px"
              />
            </div>
            {postPlainText.length > MAX_POST_CHARS && (
              <p className="mt-1 text-xs text-destructive">
                {postPlainText.length.toLocaleString()} / {MAX_POST_CHARS.toLocaleString()} characters
              </p>
            )}
          </div>
        </div>

        {/* Photos preview strip */}
        {mode === 'image' && photoDrafts.length > 0 && (
          <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
            {photoDrafts.map((d) => (
              <img
                key={d.key}
                src={d.src}
                alt={d.alt || 'Selected photo'}
                className="h-20 w-20 shrink-0 rounded-lg object-cover"
              />
            ))}
            <div className="ml-1 flex shrink-0 flex-col gap-1">
              <Button variant="outline" size="sm" onClick={() => setImageEditorOpen(true)}>Edit photos</Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={removeAllPhotos}>
                <X className="mr-1 h-3.5 w-3.5" /> Remove
              </Button>
            </div>
          </div>
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
                  maxLength={POLL_MAX_OPTION}
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
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground shrink-0">Poll length</span>
              <Select value={pollDuration} onValueChange={(v) => setPollDuration(v as PollDuration)}>
                <SelectTrigger className="h-8 w-auto text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {POLL_DURATIONS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={handlePhotosPicked} className="hidden" />
        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        <input ref={documentInputRef} type="file" accept="application/pdf" onChange={handleDocumentSelect} className="hidden" />

        {/* Action Buttons */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border gap-2 flex-wrap">
          <div className="flex gap-1 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className={`text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-all duration-200 ease-in-out text-sm font-medium ${mode === 'image' ? 'text-primary bg-secondary' : ''}`}
              onClick={openPhotoPicker}
              disabled={isPosting}
            >
              <Camera className="h-5 w-5 sm:mr-1.5" />
              <span className="hidden sm:inline">Photo</span>
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
            {uploadProgress
              ? `Uploading ${uploadProgress.done}/${uploadProgress.total}`
              : isPosting
                ? "Posting..."
                : "Post"}
          </Button>
        </div>
      </CardContent>

      <PostImageEditor
        open={imageEditorOpen}
        initial={photoDrafts}
        onCancel={() => setImageEditorOpen(false)}
        onDone={(items) => {
          setPhotoDrafts(items);
          setImageEditorOpen(false);
          if (items.length === 0) setMode('none');
        }}
      />
    </Card>
  );
};

export default PostInput;
