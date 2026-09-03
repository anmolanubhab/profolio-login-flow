import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Check,
  Cloud,
  Download,
  Eye,
  Loader2,
  Palette,
  Sparkles,
  UserRoundPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import type { ResumeDoc, SectionId } from '@/lib/resume/schema';
import { completeness } from '@/lib/resume/schema';
import { ResumePreview } from './ResumePreview';
import { DesignPanel } from './DesignPanel';
import {
  BasicsEditor,
  SummaryEditor,
  ExperienceEditor,
  EducationEditor,
  SkillsEditor,
  ProjectsEditor,
  CustomEditor,
} from './sectionEditors';

type StepId = 'basics' | SectionId | 'design';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'basics', label: 'Heading' },
  { id: 'summary', label: 'Summary' },
  { id: 'experience', label: 'Experience' },
  { id: 'education', label: 'Education' },
  { id: 'skills', label: 'Skills' },
  { id: 'projects', label: 'Projects' },
  { id: 'custom', label: 'More sections' },
  { id: 'design', label: 'Design' },
];

type Patch = (recipe: (d: ResumeDoc) => void) => void;

interface Props {
  title: string;
  onTitleChange: (t: string) => void;
  doc: ResumeDoc;
  patch: Patch;
  saving: boolean;
  savedAt: number | null;
  dirty: boolean;
  onSave: () => void;
  onExit: () => void;
  onExport: () => void;
  onImportProfile: () => void;
  importing: boolean;
}

export function ResumeEditor({
  title,
  onTitleChange,
  doc,
  patch,
  saving,
  savedAt,
  dirty,
  onSave,
  onExit,
  onExport,
  onImportProfile,
  importing,
}: Props) {
  const [step, setStep] = useState<StepId>('basics');
  const [previewOpen, setPreviewOpen] = useState(false);
  const { percent, items } = useMemo(() => completeness(doc), [doc]);

  const idx = STEPS.findIndex((s) => s.id === step);
  const next = STEPS[idx + 1];
  const prev = STEPS[idx - 1];

  const SavedIndicator = (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {saving ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </>
      ) : dirty ? (
        <>
          <Cloud className="h-3.5 w-3.5" /> Unsaved changes
        </>
      ) : savedAt ? (
        <>
          <Check className="h-3.5 w-3.5 text-success" /> Saved
        </>
      ) : null}
    </span>
  );

  const renderStep = () => {
    switch (step) {
      case 'basics':
        return <BasicsEditor doc={doc} patch={patch} />;
      case 'summary':
        return <SummaryEditor doc={doc} patch={patch} />;
      case 'experience':
        return <ExperienceEditor doc={doc} patch={patch} />;
      case 'education':
        return <EducationEditor doc={doc} patch={patch} />;
      case 'skills':
        return <SkillsEditor doc={doc} patch={patch} />;
      case 'projects':
        return <ProjectsEditor doc={doc} patch={patch} />;
      case 'custom':
        return <CustomEditor doc={doc} patch={patch} />;
      case 'design':
        return <DesignPanel doc={doc} patch={patch} />;
    }
  };

  return (
    <div className="space-y-4">
      {/* top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onExit} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          All resumes
        </Button>
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Untitled resume"
          className="h-9 max-w-[240px] font-medium"
          aria-label="Resume name"
        />
        {SavedIndicator}
        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onImportProfile}
            disabled={importing}
            className="gap-1.5"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserRoundPlus className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">Import from profile</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 lg:hidden"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" />
            Preview
          </Button>
          <Button size="sm" onClick={onExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* completeness */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Resume strength</span>
          <span className="tabular-nums text-muted-foreground">{percent}%</span>
        </div>
        <Progress value={percent} className="mt-2 h-2" />
        {percent < 100 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Next: {items.find((i) => !i.done)?.label}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)_minmax(0,420px)]">
        {/* step nav */}
        <nav className="min-w-0 lg:sticky lg:top-4 lg:self-start">
          <ol className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] lg:flex-col lg:overflow-visible lg:pb-0">
            {STEPS.map((s, i) => {
              const active = s.id === step;
              const isDesign = s.id === 'design';
              return (
                <li key={s.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setStep(s.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent/50',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                        active
                          ? 'bg-primary-foreground/20'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {isDesign ? <Palette className="h-3 w-3" /> : i + 1}
                    </span>
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {/* form */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-xl border bg-card p-4 sm:p-5">
            <h3 className="mb-1 text-base font-semibold">
              {STEPS[idx].label}
            </h3>
            {step === 'basics' && (
              <p className="mb-4 text-sm text-muted-foreground">
                How employers reach you. This sits at the top of every template.
              </p>
            )}
            <div className="mt-3">{renderStep()}</div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              disabled={!prev}
              onClick={() => prev && setStep(prev.id)}
            >
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onSave} disabled={saving || !dirty}>
                Save
              </Button>
              {next ? (
                <Button onClick={() => setStep(next.id)}>Next: {next.label}</Button>
              ) : (
                <Button onClick={onExport} className="gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Finish &amp; export
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* live preview (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Live preview</span>
              <span>{doc.design.template}</span>
            </div>
            <div className="overflow-hidden rounded-lg border bg-muted/40 p-3">
              <ResumePreview doc={doc} fitWidth={380} />
            </div>
          </div>
        </aside>
      </div>

      {/* live preview (mobile sheet) */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="bottom" className="h-[90vh] p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Preview</SheetTitle>
          </SheetHeader>
          <div className="h-full overflow-auto bg-muted/40 p-4">
            <ResumePreview doc={doc} fitWidth={Math.min(760, window.innerWidth - 48)} />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
