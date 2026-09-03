import { useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  GripVertical,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { BulletEditor } from './BulletEditor';
import { PhraseDrawer } from './PhraseDrawer';
import {
  type ResumeDoc,
  type ExperienceEntry,
  type EducationEntry,
  type ProjectEntry,
  type SkillEntry,
  type CustomSection,
  emptyExperience,
  emptyEducation,
  emptyProject,
  emptySkill,
  emptyCustom,
} from '@/lib/resume/schema';
import { htmlToBullets, bulletsToHtml } from '@/lib/resume/phrases';

type Patch = (recipe: (d: ResumeDoc) => void) => void;

/* ------------------------------------------------------------------ */
/* shared list-item chrome                                             */
/* ------------------------------------------------------------------ */

function EntryShell({
  title,
  index,
  count,
  onMove,
  onRemove,
  children,
}: {
  title: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
          <span className="truncate text-sm font-medium">{title || 'Untitled'}</span>
          <div className="ml-auto flex items-center gap-0.5">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={index === 0}
              onClick={() => onMove(index, index - 1)}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              disabled={index === count - 1}
              onClick={() => onMove(index, index + 1)}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = arr.slice();
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it);
  return next;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Basics                                                              */
/* ------------------------------------------------------------------ */

export function BasicsEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const b = doc.basics;
  const set = (k: keyof typeof b, v: string) =>
    patch((d) => {
      d.basics[k] = v;
    });
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name" value={b.fullName} onChange={(v) => set('fullName', v)} placeholder="Alex Morgan" />
      <Field label="Headline" value={b.headline} onChange={(v) => set('headline', v)} placeholder="Senior Product Designer" />
      <Field label="Email" type="email" value={b.email} onChange={(v) => set('email', v)} placeholder="you@example.com" />
      <Field label="Phone" value={b.phone} onChange={(v) => set('phone', v)} placeholder="+1 512 555 0100" />
      <Field label="Location" value={b.location} onChange={(v) => set('location', v)} placeholder="Austin, TX" />
      <Field label="Website" value={b.website} onChange={(v) => set('website', v)} placeholder="alexmorgan.design" />
      <Field label="LinkedIn" value={b.linkedin} onChange={(v) => set('linkedin', v)} placeholder="linkedin.com/in/alexmorgan" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary                                                             */
/* ------------------------------------------------------------------ */

export function SummaryEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Two or three sentences: what you do, your strengths, and what you are looking for.
      </p>
      <BulletEditor
        value={doc.summary}
        onChange={(html) => patch((d) => { d.summary = html; })}
        placeholder="Results-driven product designer with 5 years' experience…"
        onOpenSuggestions={() => setOpen(true)}
      />
      <PhraseDrawer
        open={open}
        onOpenChange={setOpen}
        mode="bullets"
        context={doc.basics.headline || (doc.experience[0]?.role ?? '')}
        present={htmlToBullets(doc.summary)}
        onAdd={(text) =>
          patch((d) => {
            const cur = htmlToBullets(d.summary);
            d.summary = bulletsToHtml([...cur, text.replace('{n}', '3')]);
          })
        }
        onRemove={(text) =>
          patch((d) => {
            const cur = htmlToBullets(d.summary).filter(
              (b) => b.trim().toLowerCase() !== text.trim().toLowerCase(),
            );
            d.summary = bulletsToHtml(cur);
          })
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Experience                                                          */
/* ------------------------------------------------------------------ */

export function ExperienceEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const [drawerFor, setDrawerFor] = useState<string | null>(null);
  const rows = doc.experience;
  const setRow = (id: string, k: keyof ExperienceEntry, v: unknown) =>
    patch((d) => {
      const r = d.experience.find((x) => x.id === id);
      if (r) (r as Record<string, unknown>)[k] = v;
    });

  return (
    <div className="space-y-3">
      {rows.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add your roles, most recent first.
        </p>
      )}
      {rows.map((r, i) => (
        <EntryShell
          key={r.id}
          title={[r.role, r.company].filter(Boolean).join(' · ')}
          index={i}
          count={rows.length}
          onMove={(from, to) => patch((d) => { d.experience = move(d.experience, from, to); })}
          onRemove={() => patch((d) => { d.experience = d.experience.filter((x) => x.id !== r.id); })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Job title" value={r.role} onChange={(v) => setRow(r.id, 'role', v)} placeholder="Senior Product Designer" />
            <Field label="Company" value={r.company} onChange={(v) => setRow(r.id, 'company', v)} placeholder="Northwind Labs" />
            <Field label="Location" value={r.location} onChange={(v) => setRow(r.id, 'location', v)} placeholder="Austin, TX" />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Start" value={r.startDate} onChange={(v) => setRow(r.id, 'startDate', v)} placeholder="Mar 2024" />
              <Field
                label="End"
                value={r.current ? '' : r.endDate}
                onChange={(v) => setRow(r.id, 'endDate', v)}
                placeholder={r.current ? 'Present' : 'Jan 2026'}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={r.current}
              onCheckedChange={(c) => setRow(r.id, 'current', c === true)}
            />
            I currently work here
          </label>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">What you did</Label>
            <BulletEditor
              value={r.description}
              onChange={(html) => setRow(r.id, 'description', html)}
              onOpenSuggestions={() => setDrawerFor(r.id)}
            />
          </div>
        </EntryShell>
      ))}

      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => patch((d) => { d.experience.push(emptyExperience()); })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add position
      </Button>

      {rows.map((r) => (
        <PhraseDrawer
          key={`drawer-${r.id}`}
          open={drawerFor === r.id}
          onOpenChange={(o) => setDrawerFor(o ? r.id : null)}
          mode="bullets"
          context={r.role || doc.basics.headline}
          present={htmlToBullets(r.description)}
          onAdd={(text) =>
            setRow(r.id, 'description', bulletsToHtml([...htmlToBullets(r.description), text.replace('{n}', '3')]))
          }
          onRemove={(text) =>
            setRow(
              r.id,
              'description',
              bulletsToHtml(
                htmlToBullets(r.description).filter(
                  (b) => b.trim().toLowerCase() !== text.trim().toLowerCase(),
                ),
              ),
            )
          }
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Education                                                           */
/* ------------------------------------------------------------------ */

export function EducationEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const rows = doc.education;
  const setRow = (id: string, k: keyof EducationEntry, v: unknown) =>
    patch((d) => {
      const r = d.education.find((x) => x.id === id);
      if (r) (r as Record<string, unknown>)[k] = v;
    });
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <EntryShell
          key={r.id}
          title={[r.degree, r.school].filter(Boolean).join(' · ')}
          index={i}
          count={rows.length}
          onMove={(from, to) => patch((d) => { d.education = move(d.education, from, to); })}
          onRemove={() => patch((d) => { d.education = d.education.filter((x) => x.id !== r.id); })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="School" value={r.school} onChange={(v) => setRow(r.id, 'school', v)} placeholder="University of Texas at Austin" />
            <Field label="Degree" value={r.degree} onChange={(v) => setRow(r.id, 'degree', v)} placeholder="B.S." />
            <Field label="Field of study" value={r.field} onChange={(v) => setRow(r.id, 'field', v)} placeholder="Human-Computer Interaction" />
            <Field label="Location" value={r.location} onChange={(v) => setRow(r.id, 'location', v)} placeholder="Austin, TX" />
            <Field label="Start" value={r.startDate} onChange={(v) => setRow(r.id, 'startDate', v)} placeholder="2016" />
            <Field label="End" value={r.endDate} onChange={(v) => setRow(r.id, 'endDate', v)} placeholder="2020" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Highlights (optional)</Label>
            <BulletEditor
              value={r.description}
              onChange={(html) => setRow(r.id, 'description', html)}
              placeholder="Honours, coursework, activities…"
            />
          </div>
        </EntryShell>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => patch((d) => { d.education.push(emptyEducation()); })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add education
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export function SkillsEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const rows = doc.skills;

  const add = (name: string) => {
    const n = name.trim();
    if (!n) return;
    if (rows.some((s) => s.name.trim().toLowerCase() === n.toLowerCase())) return;
    patch((d) => { d.skills.push({ ...emptySkill(), name: n }); });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add(draft);
              setDraft('');
            }
          }}
          placeholder="Type a skill and press Enter"
        />
        <Button type="button" variant="outline" onClick={() => setOpen(true)}>
          Suggestions
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No skills yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-border/70 p-2">
              <Input
                value={r.name}
                onChange={(e) =>
                  patch((d) => {
                    const s = d.skills.find((x) => x.id === r.id);
                    if (s) s.name = e.target.value;
                  })
                }
                className="h-8 flex-1"
              />
              <div className="flex items-center gap-0.5" aria-label="Proficiency">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Set level ${n}`}
                    onClick={() =>
                      patch((d) => {
                        const s = d.skills.find((x) => x.id === r.id);
                        if (s) s.level = s.level === n ? 0 : n;
                      })
                    }
                    className="p-0.5"
                  >
                    <span
                      className={
                        'block h-2.5 w-2.5 rounded-full ' +
                        (n <= r.level ? 'bg-primary' : 'bg-muted')
                      }
                    />
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={i === 0}
                onClick={() => patch((d) => { d.skills = move(d.skills, i, i - 1); })}
                aria-label="Move up"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => patch((d) => { d.skills = d.skills.filter((x) => x.id !== r.id); })}
                aria-label="Remove skill"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <PhraseDrawer
        open={open}
        onOpenChange={setOpen}
        mode="skills"
        context={doc.basics.headline || (doc.experience[0]?.role ?? '')}
        present={rows.map((s) => s.name)}
        onAdd={add}
        onRemove={(name) =>
          patch((d) => {
            d.skills = d.skills.filter(
              (s) => s.name.trim().toLowerCase() !== name.trim().toLowerCase(),
            );
          })
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Projects                                                            */
/* ------------------------------------------------------------------ */

export function ProjectsEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const rows = doc.projects;
  const setRow = (id: string, k: keyof ProjectEntry, v: unknown) =>
    patch((d) => {
      const r = d.projects.find((x) => x.id === id);
      if (r) (r as Record<string, unknown>)[k] = v;
    });
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <EntryShell
          key={r.id}
          title={r.name}
          index={i}
          count={rows.length}
          onMove={(from, to) => patch((d) => { d.projects = move(d.projects, from, to); })}
          onRemove={() => patch((d) => { d.projects = d.projects.filter((x) => x.id !== r.id); })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" value={r.name} onChange={(v) => setRow(r.id, 'name', v)} placeholder="Design system refresh" />
            <Field label="Link" value={r.url} onChange={(v) => setRow(r.id, 'url', v)} placeholder="github.com/…" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Description</Label>
            <BulletEditor value={r.description} onChange={(html) => setRow(r.id, 'description', html)} />
          </div>
        </EntryShell>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => patch((d) => { d.projects.push(emptyProject()); })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add project
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Custom sections                                                     */
/* ------------------------------------------------------------------ */

export function CustomEditor({ doc, patch }: { doc: ResumeDoc; patch: Patch }) {
  const rows = doc.custom;
  const setRow = (id: string, k: keyof CustomSection, v: unknown) =>
    patch((d) => {
      const r = d.custom.find((x) => x.id === id);
      if (r) (r as Record<string, unknown>)[k] = v;
    });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Certifications, languages, volunteering — anything that doesn't fit the standard sections.
      </p>
      {rows.map((r, i) => (
        <EntryShell
          key={r.id}
          title={r.title}
          index={i}
          count={rows.length}
          onMove={(from, to) => patch((d) => { d.custom = move(d.custom, from, to); })}
          onRemove={() => patch((d) => { d.custom = d.custom.filter((x) => x.id !== r.id); })}
        >
          <Field label="Section title" value={r.title} onChange={(v) => setRow(r.id, 'title', v)} placeholder="Certifications" />
          <BulletEditor value={r.body} onChange={(html) => setRow(r.id, 'body', html)} />
        </EntryShell>
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        onClick={() => patch((d) => { d.custom.push(emptyCustom()); })}
      >
        <Plus className="mr-2 h-4 w-4" />
        Add section
      </Button>
    </div>
  );
}
