import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download } from 'lucide-react';

const ResumeBuilder = () => {
  const [formData, setFormData] = useState({
    title: '',
    personalInfo: {
      name: '',
      email: '',
      phone: '',
      location: '',
    },
    summary: '',
    experience: '',
    education: '',
    skills: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast({
        title: "Missing title",
        description: "Please provide a title for your resume.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('resumes')
        .insert({
          title: formData.title,
          content: formData,
          user_id: user.id,
        });

      if (error) throw error;

      toast({
        title: "Resume saved!",
        description: "Your resume has been saved successfully.",
      });
    } catch (error) {
      console.error('Error saving resume:', error);
      toast({
        title: "Save failed",
        description: "Could not save resume. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Resume Builder</h2>
        <Button onClick={handleSave} disabled={saving}>
          <FileText className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save Resume"}
        </Button>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resume Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="My Professional Resume"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Full Name"
              value={formData.personalInfo.name}
              onChange={(e) => setFormData({
                ...formData,
                personalInfo: { ...formData.personalInfo, name: e.target.value }
              })}
            />
            <Input
              placeholder="Email"
              type="email"
              value={formData.personalInfo.email}
              onChange={(e) => setFormData({
                ...formData,
                personalInfo: { ...formData.personalInfo, email: e.target.value }
              })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Professional Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write a brief summary of your professional background..."
              value={formData.summary}
              onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
              rows={4}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Experience</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="List your work experience..."
              value={formData.experience}
              onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
              rows={6}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="List your skills..."
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              rows={3}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResumeBuilder;