import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CareerFormDialog } from "@/components/profile/CareerFormDialog";
import {
  LANGUAGE_PROFICIENCIES,
  PROFICIENCY_LABEL,
  type LanguageProficiency,
  type LanguageRow,
} from "@/components/profile/careerTypes";

const schema = z.object({
  name: z.string().trim().min(1, "Language is required").max(80),
  proficiency: z.enum(LANGUAGE_PROFICIENCIES),
});

type FormValues = z.infer<typeof schema>;

interface LanguageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId: string;
  existing?: LanguageRow | null;
  onSaved: () => void;
}

function toDefaults(l?: LanguageRow | null): FormValues {
  return {
    name: l?.name ?? "",
    proficiency: (l?.proficiency as LanguageProficiency) ?? "professional_working",
  };
}

export const LanguageDialog = ({
  open,
  onOpenChange,
  profileId,
  existing,
  onSaved,
}: LanguageDialogProps) => {
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

  const proficiency = watch("proficiency");

  const onValid = async (v: FormValues) => {
    try {
      if (existing) {
        const { error } = await supabase
          .from("languages")
          .update({ name: v.name.trim(), proficiency: v.proficiency })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("languages").insert({
          user_id: profileId,
          name: v.name.trim(),
          proficiency: v.proficiency,
        });
        if (error) {
          if ((error as { code?: string }).code === "23505") {
            toast({
              title: "Already added",
              description: `“${v.name.trim()}” is already in your languages.`,
              variant: "destructive",
            });
            return;
          }
          throw error;
        }
      }
      toast({ title: existing ? "Language updated" : "Language added" });
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Couldn’t save language",
        description: err instanceof Error ? err.message : "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <CareerFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={existing ? "Edit language" : "Add language"}
      isDirty={isDirty}
      saving={isSubmitting}
      onSubmit={handleSubmit(onValid)}
      submitLabel={existing ? "Save changes" : "Add"}
    >
      <div>
        <Label htmlFor="lang-name">Language</Label>
        <Input id="lang-name" {...register("name")} placeholder="e.g. English" />
        {errors.name && (
          <p className="text-xs text-destructive mt-1">{errors.name.message}</p>
        )}
      </div>
      <div>
        <Label htmlFor="lang-prof">Proficiency</Label>
        <Select
          value={proficiency}
          onValueChange={(val) =>
            setValue("proficiency", val as LanguageProficiency, { shouldDirty: true })
          }
        >
          <SelectTrigger id="lang-prof">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGE_PROFICIENCIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PROFICIENCY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </CareerFormDialog>
  );
};

export default LanguageDialog;
