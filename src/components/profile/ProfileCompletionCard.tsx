import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, X, EyeOff, Clock, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";

export const ProfileCompletionCard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { percentage, isComplete, missingItems, isLoading } = useProfileCompletion();
  const [sessionHidden, setSessionHidden] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showSkillDialog, setShowSkillDialog] = useState(false);
  const [showEducationDialog, setShowEducationDialog] = useState(false);
  const [savingSkill, setSavingSkill] = useState(false);
  const [savingEducation, setSavingEducation] = useState(false);
  const [skillName, setSkillName] = useState("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "expert" | "">("");
  const [skillYears, setSkillYears] = useState<string>("");
  const [eduInstitution, setEduInstitution] = useState("");
  const [eduDegree, setEduDegree] = useState("");
  const [eduField, setEduField] = useState("");
  const [eduStartYear, setEduStartYear] = useState<string>("");
  const [eduEndYear, setEduEndYear] = useState<string>("");
  const [eduIsCurrent, setEduIsCurrent] = useState(false);

  // Preferences and dismissal timestamp
  const preferences = profile?.preferences as Record<string, any> | null;
  const isPermanentlyHidden = preferences?.hide_profile_strength === true;
  const dismissedAtIso = (profile as any)?.profile_strength_dismissed_at as string | null | undefined;

  // Dynamic reminder frequency (optional upgrade)
  const reminderDays = useMemo(() => {
    if (percentage >= 100) return Infinity; // disable
    if (percentage < 50) return 3;
    if (percentage <= 75) return 7;
    if (percentage <= 90) return 14;
    return 7;
  }, [percentage]);

  const shouldShow = useMemo(() => {
    if (!user) return false;
    if (isLoading) return false;
    if (isPermanentlyHidden) return false;
    if (percentage >= 100) return false;
    // New user or never dismissed → show
    if (!dismissedAtIso) return true;
    // Show again if interval passed
    const last = Date.parse(dismissedAtIso);
    if (isNaN(last)) return true;
    const now = Date.now();
    const diffDays = (now - last) / (1000 * 60 * 60 * 24);
    return diffDays >= reminderDays;
  }, [user, isLoading, isPermanentlyHidden, percentage, dismissedAtIso, reminderDays]);

  // Hide if loading or session-hidden, or global conditions say not to show
  if (isLoading || sessionHidden || !shouldShow) {
    return null;
  }

  // Take top 2 suggestions
  const suggestions = missingItems.slice(0, 2);

  const hideWithAnimation = (callback: () => void) => {
    setIsExiting(true);
    setTimeout(() => {
      callback();
    }, 200); // 200ms soft fade
  };

  const handleHideForNow = async () => {
    if (!user) return;
    const nowIso = new Date().toISOString();
    hideWithAnimation(async () => {
      setSessionHidden(true);
      try {
        await supabase
          .from('profiles')
          .update({ profile_strength_dismissed_at: nowIso } as any)
          .eq('user_id', user.id);
        toast.info("Hidden for now");
      } catch {
        // silent; sessionHidden still prevents flicker
      }
    });
  };

  const handleDontShowAgain = async () => {
    if (!user) return;
    
    hideWithAnimation(async () => {
      // Optimistic update
      setSessionHidden(true);

      try {
        const currentPrefs = (profile?.preferences as Record<string, any>) || {};
        const updatedPrefs = {
          ...currentPrefs,
          hide_profile_strength: true
        };

        const { error } = await supabase
          .from('profiles')
          .update({ preferences: updatedPrefs } as any)
          .eq('user_id', user.id);

        if (error) throw error;
        
        toast.success("Preference saved. We won't show this again.");
      } catch (error) {
        toast.error("Failed to save preference");
        setSessionHidden(false); // Revert on error
      }
    });
  };

  const persistStrengthWithDelta = async (delta: number) => {
    if (!user) return;
    const next = Math.max(0, Math.min(100, percentage + delta));
    try {
      await supabase.from('profiles').update({ profile_strength: next } as any).eq('user_id', user.id);
    } catch {
      // silent
    }
  };

  const onAddSkill = async () => {
    if (!user) return;
    if (!skillName.trim() || !skillLevel) {
      toast.error("Please fill required fields");
      return;
    }
    setSavingSkill(true);
    try {
      const { error } = await supabase
        .from('user_skills')
        .insert({
          user_id: user.id,
          skill_name: skillName.trim(),
          level: skillLevel,
          years: skillYears ? parseInt(skillYears, 10) || null : null
        } as any);
      if (error) {
        // Unique violation or duplicate
        if ((error as any).code === '23505') {
          toast.info("Skill already exists");
          return;
        }
        throw error;
      }
      toast.success("Skill added successfully");
      setShowSkillDialog(false);
      setSkillName("");
      setSkillLevel("");
      setSkillYears("");
      queryClient.invalidateQueries({ queryKey: ['profile-completion-counts', user.id] });
      persistStrengthWithDelta(15);
    } catch {
      toast.error("Failed to add skill");
    } finally {
      setSavingSkill(false);
    }
  };

  const onAddEducation = async () => {
    if (!user) return;
    if (!eduInstitution.trim()) {
      toast.error("Please provide institution");
      return;
    }
    setSavingEducation(true);
    try {
      const payload: any = {
        user_id: user.id,
        institution: eduInstitution.trim(),
        degree: eduDegree.trim() || null,
        field: eduField.trim() || null,
        start_year: eduStartYear ? parseInt(eduStartYear, 10) || null : null,
        end_year: eduIsCurrent ? null : (eduEndYear ? parseInt(eduEndYear, 10) || null : null),
        is_current: !!eduIsCurrent
      };
      const { error } = await supabase
        .from('user_education')
        .insert(payload);
      if (error) throw error;
      toast.success("Education added");
      setShowEducationDialog(false);
      setEduInstitution("");
      setEduDegree("");
      setEduField("");
      setEduStartYear("");
      setEduEndYear("");
      setEduIsCurrent(false);
      queryClient.invalidateQueries({ queryKey: ['profile-completion-counts', user.id] });
      persistStrengthWithDelta(10);
    } catch {
      toast.error("Failed to add education");
    } finally {
      setSavingEducation(false);
    }
  };

  return (
    <>
    <Card className={cn(
      "w-full bg-gradient-to-r from-blue-50/50 to-indigo-50/50 border-0 sm:border border-gray-100 shadow-none sm:shadow-card mb-4 sm:mb-6 rounded-none sm:rounded-[2rem] relative group transition-all duration-300",
      isExiting ? "opacity-0 -translate-y-4 pointer-events-none" : "animate-in fade-in slide-in-from-top-4"
    )}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-600 hover:bg-blue-100/50">
              <X className="h-4 w-4" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleHideForNow}>
              <Clock className="mr-2 h-4 w-4" />
              <span>Hide for now</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleDontShowAgain}>
              <EyeOff className="mr-2 h-4 w-4" />
              <span>Don't show again</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-blue-900">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Profile Strength: {percentage}%
          </CardTitle>
          <div className="flex flex-col items-end">
            <span className="text-sm text-blue-600 font-medium">
              {percentage < 50 ? "Beginner" : percentage < 80 ? "Intermediate" : percentage < 100 ? "Expert" : "Completed"}
            </span>
            {dismissedAtIso && (
              <span className="text-xs text-blue-500/80 mt-1">
                Reminder to complete your profile
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-6 sm:px-8 sm:pb-8 space-y-4">
        <Progress value={percentage} className="h-2 bg-blue-200" />
        
        <div className="space-y-3">
          <p className="text-sm text-blue-800 font-medium">
            Complete these steps to get noticed:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((item) => {
              const handleClick = () => {
                if (item.id === 'skills') {
                  setShowSkillDialog(true);
                } else if (item.id === 'education') {
                  setShowEducationDialog(true);
                } else {
                  navigate(item.actionUrl);
                }
              };
              return (
                <Button
                  key={item.id}
                  variant="outline"
                  className="justify-between bg-white/80 hover:bg-white border-blue-200 text-blue-900 hover:text-blue-700 h-auto py-3 group"
                  onClick={handleClick}
                >
                  <span className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-400 group-hover:bg-blue-600 transition-colors" />
                    {item.actionLabel}
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                </Button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
    <SkillDialog
      open={showSkillDialog}
      onOpenChange={setShowSkillDialog}
      skillName={skillName}
      setSkillName={setSkillName}
      skillLevel={skillLevel}
      setSkillLevel={setSkillLevel}
      skillYears={skillYears}
      setSkillYears={setSkillYears}
      onSubmit={onAddSkill}
      saving={savingSkill}
    />
    <EducationDialog
      open={showEducationDialog}
      onOpenChange={setShowEducationDialog}
      institution={eduInstitution}
      setInstitution={setEduInstitution}
      degree={eduDegree}
      setDegree={setEduDegree}
      field={eduField}
      setField={setEduField}
      startYear={eduStartYear}
      setStartYear={setEduStartYear}
      endYear={eduEndYear}
      setEndYear={setEduEndYear}
      isCurrent={eduIsCurrent}
      setIsCurrent={setEduIsCurrent}
      onSubmit={onAddEducation}
      saving={savingEducation}
    />
    </>
  );
};

// Skill Dialog
export const SkillDialog = ({
  open,
  onOpenChange,
  skillName,
  setSkillName,
  skillLevel,
  setSkillLevel,
  skillYears,
  setSkillYears,
  onSubmit,
  saving
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skillName: string;
  setSkillName: (v: string) => void;
  skillLevel: "" | "beginner" | "intermediate" | "expert";
  setSkillLevel: (v: "" | "beginner" | "intermediate" | "expert") => void;
  skillYears: string;
  setSkillYears: (v: string) => void;
  onSubmit: () => void;
  saving: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
      <div className="h-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
      <div className="p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-[#1D2226]">Add Skill</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Skill name</Label>
            <Input value={skillName} onChange={(e) => setSkillName(e.target.value)} placeholder="e.g. React" />
          </div>
          <div className="space-y-2">
            <Label>Experience level</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['beginner','intermediate','expert'] as const).map(l => (
                <Button key={l} type="button" variant={skillLevel===l?'default':'outline'} onClick={() => setSkillLevel(l)} className="h-10">
                  {l.charAt(0).toUpperCase()+l.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Years of experience (optional)</Label>
            <Input value={skillYears} onChange={(e) => setSkillYears(e.target.value)} inputMode="numeric" placeholder="e.g. 3" />
          </div>
          <Button onClick={onSubmit} disabled={saving} className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Plus className="mr-2 h-4 w-4" /> Save Skill</>}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);

// Education Dialog
export const EducationDialog = ({
  open,
  onOpenChange,
  institution,
  setInstitution,
  degree,
  setDegree,
  field,
  setField,
  startYear,
  setStartYear,
  endYear,
  setEndYear,
  isCurrent,
  setIsCurrent,
  onSubmit,
  saving
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  institution: string;
  setInstitution: (v: string) => void;
  degree: string;
  setDegree: (v: string) => void;
  field: string;
  setField: (v: string) => void;
  startYear: string;
  setStartYear: (v: string) => void;
  endYear: string;
  setEndYear: (v: string) => void;
  isCurrent: boolean;
  setIsCurrent: (v: boolean) => void;
  onSubmit: () => void;
  saving: boolean;
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
      <div className="h-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
      <div className="p-6 sm:p-8">
        <DialogHeader className="mb-4">
          <DialogTitle className="text-2xl font-bold text-[#1D2226]">Add Education</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>School / College name</Label>
            <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. Stanford University" />
          </div>
          <div className="space-y-2">
            <Label>Degree</Label>
            <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. B.Sc" />
          </div>
          <div className="space-y-2">
            <Label>Field of study</Label>
            <Input value={field} onChange={(e) => setField(e.target.value)} placeholder="e.g. Computer Science" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start year</Label>
              <Input value={startYear} onChange={(e) => setStartYear(e.target.value)} inputMode="numeric" placeholder="e.g. 2020" />
            </div>
            <div className="space-y-2">
              <Label>End year</Label>
              <Input value={endYear} onChange={(e) => setEndYear(e.target.value)} inputMode="numeric" placeholder="e.g. 2024" disabled={isCurrent} />
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox id="current" checked={isCurrent} onCheckedChange={(v) => setIsCurrent(!!v)} />
            <Label htmlFor="current">Currently studying</Label>
          </div>
          <Button onClick={onSubmit} disabled={saving} className="w-full h-12 rounded-2xl bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Plus className="mr-2 h-4 w-4" /> Save Education</>}
          </Button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
