import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  computeProfileCompletion,
  type ProfileContextValue,
} from "@/components/profile/profileTypes";

interface ProfileCompletionProps {
  ctx: ProfileContextValue;
  onEdit: () => void;
}

/**
 * Owner-only "profile strength" widget. The percentage is derived from real
 * profile fields via computeProfileCompletion() — see profileTypes.ts for the
 * weighted formula. Nothing here is hard-coded.
 */
export const ProfileCompletion = ({ ctx, onEdit }: ProfileCompletionProps) => {
  const { profile } = ctx;

  // Section presence is derived from the relational tables (Phase 2 source of
  // truth), plus the projects jsonb which remains the store for projects.
  const [counts, setCounts] = useState<{
    experience: number | null;
    education: number | null;
    skills: number | null;
  }>({ experience: null, education: null, skills: null });

  useEffect(() => {
    let active = true;
    const head = (table: "experience" | "education" | "skills") =>
      supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id);

    Promise.all([head("experience"), head("education"), head("skills")]).then(
      ([exp, edu, sk]) => {
        if (!active) return;
        setCounts({
          experience: exp.count ?? 0,
          education: edu.count ?? 0,
          skills: sk.count ?? 0,
        });
      }
    );
    return () => {
      active = false;
    };
  }, [profile.id]);

  const hasExperience = (counts.experience ?? 0) > 0;
  const hasEducation = (counts.education ?? 0) > 0;
  const hasSkills =
    (counts.skills ?? 0) > 0 ||
    (Array.isArray(profile.skills) && profile.skills.length > 0);

  const { percent, items } = useMemo(
    () =>
      computeProfileCompletion({
        profile,
        hasExperience,
        hasEducation,
        hasSkills,
      }),
    [profile, hasExperience, hasEducation, hasSkills]
  );

  const label =
    percent >= 100
      ? "All star"
      : percent >= 70
      ? "Strong"
      : percent >= 40
      ? "Intermediate"
      : "Just started";

  const nextItem = items.find((i) => !i.done);

  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          Profile strength
          <span className="text-muted-foreground font-normal">· {label}</span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              {percent}%
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-sm font-medium mb-2">Complete your profile</p>
            <ul className="space-y-1.5">
              {items.map((it) => (
                <li
                  key={it.key}
                  className="flex items-center gap-2 text-sm"
                >
                  {it.done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={
                      it.done ? "text-muted-foreground line-through" : ""
                    }
                  >
                    {it.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              Photo &amp; cover use the camera buttons on the banner. Everything
              else is in “Edit profile”.
            </p>
            <Button
              size="sm"
              className="w-full mt-2"
              onClick={onEdit}
            >
              Edit profile
            </Button>
          </PopoverContent>
        </Popover>
      </div>

      <Progress value={percent} className="h-2 mt-2" />

      {nextItem && (
        <p className="text-xs text-muted-foreground mt-2">
          Next: add your {nextItem.label.toLowerCase()}
        </p>
      )}
    </div>
  );
};

export default ProfileCompletion;
