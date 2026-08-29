import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CareerFormDialog } from "@/components/profile/CareerFormDialog";
import type { ProjectEntry } from "@/components/profile/careerTypes";

const schema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(140),
    description: z.string().trim().max(3000).optional().or(z.literal("")),
    url: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) => v === "" || /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}([/?#].*)?$/i.test(v),
        "Enter a valid URL"
      )
      .optional()
      .or(z.literal("")),
    start_date: z.string().optional().or(z.literal("")),
    end_date: z.string().optional().or(z.literal("")),
    is_ongoing: z.boolean(),
    skills: z.string().max(400).optional().or(z.literal("")),
  })
  .refine(
    (v) => v.is_ongoing || !v.start_date || !v.end_date || v.end_date >= v.start_date,
    { message: "End date can’t be before the start date", path: ["end_date"] }
  );

type FormValues = z.infer<typeof schema>;

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** profiles.user_id — target row for profiles.update() */
  profileUserId: string;
  /** current projects array (source of truth: profiles.projects jsonb) */
  projects: ProjectEntry[];
  existing?: ProjectEntry | null;
  onSaved: (next: ProjectEntry[]) => void;
}

function toDefaults(p?: ProjectEntry | null): FormValues {
  return {
    title: p?.title ?? "",
    description: p?.description ?? "",
    url: p?.url ?? "",
    start_date: p?.start_date ?? "",
    end_date: p?.end_date ?? "",
    is_ongoing: Boolean(p?.is_ongoing),
    skills: (p?.skills ?? []).join(", "),
  };
}

export const ProjectDialog = ({
  open,
  onOpenChange,
  profileUserId,
  projects,
  existing,
  onSaved,
}: ProjectDialogProps) => {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(existing),
  });

  useEffect(() => {
    if (open) reset(toDefaults(existing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const isOngoing = watch("is_ongoing");

  const onValid = async (v: FormValues) => {
    const norm = (s?: string) => {
      const t = (s ?? "").trim();
      return t.length ? t : undefined;
    };
    const entry: ProjectEntry = {
      id: existing?.id ?? crypto.randomUUID(),
      title: v.title.trim(),
      description: norm(v.description),
      url: norm(v.url),
      start_date: norm(v.start_date),
      end_date: v.is_ongoing ? undefined : norm(v.end_date),
      is_ongoing: v.is_ongoing,
      skills: (v.skills ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    };

    const next = existing
      ? projects.map((p) => (p.id === existing.id ? entry : p))
      : [...projects, entry];

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ projects: next })
        .eq("user_id", profileUserId);
      if (error) throw error;

      toast({ title: existing ? "Project updated" : "Project added" });
      onSaved(next);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t save project",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  const fieldErr = (n: keyof FormValues) =>
    errors[n] ? (
      <p className="text-xs text-destructive mt-1">{errors[n]?.message as string}</p>
    ) : null;

  return (
    <CareerFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit project" : "Add project"}
      isDirty={isDirty}
      saving={isSubmitting}
      onSubmit={handleSubmit(onValid)}
      submitLabel={existing ? "Save changes" : "Add"}
    >
      <div>
        <Label htmlFor="proj-title">Title</Label>
        <Input id="proj-title" {...register("title")} placeholder="Project name" />
        {fieldErr("title")}
      </div>
      <div>
        <Label htmlFor="proj-url">URL</Label>
        <Input id="proj-url" {...register("url")} placeholder="https://…" />
        {fieldErr("url")}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="proj-start">Start date</Label>
          <Input id="proj-start" type="date" {...register("start_date")} />
          {fieldErr("start_date")}
        </div>
        <div>
          <Label htmlFor="proj-end">End date</Label>
          <Input
            id="proj-end"
            type="date"
            {...register("end_date")}
            disabled={isOngoing}
          />
          {fieldErr("end_date")}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={isOngoing}
          onCheckedChange={(c) => {
            const val = c === true;
            setValue("is_ongoing", val, { shouldDirty: true });
            if (val) setValue("end_date", "", { shouldDirty: true });
          }}
        />
        This project is ongoing
      </label>
      <div>
        <Label htmlFor="proj-skills">Skills / technologies</Label>
        <Input
          id="proj-skills"
          {...register("skills")}
          placeholder="Comma separated, e.g. React, PostgreSQL"
        />
        {fieldErr("skills")}
      </div>
      <div>
        <Label htmlFor="proj-desc">Description</Label>
        <Textarea
          id="proj-desc"
          rows={4}
          {...register("description")}
          placeholder="What the project does and your role…"
        />
        {fieldErr("description")}
      </div>
    </CareerFormDialog>
  );
};

export default ProjectDialog;
