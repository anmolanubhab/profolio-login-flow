import { useState, useEffect } from 'react';
import { Plus, Edit3, Save, X, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';

interface Education {
  id: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_date?: string;
  end_date?: string;
  grade?: string;
  description?: string;
}

interface EducationSectionProps {
  userId: string;
}

const EducationSection = ({ userId }: EducationSectionProps) => {
  const [educations, setEducations] = useState<Education[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    institution: '',
    degree: '',
    field_of_study: '',
    start_date: '',
    end_date: '',
    grade: '',
    description: ''
  });

  useEffect(() => {
    fetchEducations();
  }, [userId]);

  const fetchEducations = async () => {
    try {
      // Get education data from profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('education' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      const educationArray = (profileData as any)?.education || [];
      
      // Convert to proper format with IDs
      const formattedEducations = educationArray.map((edu: any, index: number) => ({
        id: edu.id || `edu_${index}`,
        institution: edu.institution || '',
        degree: edu.degree || '',
        field_of_study: edu.field_of_study || '',
        start_date: edu.start_date || '',
        end_date: edu.end_date || '',
        grade: edu.grade || '',
        description: edu.description || ''
      }));
      
      setEducations(formattedEducations);
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
      institution: '',
      degree: '',
      field_of_study: '',
      start_date: '',
      end_date: '',
      grade: '',
      description: ''
    });
  };

  const handleAdd = () => {
    resetEditData();
    setIsAdding(true);
  };

  const handleEdit = (education: Education) => {
    setEditData({
      institution: education.institution,
      degree: education.degree || '',
      field_of_study: education.field_of_study || '',
      start_date: education.start_date || '',
      end_date: education.end_date || '',
      grade: education.grade || '',
      description: education.description || ''
    });
    setEditingId(education.id);
  };

  const handleSave = async () => {
    try {
      // Get current education
      const { data: profile } = await supabase
        .from('profiles')
        .select('education' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      let updatedEducations = [...((profile as any).education || [])];

      const saveData = {
        ...editData,
        id: editingId || `edu_${Date.now()}`,
        start_date: editData.start_date || null,
        end_date: editData.end_date || null
      };

      if (isAdding) {
        updatedEducations.push(saveData);
      } else if (editingId) {
        const index = updatedEducations.findIndex((edu: any) => edu.id === editingId);
        if (index !== -1) {
          updatedEducations[index] = saveData;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ education: updatedEducations } as any)
        .eq('user_id', userId);

      if (error) throw error;

      fetchEducations();
      setIsAdding(false);
      setEditingId(null);
      resetEditData();

      toast({
        title: "Success",
        description: "Education saved successfully!",
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
      // Get current education
      const { data: profile } = await supabase
        .from('profiles')
        .select('education' as any)
        .eq('user_id', userId)
        .maybeSingle();

      if (!profile) throw new Error('Profile not found');

      const updatedEducations = ((profile as any).education || []).filter((edu: any) => edu.id !== id);

      const { error } = await supabase
        .from('profiles')
        .update({ education: updatedEducations } as any)
        .eq('user_id', userId);

      if (error) throw error;

      fetchEducations();
      toast({
        title: "Success",
        description: "Education deleted successfully!",
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
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
        <h2 className="text-xl font-semibold">Education</h2>
        <Button onClick={handleAdd} disabled={isAdding || editingId !== null}>
          <Plus className="h-4 w-4 mr-2" />
          Add Education
        </Button>
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <Card className="border-primary/20">
          <CardContent className="p-6">
            <div className="grid gap-4">
              <Input
                placeholder="Institution Name"
                value={editData.institution}
                onChange={(e) => setEditData(prev => ({ ...prev, institution: e.target.value }))}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Degree"
                  value={editData.degree}
                  onChange={(e) => setEditData(prev => ({ ...prev, degree: e.target.value }))}
                />
                <Input
                  placeholder="Field of Study"
                  value={editData.field_of_study}
                  onChange={(e) => setEditData(prev => ({ ...prev, field_of_study: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  />
                </div>
                <Input
                  placeholder="Grade/CGPA"
                  value={editData.grade}
                  onChange={(e) => setEditData(prev => ({ ...prev, grade: e.target.value }))}
                />
              </div>

              <Textarea
                placeholder="Description, achievements, activities..."
                value={editData.description}
                onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
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

      {/* Education List */}
      <div className="space-y-4">
        {educations.map((education) => (
          <Card key={education.id} className="shadow-card">
            <CardContent className="p-6">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-lg text-foreground">
                    {education.institution}
                  </h3>
                  {education.degree && (
                    <p className="text-primary font-medium">
                      {education.degree}
                      {education.field_of_study && ` in ${education.field_of_study}`}
                    </p>
                  )}
                  {(education.start_date || education.end_date) && (
                    <p className="text-muted-foreground text-sm">
                      {education.start_date ? formatDate(education.start_date) : ''} - {
                        education.end_date ? formatDate(education.end_date) : 'Present'
                      }
                    </p>
                  )}
                  {education.grade && (
                    <p className="text-muted-foreground text-sm">
                      Grade: {education.grade}
                    </p>
                  )}
                  {education.description && (
                    <p className="text-foreground mt-3 leading-relaxed">
                      {education.description}
                    </p>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(education)}
                    disabled={editingId !== null || isAdding}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDelete(education.id)}
                    disabled={editingId !== null || isAdding}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {educations.length === 0 && !isAdding && (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">
                No education history added yet. Click "Add Education" to get started.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default EducationSection;