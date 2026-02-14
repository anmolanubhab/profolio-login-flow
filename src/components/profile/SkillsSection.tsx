import { useState, useEffect } from 'react';
import { Plus, X, ThumbsUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VisualSkills } from './redesign/VisualSkills';
import { useAuth } from '@/contexts/AuthContext';

interface Skill {
  id: string;
  skill_name: string;
  endorsement_count: number;
  has_endorsed: boolean;
  proficiency?: string;
}

interface SkillsSectionProps {
  userId: string;
  profileId: string;
  isOwnProfile?: boolean;
}

const SkillsSection = ({ userId, profileId, isOwnProfile = false }: SkillsSectionProps) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('beginner');
  const [saving, setSaving] = useState(false);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { toast } = useToast();
  const { user, profile: authProfile } = useAuth();

  useEffect(() => {
    if (authProfile) {
      setCurrentProfileId(authProfile.id);
    }
  }, [authProfile]);

  useEffect(() => {
    if (profileId) {
      fetchSkills();
      if (!isOwnProfile) {
        checkConnection();
      }
    }
  }, [profileId, currentProfileId]);

  const checkConnection = async () => {
    if (!currentProfileId || !profileId) return;
    
    const { data } = await supabase
      .from('connections')
      .select('id')
      .or(`and(user_id.eq.${currentProfileId},connection_id.eq.${profileId}),and(user_id.eq.${profileId},connection_id.eq.${currentProfileId})`)
      .eq('status', 'accepted')
      .maybeSingle();
    
    setIsConnected(!!data);
  };

  const fetchSkills = async () => {
    try {
      // Fetch skills from the skills table - only columns that exist
      const { data: skillsData, error: skillsError } = await supabase
        .from('skills')
        .select('id, skill_name, proficiency, years_of_experience')
        .eq('user_id', profileId);

      if (skillsError) throw skillsError;

      if (!skillsData || skillsData.length === 0) {
        setSkills([]);
        setLoading(false);
        return;
      }

      // Fetch endorsement counts and check if current user has endorsed
      const skillsWithEndorsements = await Promise.all(
        skillsData.map(async (skill) => {
          const { count } = await supabase
            .from('skill_endorsements')
            .select('*', { count: 'exact', head: true })
            .eq('skill_id', skill.id);

          let hasEndorsed = false;
          if (currentProfileId) {
            const { data: endorsement } = await supabase
              .from('skill_endorsements')
              .select('id')
              .eq('skill_id', skill.id)
              .eq('endorser_id', currentProfileId)
              .maybeSingle();
            hasEndorsed = !!endorsement;
          }

          return {
            id: skill.id,
            skill_name: skill.skill_name,
            endorsement_count: count || 0,
            has_endorsed: hasEndorsed,
            proficiency: skill.proficiency || 'beginner',
          };
        })
      );

      // Sort by endorsement count (highest first)
      skillsWithEndorsements.sort((a, b) => b.endorsement_count - a.endorsement_count);
      setSkills(skillsWithEndorsements);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddSkill = async () => {
    if (!newSkill.trim()) return;
    
    const trimmedSkill = newSkill.trim();
    if (skills.some(s => s.skill_name.toLowerCase() === trimmedSkill.toLowerCase())) {
      toast({
        title: "Duplicate Skill",
        description: "This skill is already in your list.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('skills')
        .insert({
          user_id: profileId,
          skill_name: trimmedSkill,
          proficiency: newSkillLevel as 'beginner' | 'intermediate' | 'advanced' | 'expert',
        });

      if (error) throw error;

      setNewSkill('');
      setNewSkillLevel('beginner');
      fetchSkills();
      toast({
        title: "Success",
        description: "Skill added successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('skills')
        .delete()
        .eq('id', skillId);

      if (error) throw error;

      setSkills(skills.filter(s => s.id !== skillId));
      toast({
        title: "Success",
        description: "Skill removed successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleEndorse = async (skill: Skill) => {
    if (!currentProfileId) {
      toast({
        title: "Login Required",
        description: "Please login to endorse skills.",
        variant: "destructive",
      });
      return;
    }

    if (isOwnProfile) {
      toast({
        title: "Cannot Endorse",
        description: "You cannot endorse your own skills.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      if (skill.has_endorsed) {
        // Remove endorsement
        const { error } = await supabase
          .from('skill_endorsements')
          .delete()
          .eq('skill_id', skill.id)
          .eq('endorser_id', currentProfileId);

        if (error) throw error;

        setSkills(skills.map(s => 
          s.id === skill.id 
            ? { ...s, has_endorsed: false, endorsement_count: s.endorsement_count - 1 }
            : s
        ));
        toast({
          title: "Endorsement Removed",
          description: `You removed your endorsement for ${skill.skill_name}.`,
        });
      } else {
        // Add endorsement
        const { error } = await supabase
          .from('skill_endorsements')
          .insert({
            skill_id: skill.id,
            endorser_id: currentProfileId,
            endorsed_user_id: profileId,
          });

        if (error) throw error;

        setSkills(skills.map(s => 
          s.id === skill.id 
            ? { ...s, has_endorsed: true, endorsement_count: s.endorsement_count + 1 }
            : s
        ));
        toast({
          title: "Skill Endorsed!",
          description: `You endorsed ${skill.skill_name}.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  if (loading) {
    return (
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardContent className="px-4 py-6 sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="flex flex-wrap gap-2">
              <div className="h-8 bg-muted rounded-full w-20"></div>
              <div className="h-8 bg-muted rounded-full w-24"></div>
              <div className="h-8 bg-muted rounded-full w-16"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Skills & Endorsements</h2>

      {/* Add Skill Input */}
      {isOwnProfile && (
        <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-primary/20 bg-white shadow-none sm:shadow-card overflow-hidden">
          <CardContent className="px-4 py-6 sm:p-8">
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  placeholder="Add a skill (e.g., JavaScript, Project Management)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={saving}
                />
              </div>
              <div className="w-[180px]">
                <Select value={newSkillLevel} onValueChange={setNewSkillLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Beginner</SelectItem>
                    <SelectItem value="intermediate">Intermediate</SelectItem>
                    <SelectItem value="advanced">Advanced</SelectItem>
                    <SelectItem value="expert">Expert</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAddSkill}
                disabled={!newSkill.trim() || saving}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Skills Display */}
      <Card className="shadow-card border-0 bg-transparent shadow-none">
        <CardContent className="p-0">
          <VisualSkills 
            skills={skills}
            isOwnProfile={isOwnProfile}
            onEndorse={handleEndorse}
            onDelete={handleRemoveSkill}
          />
        </CardContent>
      </Card>

      {/* Skill Suggestions */}
      {isOwnProfile && (
        <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
          <CardContent className="px-4 py-6 sm:p-8">
            <h3 className="text-lg font-medium mb-3">Suggested Skills</h3>
            <div className="flex flex-wrap gap-2">
              {[
                'JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Git',
                'Project Management', 'Communication', 'Leadership', 'Problem Solving',
                'Data Analysis', 'Design Thinking', 'Agile', 'Teamwork'
              ].filter(suggestion => !skills.some(s => s.skill_name === suggestion)).slice(0, 8).map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewSkill(suggestion);
                  }}
                  disabled={saving}
                  className="text-xs"
                >
                  + {suggestion}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SkillsSection;