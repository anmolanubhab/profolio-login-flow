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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CareerFormDialog } from "@/components/profile/CareerFormDialog";
import { EMPLOYMENT_TYPES, type ExperienceRow } from "@/components/profile/careerTypes";

const schema = z
  .object({
    role: z.string().trim().min(1, "Title is required").max(120),
    company: z.string().trim().min(1, "Company is required").max(120),
    employment_type: z.string().max(40).optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    start_date: z.string().min(1, "Start date is required"),
    is_current: z.boolean(),
    end_date: z.string().optional().or(z.literal("")),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
  })
  .refine(
    (v) => v.is_current || !v.end_date || v.end_date >= v.start_date,
    { message: "End date can’t be before the start date", path: ["end_date"] }
  );

type FormValues = z.infer<typeof schema>;

interface ExperienceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** profiles.id of the owner */
  profileId: string;
  existing?: ExperienceRow | null;
  onSaved: () => void;
}

function toDefaults(e?: ExperienceRow | null): FormValues {
  return {
    role: e?.role ?? "",
    company: e?.company ?? "",
    employment_type: e?.employment_type ?? "",
    location: e?.location ?? "",
    start_date: e?.start_date ?? "",
    is_current: Boolean(e?.is_current),
    end_date: e?.end_date ?? "",
    description: e?.description ?? "",
  };
}

export const ExperienceDialog = ({
  open,
  onOpenChange,
  profileId,
  existing,
  onSaved,
}: ExperienceDialogProps) => {
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

  const isCurrent = watch("is_current");
  const employmentType = watch("employment_type") ?? "";

  const onValid = async (v: FormValues) => {
    const norm = (s?: string) => {
      const t = (s ?? "").trim();
      return t.length ? t : null;
    };
    const payload = {
      user_id: profileId,
      role: v.role.trim(),
      company: v.company.trim(),
      employment_type: norm(v.employment_type),
      location: norm(v.location),
      start_date: v.start_date,
      end_date: v.is_current ? null : norm(v.end_date),
      is_current: v.is_current,
      description: norm(v.description),
    };

    try {
      if (existing) {
        const { error } = await supabase
          .from("experience")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("experience").insert(payload);
        if (error) throw error;
      }
      toast({ title: existing ? "Experience updated" : "Experience added" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t save experience",
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
      title={existing ? "Edit experience" : "Add experience"}
      isDirty={isDirty}
      saving={isSubmitting}
      onSubmit={handleSubmit(onValid)}
      submitLabel={existing ? "Save changes" : "Add"}
    >
      <div>
        <Label htmlFor="exp-role">Title</Label>
        <Input id="exp-role" {...register("role")} placeholder="e.g. Product Designer" />
        {fieldErr("role")}
      </div>
      <div>
        <Label htmlFor="exp-company">Company</Label>
        <Input id="exp-company" {...register("company")} placeholder="e.g. Acme Inc." />
        {fieldErr("company")}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="exp-emptype">Employment type</Label>
          <Select
            value={employmentType}
            onValueChange={(val) =>
              setValue("employment_type", val, { shouldDirty: true })
            }
          >
            <SelectTrigger id="exp-emptype">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="exp-location">Location</Label>
          <Input id="exp-location" {...register("location")} placeholder="City, Country" />
          {fieldErr("location")}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="exp-start">Start date</Label>
          <Input id="exp-start" type="date" {...register("start_date")} />
          {fieldErr("start_date")}
        </div>
        <div>
          <Label htmlFor="exp-end">End date</Label>
          <Input
            id="exp-end"
            type="date"
            {...register("end_date")}
            disabled={isCurrent}
          />
          {fieldErr("end_date")}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={isCurrent}
          onCheckedChange={(c) => {
            const val = c === true;
            setValue("is_current", val, { shouldDirty: true });
            if (val) setValue("end_date", "", { shouldDirty: true });
          }}
        />
        I currently work here
      </label>
      <div>
        <Label htmlFor="exp-desc">Description</Label>
        <Textarea
          id="exp-desc"
          rows={4}
          {...register("description")}
          placeholder="What you did, tools, impact…"
        />
        {fieldErr("description")}
      </div>
    </CareerFormDialog>
  );
};

export default ExperienceDialog;
