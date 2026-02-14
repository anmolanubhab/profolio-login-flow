import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';

type Visibility = 'public' | 'recruiters' | 'private';

interface Props {
  userId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const JOB_TYPES = ['full-time', 'part-time', 'remote', 'internship', 'freelance'];
const NOTICE_PERIODS = ['Immediate', '15 days', '30 days', '60 days'];

export function OpenToOpportunitiesDialog({ userId, open, onOpenChange, onSaved }: Props) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const abortRef = useRef<AbortController | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [openToWork, setOpenToWork] = useState(false);
  const [jobType, setJobType] = useState<string[]>([]);
  const [roles, setRoles] = useState<string>('');
  const [locations, setLocations] = useState<string>('');
  const [expectedSalary, setExpectedSalary] = useState('');
  const [noticePeriod, setNoticePeriod] = useState<string>('');
  const [visibility, setVisibility] = useState<Visibility>('recruiters');

  // Rainbow gradient styles
  const gradientStyle = useMemo(
    () => ({
      background: 'linear-gradient(90deg, #ff4d4d, #ff9900, #ffee00, #00cc66, #3399ff, #9933ff)',
      borderRadius: '12px',
    } as React.CSSProperties),
    []
  );

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const d: any = data;
        setOpenToWork(!!d.open_to_work);
        setJobType(Array.isArray(d.job_type) ? d.job_type : []);
        setRoles(Array.isArray(d.open_to_roles) ? (d.open_to_roles as string[]).join(', ') : '');
        setLocations(Array.isArray(d.preferred_locations) ? (d.preferred_locations as string[]).join(', ') : '');
        setExpectedSalary(d.expected_salary || '');
        setNoticePeriod(d.notice_period || '');
        setVisibility((d.open_to_work_visibility as Visibility) || 'recruiters');
      }
      setLoading(false);
    })();

    return () => controller.abort();
  }, [open, userId]);

  const onToggleJobType = (value: string) => {
    setJobType(prev => (prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]));
  };

  const onSave = async () => {
    setSaving(true);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const payload = {
        open_to_work: openToWork,
        job_type: jobType,
        open_to_roles: roles.split(',').map(s => s.trim()).filter(Boolean),
        preferred_locations: locations.split(',').map(s => s.trim()).filter(Boolean),
        expected_salary: expectedSalary || null,
        notice_period: noticePeriod || null,
        open_to_work_visibility: visibility,
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload as any)
        .eq('user_id', userId);

      if (error) throw error;

      toast({ title: 'Saved', description: 'Your opportunity preferences are updated 🚀' });
      onOpenChange(false);
      onSaved?.();
    } catch (e: any) {
      if (e.name === 'AbortError') return;
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const Content = (
    <div className="w-full">
      <div className="space-y-6 px-4 pt-4 pb-6 md:px-6 md:pt-6">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Open to Opportunities</Label>
          <Switch checked={openToWork} onCheckedChange={setOpenToWork} />
        </div>

        {/* Job Type chips */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Job Type</Label>
          <div className="flex flex-wrap gap-2">
            {JOB_TYPES.map(t => (
              <Badge
                key={t}
                onClick={() => onToggleJobType(t)}
                className={`cursor-pointer select-none px-3 py-1 rounded-full ${jobType.includes(t) ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
              >
                {t}
              </Badge>
            ))}
          </div>
        </div>

        {/* Preferred Roles */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Roles</Label>
          <Input
            value={roles}
            onChange={(e) => setRoles(e.target.value)}
            placeholder="e.g., Frontend Engineer, Product Manager (comma-separated)"
            className="h-11"
          />
        </div>

        {/* Preferred Locations */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Preferred Locations</Label>
          <Input
            value={locations}
            onChange={(e) => setLocations(e.target.value)}
            placeholder="e.g., New York, Remote, Berlin (comma-separated)"
            className="h-11"
          />
        </div>

        {/* Expected Salary */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Expected Salary</Label>
          <Input
            value={expectedSalary}
            onChange={(e) => setExpectedSalary(e.target.value)}
            placeholder="e.g., $90k - $110k / year"
            className="h-11"
          />
        </div>

        {/* Notice Period */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Notice Period</Label>
          <Select value={noticePeriod} onValueChange={setNoticePeriod}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {NOTICE_PERIODS.map(np => (
                <SelectItem key={np} value={np}>{np}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Visibility */}
        <div className="space-y-3">
          <Label className="text-sm font-medium block">Visibility</Label>
          <div className="flex flex-wrap gap-2">
            {(['public', 'recruiters', 'private'] as Visibility[]).map(v => (
              <Badge
                key={v}
                onClick={() => setVisibility(v)}
                className={`cursor-pointer select-none px-3 py-1 rounded-full ${visibility === v ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'}`}
              >
                {v === 'public' ? 'Public' : v === 'recruiters' ? 'Recruiters Only' : 'Private'}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-3 px-4 md:px-6 py-4 border-t"
        style={isMobile ? { paddingBottom: 'calc(env(safe-area-inset-bottom, 0) + 16px)' } : undefined}
      >
        <Button variant="outline" className="h-11 flex-1 rounded-[12px]" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button className="h-11 flex-1 text-white" style={gradientStyle} onClick={onSave} disabled={!userId || saving || loading}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="rounded-t-2xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle>Open to Opportunities</DrawerTitle>
          </DrawerHeader>
          {Content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl w-full p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle>Open to Opportunities</DialogTitle>
        </DialogHeader>
        {Content}
      </DialogContent>
    </Dialog>
  );
}
