import { useEffect, useState } from 'react';
import { Archive, EyeOff, Lock, Loader2 } from 'lucide-react';
import {
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader,
  ResponsiveModalTitle,
} from '@/components/ui/responsive-modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  fetchMutedAuthors, fetchStorySettings, unmuteAuthor, upsertStorySettings,
} from '@/lib/stories/api';
import type { StoryPrivacy } from '@/lib/stories/types';

export function StorySettingsDialog({
  open, onOpenChange, userId, onChanged,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [archiveEnabled, setArchiveEnabled] = useState(false);
  const [defaultPrivacy, setDefaultPrivacy] = useState<StoryPrivacy>('public');
  const [muted, setMuted] = useState<{ userId: string; name: string; avatarUrl: string | null }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([fetchStorySettings(userId), fetchMutedAuthors(userId)])
      .then(([s, m]) => {
        setArchiveEnabled(s.archiveEnabled);
        setDefaultPrivacy(s.defaultPrivacy);
        setMuted(m);
      })
      .catch(() => toast({ title: 'Could not load settings', variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, [open, userId, toast]);

  const persist = async (patch: { archiveEnabled?: boolean; defaultPrivacy?: StoryPrivacy }) => {
    setSaving(true);
    try {
      await upsertStorySettings(userId, patch);
      onChanged?.();
    } catch {
      toast({ title: 'Could not save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnmute = async (id: string) => {
    setMuted((prev) => prev.filter((m) => m.userId !== id));
    try {
      await unmuteAuthor(userId, id);
      onChanged?.();
    } catch {
      toast({ title: 'Could not unmute', variant: 'destructive' });
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={onOpenChange}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Story settings</ResponsiveModalTitle>
        </ResponsiveModalHeader>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <Tabs defaultValue="archive" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="archive"><Archive className="mr-1.5 h-4 w-4" />Archive</TabsTrigger>
              <TabsTrigger value="muted"><EyeOff className="mr-1.5 h-4 w-4" />Muted</TabsTrigger>
              <TabsTrigger value="privacy"><Lock className="mr-1.5 h-4 w-4" />Privacy</TabsTrigger>
            </TabsList>

            <TabsContent value="archive" className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Save to archive</p>
                  <p className="text-xs text-muted-foreground">
                    Automatically keep your stories after they expire. Only you can see your archive.
                  </p>
                </div>
                <Switch
                  checked={archiveEnabled}
                  disabled={saving}
                  onCheckedChange={(v) => { setArchiveEnabled(v); persist({ archiveEnabled: v }); }}
                />
              </div>
            </TabsContent>

            <TabsContent value="muted" className="py-4">
              {muted.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  You haven't muted anyone's stories.
                </p>
              ) : (
                <div className="space-y-1">
                  {muted.map((m) => (
                    <div key={m.userId} className="flex items-center gap-3 rounded-md p-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatarUrl ?? undefined} />
                        <AvatarFallback>{m.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="flex-1 text-sm">{m.name}</span>
                      <Button size="sm" variant="outline" onClick={() => handleUnmute(m.userId)}>Unmute</Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="privacy" className="py-4">
              <p className="mb-2 text-sm font-medium">Who can see your story by default?</p>
              <RadioGroup
                value={defaultPrivacy}
                onValueChange={(v) => { setDefaultPrivacy(v as StoryPrivacy); persist({ defaultPrivacy: v as StoryPrivacy }); }}
              >
                {(['public', 'friends', 'custom'] as StoryPrivacy[]).map((p) => (
                  <div key={p} className="flex items-center gap-2">
                    <RadioGroupItem value={p} id={`sp-${p}`} />
                    <Label htmlFor={`sp-${p}`} className="text-sm font-normal capitalize">
                      {p === 'friends' ? 'Connections' : p}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <p className="mt-2 text-xs text-muted-foreground">
                You can still change privacy for each story while creating it.
              </p>
            </TabsContent>
          </Tabs>
        )}
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}

export default StorySettingsDialog;
