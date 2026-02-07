import { useNavigate } from "react-router-dom";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const ProfileCompletionCard = () => {
  const navigate = useNavigate();
  const { percentage, isComplete, missingItems, isLoading } = useProfileCompletion();

  if (isLoading || isComplete) return null;

  // Take top 2 suggestions
  const suggestions = missingItems.slice(0, 2);

  return (
    <Card className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100 shadow-sm mb-6">
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
