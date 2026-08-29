import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, Video as VideoIcon, FileText, X, Images, BarChart3, Plus, User as UserIcon, Building2 } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { rateLimiter, RATE_LIMITS, isServerRateLimitError, SERVER_RATE_LIMIT_MESSAGE } from '@/lib/rate-limiter';
import { CtaFields } from '@/components/CtaFields';
import { validateCtaUrl } from '@/lib/cta';
import { Megaphone } from 'lucide-react';

// A post carries at most one kind of rich attachment at a time (matches how
// LinkedIn's own composer works) -- picking a new one clears whatever was
// selected before. Mirrors the same composer logic in PostInput.tsx (the
// inline composer on the dashboard) -- this page is the FAB's full-page
// entry point into post creation.
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

const AddPost = () => {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<AttachmentMode>('none');
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [ownedCompanies, setOwnedCompanies] = useState<OwnedCompany[]>([]);
  const [postAsCompanyId, setPostAsCompanyId] = useState<string>(POST_AS_SELF);

  const navigate = useNavigate();

  useEffect(() => {
    const loadOwnedCompanies = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/');
        return;
      }
      setAuthUser(session.user);
      setAuthChecked(true);
      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', session.user.id).single();
      if (!profile) return;
      const { data } = await supabase.from('companies').select('id, name, logo_url').eq('owner_id', profile.id);
      setOwnedCompanies(data || []);
    };
    loadOwnedCompanies();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [carouselFiles, setCarouselFiles] = useState<File[]>([]);
  const [carouselPreviews, setCarouselPreviews] = useState<string[]>([]);

  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);

  const [selectedDocument, setSelectedDocument] = useState<File | null>(null);

  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);

  // CTA (call-to-action) -- only ever attached to company posts (see
  // `postAsCompanyId !== POST_AS_SELF` gating below). ctaOpen just controls
  // whether the config panel is expanded; cta_enabled (sent to the DB) is
  // derived from whether the company actually filled it in, not from this
  // UI-only flag.
  const [ctaOpen, setCtaOpen] = useState(false);
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [ctaOpenNewTab, setCtaOpenNewTab] = useState(true);
  const [ctaUrlError, setCtaUrlError] = useState<string | null>(null);

  const resetCta = () => {
    setCtaOpen(false);
    setCtaLabel('');
    setCtaUrl('');
    setCtaOpenNewTab(true);
    setCtaUrlError(null);
  };

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
      clearAttachments();
      setMode('none');
      return;
    }
    clearAttachments();
    setMode(next);
  };

  // `?compose=photo|video|poll` -- the mobile Create sheet deep-links here with
  // a hint for which attachment to start on. Preselect that mode and, for the
  // file-backed ones, open the native picker straight away. Consume the param
  // so a re-render / refresh doesn't re-trigger it.
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const compose = searchParams.get('compose');
    if (!compose) return;
    if (compose === 'photo') {
      setMode('image');
      imageInputRef.current?.click();
    } else if (compose === 'video') {
      setMode('video');
      videoInputRef.current?.click();
    } else if (compose === 'poll') {
      setMode('poll');
    }
    const next = new URLSearchParams(searchParams);
    next.delete('compose');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Invalid file type', description: 'Please select an image file.', variant: 'destructive' });
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
      toast({ title: 'Invalid file type', description: 'Carousel posts only support images.', variant: 'destructive' });
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
      toast({ title: 'Invalid file type', description: 'Please select a video file.', variant: 'destructive' });
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
      toast({ title: 'Invalid file type', description: 'Document posts currently support PDF only.', variant: 'destructive' });
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

  // A CTA that's open but incomplete (label chosen with no URL yet, or vice
  // versa) shouldn't silently get dropped OR silently block the whole post
  // -- it blocks submission with a visible error instead, same as any other
  // required field.
  const ctaBlocksSubmit = ctaOpen && (!ctaLabel || validateCtaUrl(ctaUrl).valid === false);

  const canSubmit = (isDraft: boolean) => {
    if (loading) return false;
    if (isDraft) return content.trim().length > 0;
    if (ctaBlocksSubmit) return false;
    if (mode === 'poll') {
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      return content.trim().length > 0 && validOptions.length >= MIN_POLL_OPTIONS;
    }
    if (mode === 'carousel') return carouselFiles.length >= 2;
    if (mode === 'video') return !!selectedVideo;
    if (mode === 'document') return !!selectedDocument;
    return content.trim().length > 0 || !!selectedImage;
  };

  const handlePost = async (isDraft = false) => {
    if (!isDraft && ctaOpen) {
      if (!ctaLabel) {
        toast({ title: 'Call-to-action incomplete', description: 'Choose a button label, or remove the CTA.', variant: 'destructive' });
        return;
      }
      const check = validateCtaUrl(ctaUrl);
      if (!check.valid) {
        setCtaUrlError(check.error);
        toast({ title: 'Call-to-action incomplete', description: check.error, variant: 'destructive' });
        return;
      }
    }

    if (!canSubmit(isDraft)) {
      toast({
        title: 'Validation Error',
        description: 'Please enter some content for your post',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      if (rateLimiter.isRateLimited(`post_create_${user.id}`, RATE_LIMITS.POST_CREATE)) {
        const resetTime = rateLimiter.getTimeUntilReset(`post_create_${user.id}`);
        toast({
          title: 'Rate limit exceeded',
          description: `Please wait ${Math.ceil(resetTime / 1000)} seconds before posting again.`,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      const { sanitizeTextContent } = await import('@/lib/input-sanitizer');
      const sanitizedContent = sanitizeTextContent(content);

      // Drafts keep it simple -- plain text only, no rich attachment, saved
      // via the existing status='draft' column.
      if (isDraft) {
        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          content: sanitizedContent,
          status: 'draft',
        });
        if (error) throw error;
      } else if (mode === 'poll') {
        const postingAsCompany = postAsCompanyId !== POST_AS_SELF
          ? ownedCompanies.find((c) => c.id === postAsCompanyId)
          : undefined;
        const validOptions = pollOptions.map((o) => sanitizeTextContent(o.trim())).filter(Boolean);
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
          const result = await secureUpload({ bucket: 'post-images', file: selectedImage, userId: user.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          imageUrl = result.url!;
        } else if (mode === 'carousel' && carouselFiles.length >= 2) {
          const uploaded: string[] = [];
          for (const file of carouselFiles) {
            const result = await secureUpload({ bucket: 'post-images', file, userId: user.id });
            if (!result.success) throw new Error(result.error || 'Upload failed');
            uploaded.push(result.url!);
          }
          carouselUrls = uploaded;
          postType = 'carousel';
        } else if (mode === 'video' && selectedVideo) {
          const result = await secureUpload({ bucket: 'post-videos', file: selectedVideo, userId: user.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          videoUrl = result.url!;
          postType = 'video';
        } else if (mode === 'document' && selectedDocument) {
          const result = await secureUpload({ bucket: 'post-documents', file: selectedDocument, userId: user.id });
          if (!result.success) throw new Error(result.error || 'Upload failed');
          documentUrl = result.url!;
          documentName = selectedDocument.name;
          postType = 'document';
        }

        const postingAsCompany = postAsCompanyId !== POST_AS_SELF
          ? ownedCompanies.find((c) => c.id === postAsCompanyId)
          : undefined;

        // CTA is only ever attached when actually posting as a company --
        // the UI already hides the config panel for personal posts, this is
        // the corresponding client-side guarantee so a personal post can
        // never carry a leftover CTA from a prior company-post attempt (the
        // `posts_cta_consistency` DB check constraint is the real backstop).
        const ctaCheck = ctaOpen ? validateCtaUrl(ctaUrl) : null;
        const ctaFields = postingAsCompany && ctaOpen && ctaLabel && ctaCheck?.valid
          ? { cta_enabled: true, cta_label: ctaLabel, cta_url: ctaCheck.normalized, cta_open_new_tab: ctaOpenNewTab }
          : { cta_enabled: false, cta_label: null, cta_url: null, cta_open_new_tab: true };

        const { error } = await supabase.from('posts').insert({
          user_id: user.id,
          content: sanitizedContent,
          image_url: imageUrl,
          video_url: videoUrl,
          document_url: documentUrl,
          document_name: documentName,
          carousel_urls: carouselUrls,
          post_type: postType,
          status: 'published',
          ...ctaFields,
          ...(postingAsCompany
            ? { posted_as: 'company', company_id: postingAsCompany.id, company_name: postingAsCompany.name, company_logo: postingAsCompany.logo_url }
            : {}),
        });
        if (error) throw error;
      }

      toast({
        title: 'Success',
        description: isDraft ? 'Draft saved successfully!' : 'Post published successfully!',
      });

      setContent('');
      clearAttachments();
      setMode('none');
      resetCta();
      navigate('/dashboard');
    } catch (error: any) {
      if (isServerRateLimitError(error)) {
        toast({
          title: 'Slow down',
          description: SERVER_RATE_LIMIT_MESSAGE,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Layout user={authUser} onSignOut={handleSignOut}>
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <h1 className="text-xl font-bold mb-4">Create Post</h1>
        <Card>
          <CardHeader>
            <CardTitle>Share an update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ownedCompanies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground shrink-0">Posting as</span>
                <Select
                  value={postAsCompanyId}
                  onValueChange={(v) => {
                    setPostAsCompanyId(v);
                    if (v === POST_AS_SELF) resetCta();
                  }}
                >
                  <SelectTrigger className="h-8 w-auto text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={POST_AS_SELF}>
                      <span className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" /> Myself
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

            <Textarea
              placeholder={mode === 'poll' ? 'Ask a question…' : 'What do you want to talk about?'}
              className="min-h-32 resize-none"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={loading}
            />

            {mode === 'image' && imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="max-h-64 w-full object-cover rounded-lg" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={() => switchMode('none')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {mode === 'carousel' && carouselPreviews.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
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
              <p className="text-xs text-muted-foreground">Add at least 2 images to make a carousel post.</p>
            )}

            {mode === 'video' && videoPreview && (
              <div className="relative">
                <video src={videoPreview} controls className="max-h-64 w-full rounded-lg bg-black" />
                <Button variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={() => switchMode('none')}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {mode === 'document' && selectedDocument && (
              <div className="flex items-center gap-3 rounded-lg bg-secondary p-3">
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

            {mode === 'poll' && (
              <div className="space-y-2">
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

            <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <input ref={carouselInputRef} type="file" accept="image/*" multiple onChange={handleCarouselSelect} className="hidden" />
            <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
            <input ref={documentInputRef} type="file" accept="application/pdf" onChange={handleDocumentSelect} className="hidden" />

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'image' ? 'text-primary bg-secondary' : ''}
                onClick={() => (mode === 'image' ? switchMode('none') : imageInputRef.current?.click())}
                disabled={loading}
              >
                <Image className="h-4 w-4 mr-2" />
                Photo
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'carousel' ? 'text-primary bg-secondary' : ''}
                onClick={() => (mode === 'carousel' ? switchMode('none') : carouselInputRef.current?.click())}
                disabled={loading}
              >
                <Images className="h-4 w-4 mr-2" />
                Carousel
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'video' ? 'text-primary bg-secondary' : ''}
                onClick={() => (mode === 'video' ? switchMode('none') : videoInputRef.current?.click())}
                disabled={loading}
              >
                <VideoIcon className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'document' ? 'text-primary bg-secondary' : ''}
                onClick={() => (mode === 'document' ? switchMode('none') : documentInputRef.current?.click())}
                disabled={loading}
              >
                <FileText className="h-4 w-4 mr-2" />
                Document
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={mode === 'poll' ? 'text-primary bg-secondary' : ''}
                onClick={() => switchMode('poll')}
                disabled={loading}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Poll
              </Button>
            </div>

            {/* Only ever offered when posting as a company -- personal
                posts never show CTA controls at all, not just a disabled
                one. */}
            {postAsCompanyId !== POST_AS_SELF && (
              <div className="rounded-lg border p-3">
                {!ctaOpen ? (
                  <Button variant="ghost" size="sm" className="text-muted-foreground -m-1" onClick={() => setCtaOpen(true)} disabled={loading}>
                    <Megaphone className="h-4 w-4 mr-2" />
                    Add call-to-action
                  </Button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium flex items-center gap-2">
                        <Megaphone className="h-4 w-4" /> Call-to-action
                      </span>
                      <Button variant="ghost" size="sm" className="h-7 text-muted-foreground" onClick={resetCta} disabled={loading}>
                        Remove CTA
                      </Button>
                    </div>
                    <CtaFields
                      label={ctaLabel}
                      url={ctaUrl}
                      openNewTab={ctaOpenNewTab}
                      urlError={ctaUrlError}
                      onLabelChange={setCtaLabel}
                      onUrlChange={(v) => { setCtaUrl(v); setCtaUrlError(null); }}
                      onOpenNewTabChange={setCtaOpenNewTab}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => handlePost(true)}
                disabled={!canSubmit(true)}
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                onClick={() => handlePost(false)}
                disabled={!canSubmit(false)}
              >
                {loading ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </Layout>
  );
};

export default AddPost;
