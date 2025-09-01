import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SkillsSectionProps {
  userId: string;
}

const SkillsSection = ({ userId }: SkillsSectionProps) => {
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchSkills();
  }, [userId]);

  const fetchSkills = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('skills' as any)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      setSkills((data as any)?.skills || []);
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

  const updateSkills = async (updatedSkills: string[]) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ skills: updatedSkills } as any)
        .eq('user_id', userId);

      if (error) throw error;
      
      setSkills(updatedSkills);
      toast({
        title: "Success",
        description: "Skills updated successfully!",
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

  const handleAddSkill = () => {
    if (!newSkill.trim()) return;
    
    const trimmedSkill = newSkill.trim();
    if (skills.includes(trimmedSkill)) {
      toast({
        title: "Duplicate Skill",
        description: "This skill is already in your list.",
        variant: "destructive",
      });
      return;
    }

    const updatedSkills = [...skills, trimmedSkill];
    updateSkills(updatedSkills);
    setNewSkill('');
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    const updatedSkills = skills.filter(skill => skill !== skillToRemove);
    updateSkills(updatedSkills);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
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
      <h2 className="text-xl font-semibold">Skills</h2>

      {/* Add Skill Input */}
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex gap-2">
            <Input
              placeholder="Add a skill (e.g., JavaScript, Project Management)"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={saving}
            />
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

      {/* Skills Display */}
      <Card className="shadow-card">
        <CardContent className="p-6">
          {skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-sm py-1 px-3 bg-primary/10 text-primary hover:bg-primary/20 transition-smooth"
                >
                  {skill}
                  <button
                    onClick={() => handleRemoveSkill(skill)}
                    className="ml-2 text-primary/70 hover:text-primary"
                    disabled={saving}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No skills added yet. Add your first skill above to get started.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Skill Suggestions */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-medium mb-3">Suggested Skills</h3>
          <div className="flex flex-wrap gap-2">
            {[
              'JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Git',
              'Project Management', 'Communication', 'Leadership', 'Problem Solving',
              'Data Analysis', 'Design Thinking', 'Agile', 'Teamwork'
            ].filter(suggestion => !skills.includes(suggestion)).slice(0, 8).map((suggestion) => (
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
    </div>
  );
};

export default SkillsSection;