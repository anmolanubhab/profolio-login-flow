import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CareerFormDialog } from "@/components/profile/CareerFormDialog";
import type { EducationRow } from "@/components/profile/careerTypes";

const schema = z
  .object({
    institution: z.string().trim().min(1, "School is required").max(150),
    degree: z.string().trim().max(120).optional().or(z.literal("")),
    field_of_study: z.string().trim().max(120).optional().or(z.literal("")),
    start_date: z.string().optional().or(z.literal("")),
    end_date: z.string().optional().or(z.literal("")),
    grade: z.string().trim().max(60).optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (v) => !v.start_date || !v.end_date || v.end_date >= v.start_date,
    { message: "End date can’t be before the start date", path: ["end_date"] }
  );

type FormValues = z.infer<typeof schema>;

interface EducationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  existing?: EducationRow | null;
  onSaved: () => void;
}

function toDefaults(e?: EducationRow | null): FormValues {
  return {
    institution: e?.institution ?? "",
    degree: e?.degree ?? "",
    field_of_study: e?.field_of_study ?? "",
    start_date: e?.start_date ?? "",
    end_date: e?.end_date ?? "",
    grade: e?.grade ?? "",
    description: e?.description ?? "",
  };
}

export const EducationDialog = ({
  open,
  onOpenChange,
  profileId,
  existing,
  onSaved,
}: EducationDialogProps) => {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: toDefaults(existing),
  });

  useEffect(() => {
    if (open) reset(toDefaults(existing));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id]);

  const onValid = async (v: FormValues) => {
    const norm = (s?: string) => {
      const t = (s ?? "").trim();
      return t.length ? t : null;
    };
    const payload = {
      user_id: profileId,
      institution: v.institution.trim(),
      degree: norm(v.degree),
      field_of_study: norm(v.field_of_study),
      start_date: norm(v.start_date),
      end_date: norm(v.end_date),
      grade: norm(v.grade),
      description: norm(v.description),
    };

    try {
      if (existing) {
        const { error } = await supabase
          .from("education")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("education").insert(payload);
        if (error) throw error;
      }
      toast({ title: existing ? "Education updated" : "Education added" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t save education",
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
      title={existing ? "Edit education" : "Add education"}
      isDirty={isDirty}
      saving={isSubmitting}
      onSubmit={handleSubmit(onValid)}
      submitLabel={existing ? "Save changes" : "Add"}
    >
      <div>
        <Label htmlFor="edu-inst">School</Label>
        <Input id="edu-inst" {...register("institution")} placeholder="e.g. University of…" />
        {fieldErr("institution")}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edu-degree">Degree</Label>
          <Input id="edu-degree" {...register("degree")} placeholder="e.g. B.Sc." />
          {fieldErr("degree")}
        </div>
        <div>
          <Label htmlFor="edu-field">Field of study</Label>
          <Input id="edu-field" {...register("field_of_study")} placeholder="e.g. Computer Science" />
          {fieldErr("field_of_study")}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="edu-start">Start date</Label>
          <Input id="edu-start" type="date" {...register("start_date")} />
          {fieldErr("start_date")}
        </div>
        <div>
          <Label htmlFor="edu-end">End date (or expected)</Label>
          <Input id="edu-end" type="date" {...register("end_date")} />
          {fieldErr("end_date")}
        </div>
      </div>
      <div>
        <Label htmlFor="edu-grade">Grade</Label>
        <Input id="edu-grade" {...register("grade")} placeholder="e.g. 3.8 GPA / First class" />
        {fieldErr("grade")}
      </div>
      <div>
        <Label htmlFor="edu-desc">Description</Label>
        <Textarea
          id="edu-desc"
          rows={4}
          {...register("description")}
          placeholder="Activities, societies, achievements…"
        />
        {fieldErr("description")}
      </div>
    </CareerFormDialog>
  );
};

export default EducationDialog;
