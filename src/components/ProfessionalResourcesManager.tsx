import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { secureUpload } from '@/lib/secure-upload';
import { FileText, Upload, Trash2, Plus, Link as LinkIcon } from 'lucide-react';

interface PdfResume {
  id: string;
  title: string;
  fileName: string;
}

interface ProfessionalResource {
  id: string;
  resource_type: string;
  label: string | null;
  url: string;
  sort_order: number;
}

const LINK_TYPE_LABELS: Record<string, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  portfolio: 'Portfolio',
  website: 'Personal Website',
  other: 'Other',
};

function isValidHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function ProfessionalResourcesManager() {
  const { toast } = useToast();
  const [userId, setUserId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pdfResume, setPdfResume] = useState<PdfResume | null>(null);
  const [uploading, setUploading] = useState(false);

  const [onlineResume, setOnlineResume] = useState<ProfessionalResource | null>(null);
  const [onlineResumeUrl, setOnlineResumeUrl] = useState('');
  const [onlineResumeLabel, setOnlineResumeLabel] = useState('');
  const [savingOnlineResume, setSavingOnlineResume] = useState(false);

  const [links, setLinks] = useState<ProfessionalResource[]>([]);
  const [newLinkType, setNewLinkType] = useState('linkedin');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [savingLink, setSavingLink] = useState(false);

  useEffect(() => {
    void loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle();
      if (!profile) return;
      setProfileId(profile.id);

      const [{ data: resumes }, { data: resources }] = await Promise.all([
        supabase.from('resumes').select('id, title, content').eq('user_id', user.id).order('updated_at', { ascending: false }),
        supabase.from('professional_resources').select('id, resource_type, label, url, sort_order').eq('profile_id', profile.id).order('sort_order', { ascending: true }),
      ]);

      const pdfRow = (resumes || []).find((r: { content: unknown }) => (r.content as { type?: string })?.type === 'pdf');
      if (pdfRow) {
        const content = pdfRow.content as { fileName?: string };
        setPdfResume({ id: pdfRow.id, title: pdfRow.title, fileName: content.fileName || pdfRow.title });
      }

      const online = (resources || []).find((r) => r.resource_type === 'online_resume') || null;
      setOnlineResume(online);
      if (online) {
        setOnlineResumeUrl(online.url);
        setOnlineResumeLabel(online.label || '');
      }
      setLinks((resources || []).filter((r) => r.resource_type !== 'online_resume'));
    } catch (error) {
      console.error('Error loading professional resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (file: File) => {
    if (!userId) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Invalid file', description: 'Only PDF files are accepted.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const result = await secureUpload({ bucket: 'resumes', file, userId });
      if (!result.success || !result.filePath) {
        toast({ title: 'Upload failed', description: result.error || 'Could not upload PDF.', variant: 'destructive' });
        return;
      }

      const content = { type: 'pdf', fileName: file.name, storagePath: result.filePath };

      if (pdfResume) {
        const { error } = await supabase.from('resumes').update({ title: file.name, content }).eq('id', pdfResume.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('resumes').insert({ title: file.name, content, user_id: userId });
        if (error) throw error;
      }

      toast({ title: 'PDF resume saved', description: `${file.name} is ready to attach to applications.` });
      await loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePdf = async () => {
    if (!pdfResume) return;
    try {
      // The underlying Storage object is intentionally left in place -- a
      // past application may already reference it via its own immutable
      // snapshot/resume_file_path (B8/B9 immutability), and this app never
      // auto-deletes historical Storage objects (see B7's 8 orphaned files).
      const { error } = await supabase.from('resumes').delete().eq('id', pdfResume.id);
      if (error) throw error;
      setPdfResume(null);
      toast({ title: 'PDF resume removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveOnlineResume = async () => {
    if (!profileId) return;
    if (!isValidHttpsUrl(onlineResumeUrl)) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid https:// URL.', variant: 'destructive' });
      return;
    }
    setSavingOnlineResume(true);
    try {
      if (onlineResume) {
        const { error } = await supabase
          .from('professional_resources')
          .update({ url: onlineResumeUrl, label: onlineResumeLabel.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', onlineResume.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('professional_resources').insert({
          profile_id: profileId,
          resource_type: 'online_resume',
          label: onlineResumeLabel.trim() || null,
          url: onlineResumeUrl,
        });
        if (error) throw error;
      }
      toast({ title: 'Online resume saved' });
      await loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingOnlineResume(false);
    }
  };

  const handleRemoveOnlineResume = async () => {
    if (!onlineResume) return;
    try {
      const { error } = await supabase.from('professional_resources').delete().eq('id', onlineResume.id);
      if (error) throw error;
      setOnlineResume(null);
      setOnlineResumeUrl('');
      setOnlineResumeLabel('');
      toast({ title: 'Online resume removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleAddLink = async () => {
    if (!profileId) return;
    if (!isValidHttpsUrl(newLinkUrl)) {
      toast({ title: 'Invalid URL', description: 'Please enter a valid https:// URL.', variant: 'destructive' });
      return;
    }
    setSavingLink(true);
    try {
      const { error } = await supabase.from('professional_resources').insert({
        profile_id: profileId,
        resource_type: newLinkType,
        label: newLinkLabel.trim() || LINK_TYPE_LABELS[newLinkType],
        url: newLinkUrl,
        sort_order: links.length,
      });
      if (error) throw error;
      setNewLinkUrl('');
      setNewLinkLabel('');
      toast({ title: 'Link added' });
      await loadAll();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  const handleRemoveLink = async (id: string) => {
    try {
      const { error } = await supabase.from('professional_resources').delete().eq('id', id);
      if (error) throw error;
      setLinks((prev) => prev.filter((l) => l.id !== id));
      toast({ title: 'Link removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mt-8" />;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> PDF Resume
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {pdfResume ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3">
              <span className="text-sm truncate">{pdfResume.fileName}</span>
              <div className="flex gap-2 shrink-0">
                <Label htmlFor="pdf-replace" className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span><Upload className="h-4 w-4 mr-1.5" />{uploading ? 'Uploading…' : 'Replace'}</span>
                  </Button>
                </Label>
                <Button variant="destructive" size="sm" onClick={handleRemovePdf} disabled={uploading}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <Label htmlFor="pdf-replace" className="cursor-pointer">
              <Button variant="outline" disabled={uploading} asChild>
                <span><Upload className="h-4 w-4 mr-2" />{uploading ? 'Uploading…' : 'Upload PDF resume'}</span>
              </Button>
            </Label>
          )}
          <input
            id="pdf-replace"
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handlePdfUpload(file);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-muted-foreground">
            Only shared with a recruiter when you enable "Allow recruiters to view my PDF resume" in Visibility
            settings, and only for applications where you attach it.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Online Resume
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Input placeholder="Title (optional)" value={onlineResumeLabel} onChange={(e) => setOnlineResumeLabel(e.target.value)} />
            <Input placeholder="https://example.com/my-resume" value={onlineResumeUrl} onChange={(e) => setOnlineResumeUrl(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveOnlineResume} disabled={savingOnlineResume || !onlineResumeUrl}>
              {savingOnlineResume ? 'Saving…' : 'Save'}
            </Button>
            {onlineResume && (
              <Button size="sm" variant="destructive" onClick={handleRemoveOnlineResume}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkIcon className="h-5 w-5" /> Professional Profile Links
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {links.map((link) => (
            <div key={link.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{link.label || LINK_TYPE_LABELS[link.resource_type]}</p>
                <p className="text-xs text-muted-foreground truncate">{link.url}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleRemoveLink(link.id)} className="shrink-0">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="grid gap-3 sm:grid-cols-[140px_1fr_2fr_auto] items-start">
            <Select value={newLinkType} onValueChange={setNewLinkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(LINK_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Label (optional)" value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} />
            <Input placeholder="https://…" value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} />
            <Button size="sm" onClick={handleAddLink} disabled={savingLink || !newLinkUrl}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
