import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThumbsUp, Trash2 } from "lucide-react";

interface Skill {
  id: string;
  skill_name: string;
  endorsement_count: number;
  has_endorsed: boolean;
  proficiency?: string;
}

interface VisualSkillsProps {
  skills: Skill[];
  isOwnProfile: boolean;
  onEndorse: (skill: Skill) => void;
  onDelete: (skillId: string) => void;
}

export const VisualSkills = ({ 
  skills, 
  isOwnProfile, 
  onEndorse, 
  onDelete,
}: VisualSkillsProps) => {
  const safeSkills = skills || [];

  const getLevelColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'expert': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'advanced': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'intermediate': return 'bg-green-100 text-green-700 border-green-200';
      case 'beginner': return 'bg-gray-100 text-gray-600 border-gray-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const formatProficiency = (level?: string) => {
    if (!level) return null;
    return level.charAt(0).toUpperCase() + level.slice(1).toLowerCase();
  };

  const SkillChip = ({ skill }: { skill: Skill }) => (
    <div className="relative group flex items-center gap-2 px-3 py-2 rounded-lg border bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all duration-200">
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">
            {skill.skill_name}
          </span>
          {skill.proficiency && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold tracking-wider ${getLevelColor(skill.proficiency)}`}>
              {formatProficiency(skill.proficiency)}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 ml-2 pl-2 border-l border-gray-200/50">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-1.5 gap-1 text-xs hover:bg-transparent ${skill.has_endorsed ? 'text-primary font-medium' : 'text-muted-foreground'}`}
                onClick={() => onEndorse(skill)}
                disabled={isOwnProfile}
              >
                <ThumbsUp className={`h-3 w-3 ${skill.has_endorsed ? 'fill-current' : ''}`} />
                {skill.endorsement_count > 0 && skill.endorsement_count}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isOwnProfile ? "Endorsements" : (skill.has_endorsed ? "Remove endorsement" : "Endorse this skill")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {isOwnProfile && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-50"
              onClick={() => onDelete(skill.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  if (safeSkills.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No skills added yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {safeSkills.map(skill => (
          <SkillChip key={skill.id} skill={skill} />
        ))}
      </div>
    </div>
  );
};