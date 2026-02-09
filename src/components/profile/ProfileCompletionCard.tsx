import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, X, EyeOff, Clock } from "lucide-react";
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

export const ProfileCompletionCard = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { percentage, isComplete, missingItems, isLoading } = useProfileCompletion();
  const [sessionHidden, setSessionHidden] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Check if hidden by preference
  // Cast preferences to any to access the property safely
  const preferences = profile?.preferences as Record<string, any> | null;
  const isPermanentlyHidden = preferences?.hide_profile_strength === true;

  // Logic: Hide if loading, complete, >80%, hidden for session, or hidden permanently
  if (isLoading || isComplete || percentage >= 80 || sessionHidden || isPermanentlyHidden) {
    return null;
  }

  // Take top 2 suggestions
  const suggestions = missingItems.slice(0, 2);

  const hideWithAnimation = (callback: () => void) => {
    setIsExiting(true);
    setTimeout(() => {
      callback();
    }, 300); // Match duration-300
  };

  const handleHideForNow = () => {
    hideWithAnimation(() => {
      setSessionHidden(true);
      toast.info("Profile strength card hidden for this session");
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
          .update({ preferences: updatedPrefs })
          .eq('id', user.id);

        if (error) throw error;
        
        toast.success("Preference saved. We won't show this again.");
      } catch (error) {
        console.error("Error updating preferences:", error);
        toast.error("Failed to save preference");
        setSessionHidden(false); // Revert on error
      }
    });
  };

  return (
    <Card className={cn(
      "w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 shadow-sm mb-6 relative group transition-all duration-300",
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

      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-blue-900">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Profile Strength: {percentage}%
          </CardTitle>
          <span className="text-sm text-blue-600 font-medium">
            {percentage < 50 ? "Beginner" : percentage < 80 ? "Intermediate" : "Expert"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percentage} className="h-2 bg-blue-200" />
        
        <div className="space-y-3">
          <p className="text-sm text-blue-800 font-medium">
            Complete these steps to get noticed:
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestions.map((item) => (
              <Button
                key={item.id}
                variant="outline"
                className="justify-between bg-white/80 hover:bg-white border-blue-200 text-blue-900 hover:text-blue-700 h-auto py-3 group"
                onClick={() => navigate(item.actionUrl)}
              >
                <span className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-400 group-hover:bg-blue-600 transition-colors" />
                  {item.actionLabel}
                </span>
                <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
