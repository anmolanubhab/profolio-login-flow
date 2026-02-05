import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Star, ThumbsUp, Trash2, Trophy } from "lucide-react";

interface Skill {
  id: string;
  skill_name: string;
  endorsement_count: number;
  has_endorsed: boolean;
  level?: string; // Beginner, Pro, Expert
  is_top?: boolean;
}

interface VisualSkillsProps {
  skills: Skill[];
  isOwnProfile: boolean;
  onEndorse: (skillId: string) => void;
  onDelete: (skillId: string) => void;
  onToggleTop?: (skillId: string, isTop: boolean) => void;
}

export const VisualSkills = ({ 
  skills, 
  isOwnProfile, 
  onEndorse, 
  onDelete,
  onToggleTop 
}: VisualSkillsProps) => {
  const topSkills = skills.filter(s => s.is_top);
  const otherSkills = skills.filter(s => !s.is_top);

  const getLevelColor = (level?: string) => {
    switch (level?.toLowerCase()) {
      case 'expert': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'pro': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'beginner': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const SkillChip = ({ skill, isTop = false }: { skill: Skill, isTop?: boolean }) => (
    <div className={`
      relative group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
      ${isTop 
        ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-sm' 
        : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}
    `}>
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          {isTop && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
          <span className={`font-medium ${isTop ? 'text-amber-900' : 'text-gray-700'}`}>
            {skill.skill_name}
          </span>
          {skill.level && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-semibold tracking-wider ${getLevelColor(skill.level)}`}>
              {skill.level}
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
                onClick={() => onEndorse(skill.id)}
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
            {onToggleTop && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={`h-6 w-6 ${skill.is_top ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'}`}
                      onClick={() => onToggleTop(skill.id, !skill.is_top)}
                    >
                      <Star className={`h-3.5 w-3.5 ${skill.is_top ? 'fill-current' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {skill.is_top ? "Remove from Top Skills" : "Add to Top Skills"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
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

  if (skills.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No skills added yet.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {topSkills.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" />
            Top Expertise
          </h3>
          <div className="flex flex-wrap gap-3">
            {topSkills.map(skill => (
              <SkillChip key={skill.id} skill={skill} isTop={true} />
            ))}
          </div>
        </div>
      )}

      {otherSkills.length > 0 && (
        <div className="space-y-3">
          {topSkills.length > 0 && (
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              Other Skills
            </h3>
          )}
          <div className="flex flex-wrap gap-2">
            {otherSkills.map(skill => (
              <SkillChip key={skill.id} skill={skill} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
