import { useState, useEffect } from 'react';
import { Plus, Edit3, Save, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { VisualExperienceTimeline } from './redesign/VisualExperienceTimeline';
import { useAuth } from '@/contexts/AuthContext';

interface Experience {
  id: string;
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  employment_type?: string;
  location?: string;
  description?: string;
}

interface ExperienceSectionProps {
  userId: string;
  isOwnProfile?: boolean;
}

const ExperienceSection = ({ userId, isOwnProfile = false }: ExperienceSectionProps) => {
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const { user, profile: authProfile, refreshProfile } = useAuth();

  const [editData, setEditData] = useState({
    company: '',
    role: '',
    start_date: '',
    end_date: '',
    is_current: false,
    employment_type: '',
    location: '',
    description: ''
  });

  useEffect(() => {
    if (isOwnProfile && authProfile && user?.id === userId) {
      const experienceArray = (authProfile as any)?.experience || [];
      const formattedExperiences = experienceArray.map((exp: any, index: number) => ({
        id: exp.id || `exp_${index}`,
        company: exp.company || '',
        role: exp.role || '',
        start_date: exp.start_date || '',
        end_date: exp.end_date || '',
        is_current: exp.is_current || false,
        employment_type: exp.employment_type || '',
        location: exp.location || '',
        description: exp.description || ''
      }));
      setExperiences(formattedExperiences);
      setLoading(false);
    } else {
      fetchExperiences();
    }
  }, [userId, authProfile, isOwnProfile, user]);

  const fetchExperiences = async () => {
    try {
      // Get profile data directly
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('experience' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      const experienceArray = (profileData as any)?.experience || [];

      // Convert to proper format with IDs
      const formattedExperiences = experienceArray.map((exp: any, index: number) => ({
        id: exp.id || `exp_${index}`,
        company: exp.company || '',
        role: exp.role || '',
        start_date: exp.start_date || '',
        end_date: exp.end_date || '',
        is_current: exp.is_current || false,
        employment_type: exp.employment_type || '',
        location: exp.location || '',
        description: exp.description || ''
      }));
      
      setExperiences(formattedExperiences);
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

  const resetEditData = () => {
    setEditData({
      company: '',
      role: '',
      start_date: '',
      end_date: '',
      is_current: false,
      employment_type: '',
      location: '',
      description: ''
    });
  };

  const handleAdd = () => {
    resetEditData();
    setIsAdding(true);
  };

  const handleEdit = (experience: Experience) => {
    setEditData({
      company: experience.company,
      role: experience.role,
      start_date: experience.start_date,
      end_date: experience.end_date || '',
      is_current: experience.is_current,
      employment_type: experience.employment_type || '',
      location: experience.location || '',
      description: experience.description || ''
    });
    setEditingId(experience.id);
  };

  const handleSave = async () => {
    try {
      // Get current experiences
      const { data: profile } = await supabase
        .from('profiles')
        .select('experience' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      let updatedExperiences = [...((profile as any).experience || [])];

      const saveData = {
        ...editData,
        id: editingId || `exp_${Date.now()}`,
        end_date: editData.is_current ? null : editData.end_date || null
      };

      if (isAdding) {
        updatedExperiences.push(saveData);
      } else if (editingId) {
        const index = updatedExperiences.findIndex((exp: any) => exp.id === editingId);
        if (index !== -1) {
          updatedExperiences[index] = saveData;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ experience: updatedExperiences } as any)
        .eq('user_id', userId);

      if (error) throw error;

      if (isOwnProfile) {
        await refreshProfile();
      } else {
        fetchExperiences();
      }
      
      setIsAdding(false);
      setEditingId(null);
      resetEditData();

      toast({
        title: "Success",
        description: "Experience saved successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Get current experiences
      const { data: profile } = await supabase
        .from('profiles')
        .select('experience' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      const updatedExperiences = ((profile as any).experience || []).filter((exp: any) => exp.id !== id);

      const { error } = await supabase
        .from('profiles')
        .update({ experience: updatedExperiences } as any)
        .eq('user_id', userId);

      if (error) throw error;

      if (isOwnProfile) {
        await refreshProfile();
      } else {
        fetchExperiences();
      }
      
      toast({
        title: "Success",
        description: "Experience deleted successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    resetEditData();
  };

  if (loading) {
    return (
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardContent className="px-4 py-6 sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Work Experience</h2>
        {isOwnProfile && (
          <Button onClick={handleAdd} disabled={isAdding || editingId !== null}>
            <Plus className="h-4 w-4 mr-2" />
            Add Experience
          </Button>
        )}
      </div>

      {/* Add/Edit Form */}
      {isOwnProfile && (isAdding || editingId) && (
        <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-primary/20 bg-white shadow-none sm:shadow-card overflow-hidden">
          <CardContent className="px-4 py-6 sm:p-8">
            <div className="grid gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Company Name"
                  value={editData.company}
                  onChange={(e) => setEditData(prev => ({ ...prev, company: e.target.value }))}
                />
                <Input
                  placeholder="Job Title"
                  value={editData.role}
                  onChange={(e) => setEditData(prev => ({ ...prev, role: e.target.value }))}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Employment Type"
                  value={editData.employment_type}
                  onChange={(e) => setEditData(prev => ({ ...prev, employment_type: e.target.value }))}
                />
                <Input
                  placeholder="Location"
                  value={editData.location}
                  onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Input
                    type="date"
                    value={editData.start_date}
                    onChange={(e) => setEditData(prev => ({ ...prev, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Input
                    type="date"
                    value={editData.end_date}
                    onChange={(e) => setEditData(prev => ({ ...prev, end_date: e.target.value }))}
                    disabled={editData.is_current}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="current"
                  checked={editData.is_current}
                  onCheckedChange={(checked) => {
                    setEditData(prev => ({ 
                      ...prev, 
                      is_current: checked as boolean,
                      end_date: checked ? '' : prev.end_date
                    }));
                  }}
                />
                <label htmlFor="current" className="text-sm font-medium">
                  I currently work here
                </label>
              </div>

              <Textarea
                placeholder="Job description and achievements..."
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
              />

              <div className="flex gap-2">
                <Button onClick={handleSave} className="bg-success hover:bg-success/90">
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Experience Timeline */}
      <VisualExperienceTimeline 
        experiences={experiences}
        isOwnProfile={isOwnProfile}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default ExperienceSection;