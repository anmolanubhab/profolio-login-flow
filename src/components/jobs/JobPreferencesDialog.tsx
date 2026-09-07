import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import {
  ResponsiveModal, ResponsiveModalContent, ResponsiveModalHeader,
  ResponsiveModalTitle, ResponsiveModalDescription, ResponsiveModalFooter,
} from '@/components/ui/responsive-modal';
import { TagMultiSelect } from './TagMultiSelect';
import { WORK_MODE_OPTIONS, EMPLOYMENT_TYPE_OPTIONS, WORK_MODE_LABELS, EMPLOYMENT_TYPE_LABELS } from '@/lib/jobMatch';
import { notifyProfileChanged } from '@/lib/profileNav';

export interface JobPreferencesValues {
  open_to_roles: string[] | null;
  preferred_locations: string[] | null;
  preferred_work_modes: string[] | null;
  job_type: string[] | null;
  preferred_industries: string[] | null;
  salary_min_expected: number | null;
  salary_max_expected: number | null;
  salary_currency: string | null;
  open_to_work: boolean;
  actively_looking: boolean;
}

interface JobPreferencesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileUserId: string;
  initialValues: JobPreferencesValues;
  onSaved: (patch: JobPreferencesValues) => void;
}

/**
 * Candidate Job Preferences editor. Reuses existing profiles columns only
 * (no job_preferences table) -- see Phase 1 migration notes. Uses the same
 * ResponsiveModal (Dialog on desktop / bottom Drawer on mobile) and
 * .from('profiles').update().eq('user_id', ...) pattern as EditProfileDialog,
 * so this stays RLS-scoped to the caller's own row (profiles_update_own) and
 * visually consistent with the rest of profile editing.
 */
export function JobPreferencesDialog({ open, onOpenChange, profileUserId, initialValues, onSaved }: JobPreferencesDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<JobPreferencesValues>(initialValues);

  useEffect(() => {
    if (open) setValues(initialValues);
  }, [open, initialValues]);

  const patch = <K extends keyof JobPreferencesValues>(key: K, val: JobPreferencesValues[K]) =>
    setValues((prev) => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const dbPatch = {
        open_to_roles: values.open_to_roles?.length ? values.open_to_roles : null,
        preferred_locations: values.preferred_locations?.length ? values.preferred_locations : null,
        preferred_work_modes: values.preferred_work_modes ?? [],
        job_type: values.job_type?.length ? values.job_type : null,
        preferred_industries: values.preferred_industries ?? [],
        salary_min_expected: values.salary_min_expected,
        salary_max_expected: values.salary_max_expected,
        salary_currency: values.salary_currency?.trim() || null,
        open_to_work: values.open_to_work,
        actively_looking: values.actively_looking,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('profiles').update(dbPatch).eq('user_id', profileUserId);
      if (error) throw error;

      onSaved(values);
      notifyProfileChanged();
      toast({ title: 'Job preferences saved' });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn't save preferences",
        description: err instanceof Error ? err.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveModal open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <ResponsiveModalContent className="sm:max-w-lg">
        <ResponsiveModalHeader>
          <ResponsiveModalTitle>Job Preferences</ResponsiveModalTitle>
          <ResponsiveModalDescription>
            Tell us what you're looking for so we can recommend better-matched jobs.
          </ResponsiveModalDescription>
        </ResponsiveModalHeader>

        <div className="space-y-5 py-1">
          <div className="space-y-1.5">
            <Label>Desired job titles</Label>
            <TagMultiSelect
              values={values.open_to_roles ?? []}
              onChange={(v) => patch('open_to_roles', v)}
              placeholder="e.g. Frontend Developer, React Developer"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Preferred locations</Label>
            <TagMultiSelect
              values={values.preferred_locations ?? []}
              onChange={(v) => patch('preferred_locations', v)}
              placeholder="e.g. Kolkata, Bengaluru"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Work mode</Label>
            <TagMultiSelect
              values={values.preferred_work_modes ?? []}
              onChange={(v) => patch('preferred_work_modes', v)}
              options={WORK_MODE_OPTIONS.map((v) => ({ value: v, label: WORK_MODE_LABELS[v] }))}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Employment type</Label>
            <TagMultiSelect
              values={values.job_type ?? []}
              onChange={(v) => patch('job_type', v)}
              options={EMPLOYMENT_TYPE_OPTIONS.map((v) => ({ value: v, label: EMPLOYMENT_TYPE_LABELS[v] }))}
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Industries</Label>
            <TagMultiSelect
              values={values.preferred_industries ?? []}
              onChange={(v) => patch('preferred_industries', v)}
              placeholder="e.g. Fintech, Healthcare"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Expected salary (structured)</Label>
            <p className="text-xs text-muted-foreground">
              Separate from your existing "Expected salary" text field on your profile — that stays as-is.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Min"
                value={values.salary_min_expected ?? ''}
                onChange={(e) => patch('salary_min_expected', e.target.value === '' ? null : Number(e.target.value))}
                disabled={saving}
              />
              <Input
                type="number"
                inputMode="numeric"
                placeholder="Max"
                value={values.salary_max_expected ?? ''}
                onChange={(e) => patch('salary_max_expected', e.target.value === '' ? null : Number(e.target.value))}
                disabled={saving}
              />
              <Input
                placeholder="Currency"
                value={values.salary_currency ?? ''}
                onChange={(e) => patch('salary_currency', e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="jp_open_to_work">Open to work</Label>
              <p className="text-xs text-muted-foreground">Willing to consider opportunities. Shown as a badge on your profile.</p>
            </div>
            <Switch id="jp_open_to_work" checked={values.open_to_work} onCheckedChange={(c) => patch('open_to_work', c)} disabled={saving} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5 pr-3">
              <Label htmlFor="jp_actively_looking">Actively looking</Label>
              <p className="text-xs text-muted-foreground">Currently searching seriously — helps us prioritize your recommendations and alerts.</p>
            </div>
            <Switch id="jp_actively_looking" checked={values.actively_looking} onCheckedChange={(c) => patch('actively_looking', c)} disabled={saving} />
          </div>
        </div>

        <ResponsiveModalFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save preferences'}
          </Button>
        </ResponsiveModalFooter>
      </ResponsiveModalContent>
    </ResponsiveModal>
  );
}
