import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Eye, Edit, Trash2 } from 'lucide-react';
import jsPDF from 'jspdf';

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
  const [savedResumes, setSavedResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadResumes();
  }, []);

  const loadResumes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setSavedResumes(data || []);
    } catch (error) {
      console.error('Error loading resumes:', error);
    } finally {
      setLoading(false);
    }
  };

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

      let error;
      if (editingId) {
        ({ error } = await supabase
          .from('resumes')
          .update({
            title: formData.title,
            content: formData,
          })
          .eq('id', editingId));
      } else {
        ({ error } = await supabase
          .from('resumes')
          .insert({
            title: formData.title,
            content: formData,
            user_id: user.id,
          }));
      }

      if (error) throw error;

      toast({
        title: editingId ? "Resume updated!" : "Resume saved!",
        description: `Your resume has been ${editingId ? 'updated' : 'saved'} successfully.`,
      });

      setEditingId(null);
      setFormData({
        title: '',
        personalInfo: { name: '', email: '', phone: '', location: '' },
        summary: '',
        experience: '',
        education: '',
        skills: '',
      });
      loadResumes();
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

  const handleEdit = (resume: any) => {
    setFormData(resume.content);
    setEditingId(resume.id);
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Resume deleted",
        description: "Your resume has been deleted successfully.",
      });
      loadResumes();
    } catch (error) {
      console.error('Error deleting resume:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete resume. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDownloadPDF = (resume: any) => {
    const doc = new jsPDF();
    const content = resume.content;
    
    // Title
    doc.setFontSize(20);
    doc.text(content.title || 'Resume', 20, 30);
    
    // Personal Info
    doc.setFontSize(16);
    doc.text('Personal Information', 20, 50);
    doc.setFontSize(12);
    let yPos = 60;
    if (content.personalInfo?.name) {
      doc.text(`Name: ${content.personalInfo.name}`, 20, yPos);
      yPos += 10;
    }
    if (content.personalInfo?.email) {
      doc.text(`Email: ${content.personalInfo.email}`, 20, yPos);
      yPos += 10;
    }
    
    // Summary
    if (content.summary) {
      yPos += 10;
      doc.setFontSize(16);
      doc.text('Professional Summary', 20, yPos);
      yPos += 10;
      doc.setFontSize(12);
      const summaryLines = doc.splitTextToSize(content.summary, 170);
      doc.text(summaryLines, 20, yPos);
      yPos += summaryLines.length * 7;
    }
    
    // Experience
    if (content.experience) {
      yPos += 10;
      doc.setFontSize(16);
      doc.text('Experience', 20, yPos);
      yPos += 10;
      doc.setFontSize(12);
      const expLines = doc.splitTextToSize(content.experience, 170);
      doc.text(expLines, 20, yPos);
      yPos += expLines.length * 7;
    }
    
    // Skills
    if (content.skills) {
      yPos += 10;
      doc.setFontSize(16);
      doc.text('Skills', 20, yPos);
      yPos += 10;
      doc.setFontSize(12);
      const skillsLines = doc.splitTextToSize(content.skills, 170);
      doc.text(skillsLines, 20, yPos);
    }
    
    doc.save(`${content.title || 'resume'}.pdf`);
  };

  const handleNewResume = () => {
    setFormData({
      title: '',
      personalInfo: { name: '', email: '', phone: '', location: '' },
      summary: '',
      experience: '',
      education: '',
      skills: '',
    });
    setEditingId(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Resume Builder</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleNewResume}>
            New Resume
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <FileText className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : (editingId ? "Update Resume" : "Save Resume")}
          </Button>
        </div>
      </div>

      {/* Saved Resumes Section */}
      <Card>
        <CardHeader>
          <CardTitle>Your Saved Resumes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading resumes...</p>
          ) : savedResumes.length === 0 ? (
            <p className="text-muted-foreground">No saved resumes yet. Create your first resume below!</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedResumes.map((resume) => (
                <Card key={resume.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-2">{resume.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Updated: {new Date(resume.updated_at).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(resume)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownloadPDF(resume)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(resume.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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