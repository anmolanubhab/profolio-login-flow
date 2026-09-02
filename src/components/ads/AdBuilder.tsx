import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { AdCreativePreview } from '@/components/ads/AdCreativePreview';
import { CreativeImageUpload } from '@/components/ads/CreativeImageUpload';
import {
  AD_CTA_OPTIONS,
  AD_FORMATS,
  CREATIVE_LIMITS,
  adFormatMeta,
  createAdWithCreative,
  updateAdName,
  upsertCreative,
  validateDestinationUrl,
  type Ad,
  type AdAccount,
  type AdCreative,
  type AdFormat,
  type AdSet,
  type CreativeInput,
} from '@/lib/ads/api';

const NAME_MAX = 255;
const NO_CTA = '__none__';

interface AdBuilderProps {
  adAccount: AdAccount;
  companyName: string;
  /** new mode */
  adSet?: AdSet;
  /** edit mode — must be a draft ad */
  initial?: { ad: Ad; creative: AdCreative | null };
  onSaved: (ad: Ad) => void;
  onCancel: () => void;
}

export function AdBuilder({
  adAccount,
  companyName,
  adSet,
  initial,
  onSaved,
  onCancel,
}: AdBuilderProps) {
  const { toast } = useToast();
  const cr = initial?.creative ?? null;

  const [name, setName] = useState(initial?.ad.name ?? '');
  const [format, setFormat] = useState<AdFormat>(cr?.format ?? 'single_image');
  const [headline, setHeadline] = useState(cr?.headline ?? '');
  const [body, setBody] = useState(cr?.body ?? '');
  const [cta, setCta] = useState<string>(cr?.cta_label ?? NO_CTA);
  const [destinationUrl, setDestinationUrl] = useState(cr?.destination_url ?? '');
  const [mediaUrl, setMediaUrl] = useState<string | null>(cr?.media_url ?? null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const needsImage = adFormatMeta(format).needsImage;

  const trimmedName = name.trim();
  const nameError =
    trimmedName.length < 2 || trimmedName.length > NAME_MAX
      ? `Use 2–${NAME_MAX} characters.`
      : null;
  const headlineError =
    headline.trim().length === 0
      ? 'Add a headline.'
      : headline.length > CREATIVE_LIMITS.headline
        ? `Keep the headline under ${CREATIVE_LIMITS.headline} characters.`
        : null;
  const bodyError =
    body.length > CREATIVE_LIMITS.body ? `Keep the text under ${CREATIVE_LIMITS.body} characters.` : null;
  const urlError = validateDestinationUrl(destinationUrl);
  const imageError = needsImage && !mediaUrl ? 'This format needs an image.' : null;

  const blocking = nameError || headlineError || bodyError || urlError || imageError;

  const creativeInput: CreativeInput = useMemo(
    () => ({
      format,
      headline: headline.trim(),
      body: body.trim() || null,
      ctaLabel: cta === NO_CTA ? null : cta,
      destinationUrl: destinationUrl.trim() || null,
      mediaUrl: needsImage ? mediaUrl : null,
    }),
    [format, headline, body, cta, destinationUrl, mediaUrl, needsImage],
  );

  const handleSave = async () => {
    setSubmitted(true);
    if (blocking) {
      toast({ title: 'Check the highlighted fields', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let ad: Ad;
      if (initial) {
        ad = trimmedName !== initial.ad.name ? await updateAdName(initial.ad.id, trimmedName) : initial.ad;
        await upsertCreative(initial.ad.id, initial.creative, creativeInput);
      } else {
        ad = await createAdWithCreative(adSet!.id, trimmedName, creativeInput);
      }
      toast({ title: initial ? 'Draft saved' : 'Ad draft created' });
      onSaved(ad);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not save the ad.';
      toast({
        title: 'Save failed',
        description: /row-level security|not authorized/i.test(message)
          ? 'You’re not authorized to manage ads in this campaign.'
          : message,
        variant: 'destructive',
      });
      setSaving(false);
    }
  };

  const showError = (err: string | null) => submitted && err;

  return (
    <div className="grid gap-4 pb-24 lg:grid-cols-[1fr_auto] lg:items-start">
      <div className="space-y-4">
        {/* Ad name + format */}
        <Card className="bg-card shadow-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-bold">Ad</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ad-name">Ad name</Label>
              <Input
                id="ad-name"
                value={name}
                maxLength={NAME_MAX}
                placeholder="e.g. Q3 push — single image A"
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!showError(nameError)}
              />
              <p className={cn('text-xs', showError(nameError) ? 'text-destructive' : 'text-muted-foreground')}>
                {showError(nameError) || 'Only you see this — it labels the ad in your list.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ad-format">Format</Label>
              <Select
                value={format}
                onValueChange={(v) => setFormat(v as AdFormat)}
                disabled={!!initial}
              >
                <SelectTrigger id="ad-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AD_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label} — {f.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {initial && (
                <p className="text-xs text-muted-foreground">Format can’t change after the ad is created.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Creative */}
        <Card className="bg-card shadow-card border-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-[15px] font-bold">Creative</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsImage && (
              <CreativeImageUpload
                adAccountId={adAccount.id}
                value={mediaUrl}
                onChange={setMediaUrl}
                error={showError(imageError)}
              />
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cr-headline">Headline</Label>
              <Input
                id="cr-headline"
                value={headline}
                maxLength={CREATIVE_LIMITS.headline}
                placeholder="What’s the offer?"
                onChange={(e) => setHeadline(e.target.value)}
                aria-invalid={!!showError(headlineError)}
              />
              <div className="flex justify-between text-xs">
                <span className={showError(headlineError) ? 'text-destructive' : 'text-muted-foreground'}>
                  {showError(headlineError) ||
                    `Aim for ${CREATIVE_LIMITS.headlineRecommended} characters or fewer.`}
                </span>
                <span className="text-muted-foreground">
                  {headline.length}/{CREATIVE_LIMITS.headline}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-body">Description</Label>
              <Textarea
                id="cr-body"
                value={body}
                maxLength={CREATIVE_LIMITS.body}
                rows={3}
                placeholder="Add context that supports the headline (optional)."
                onChange={(e) => setBody(e.target.value)}
                aria-invalid={!!showError(bodyError)}
              />
              <div className="flex justify-between text-xs">
                <span className={showError(bodyError) ? 'text-destructive' : 'text-muted-foreground'}>
                  {showError(bodyError) ||
                    `Aim for ${CREATIVE_LIMITS.bodyRecommended} characters or fewer.`}
                </span>
                <span className="text-muted-foreground">
                  {body.length}/{CREATIVE_LIMITS.body}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-cta">Call to action</Label>
              <Select value={cta} onValueChange={setCta}>
                <SelectTrigger id="cr-cta">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_CTA}>No button</SelectItem>
                  {AD_CTA_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cr-url">Destination URL</Label>
              <Input
                id="cr-url"
                value={destinationUrl}
                inputMode="url"
                placeholder="https://example.com/landing"
                onChange={(e) => setDestinationUrl(e.target.value)}
                aria-invalid={!!showError(urlError)}
              />
              <p className={cn('text-xs', showError(urlError) ? 'text-destructive' : 'text-muted-foreground')}>
                {showError(urlError) || 'Where people go when they click. Must start with https://'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live preview */}
      <div className="lg:sticky lg:top-4">
        <AdCreativePreview
          data={{
            format,
            headline: headline.trim(),
            body: body.trim() || null,
            ctaLabel: cta === NO_CTA ? null : cta,
            mediaUrl: needsImage ? mediaUrl : null,
            companyName,
          }}
        />
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:col-span-2">
        <div className="mx-auto flex max-w-[960px] items-center justify-between gap-3 px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4">
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save draft
          </Button>
        </div>
      </div>
    </div>
  );
}
