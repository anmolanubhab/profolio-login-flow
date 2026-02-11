import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FileText, Download, Edit, Trash2, ArrowLeft, Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import { DocumentUpload } from '@/components/DocumentUpload';
import { VisibilitySelector } from '@/components/settings/VisibilitySelector';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ResumeBuilder = () => {
  const navigate = useNavigate();
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
    visibility: 'recruiters' // Default
  });
  const [saving, setSaving] = useState(false);
  const [savedResumes, setSavedResumes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState('recruiters');
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

      const contentToSave = { ...formData };
      const visibility = formData.visibility;

      let error;
      if (editingId) {
        // Try to update visibility column if it exists, otherwise just content
        // We do this by passing it to update. If column doesn't exist, it might fail? 
        // Supabase JS client usually ignores extra fields if not in schema? No, it throws error.
        // So we will try to update both content and visibility if possible.
        // For now, we assume visibility column exists due to migration.
        // If it fails, we catch and retry without visibility.
        
        try {
           ({ error } = await supabase
            .from('resumes')
            .update({
              title: formData.title,
              content: contentToSave,
              visibility: visibility // Assuming column exists
            } as any)
            .eq('id', editingId));
        } catch (e) {
           // Fallback
           ({ error } = await supabase
            .from('resumes')
            .update({
              title: formData.title,
              content: contentToSave,
            })
            .eq('id', editingId));
        }
      } else {
        try {
          ({ error } = await supabase
            .from('resumes')
            .insert({
              title: formData.title,
              content: contentToSave,
              user_id: user.id,
              visibility: visibility
            } as any));
        } catch (e) {
           ({ error } = await supabase
            .from('resumes')
            .insert({
              title: formData.title,
              content: contentToSave,
              user_id: user.id,
            }));
        }
      }

      if (error) throw error;

      toast({
        title: editingId ? "Resume updated!" : "Resume saved!",
        description: `Your resume has been ${editingId ? 'updated' : 'saved'} successfully.`,
      });

      setEditingId(null);
      resetForm();
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

  const handleUploadComplete = async (result: { url: string, fileName: string }) => {
    if (!uploadTitle.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const content = {
        type: 'upload',
        fileName: result.fileName,
        visibility: uploadVisibility
      };

      // Try insert with visibility column
      let error;
      try {
        ({ error } = await supabase.from('resumes').insert({
          title: uploadTitle,
          file_path: result.url,
          user_id: user.id,
          content: content,
          visibility: uploadVisibility
        } as any));
      } catch (e) {
        ({ error } = await supabase.from('resumes').insert({
          title: uploadTitle,
          file_url: result.url,
          user_id: user.id,
          content: content,
        }));
      }

      if (error) throw error;

      toast({ title: "Resume uploaded successfully!" });
      setIsUploadDialogOpen(false);
      setUploadTitle('');
      loadResumes();
    } catch (error) {
      console.error('Error saving uploaded resume:', error);
      toast({ title: "Failed to save resume record", variant: "destructive" });
    }
  };

  const handleEdit = (resume: any) => {
    // If it's a PDF upload, we can't edit it in builder
    if (resume.pdf_url || resume.file_url || resume.content?.type === 'upload') {
      toast({
        title: "Cannot edit uploaded PDF",
        description: "You can only view or delete uploaded PDFs.",
      });
      return;
    }
    setFormData({
      ...resume.content,
      visibility: resume.visibility || resume.content.visibility || 'recruiters'
    });
    setEditingId(resume.id);
  };

  const handleDelete = async (id: string) => {
    try {
      // First fetch the resume to get the file path
      const { data: resume } = await supabase
        .from('resumes')
        .select('file_url, user_id')
        .eq('id', id)
        .single();

      const { error } = await supabase
        .from('resumes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // If there's a file, try to delete it from storage
      if (resume?.file_url) {
        try {
          // If it's a full URL, try to extract the path
          // If it's a relative path (new system), use it directly
          let storagePath = resume.file_url;
          
          if (storagePath.startsWith('http')) {
            const urlParts = storagePath.split('/resumes/');
            if (urlParts.length > 1) {
              storagePath = urlParts[1];
            }
          }
          
          // Clean up any query parameters if present
          storagePath = storagePath.split('?')[0];

          if (storagePath) {
             const { error: storageError } = await supabase.storage
              .from('resumes')
              .remove([storagePath]);
             
             if (storageError) console.warn('Storage delete warning:', storageError);
          }
        } catch (e) {
          console.warn('Failed to cleanup storage:', e);
        }
      }

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

  const handleDownloadPDF = async (resume: any) => {
    if (resume.pdf_url || resume.file_url) {
      const url = resume.file_url || resume.pdf_url;
      
      // If it looks like a full URL (legacy), open it
      if (url.startsWith('http')) {
        window.open(url, '_blank');
        return;
      }
      
      // Otherwise, it's a path in the private 'resumes' bucket
      try {
        const { data, error } = await supabase.storage
          .from('resumes')
          .createSignedUrl(url, 60); // Valid for 60 seconds
          
        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank');
        }
      } catch (error) {
        console.error('Error creating signed URL:', error);
        toast({
          title: "Error opening file",
          description: "Could not retrieve the file. Please try again.",
          variant: "destructive",
        });
      }
      return;
    }

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

  const resetForm = () => {
    setFormData({
      title: '',
      personalInfo: { name: '', email: '', phone: '', location: '' },
      summary: '',
      experience: '',
      education: '',
      skills: '',
      visibility: 'recruiters'
    });
    setEditingId(null);
  };

  const handleUpdateVisibility = async (id: string, newVisibility: string) => {
    try {
       // Optimistic update
       setSavedResumes(prev => prev.map(r => r.id === id ? { ...r, visibility: newVisibility } : r));
       
       const { error } = await supabase
        .from('resumes')
        .update({ visibility: newVisibility } as any)
        .eq('id', id);
        
       if (error) throw error;
       toast({ title: "Visibility updated" });
    } catch (error) {
       console.error("Failed to update visibility", error);
       toast({ title: "Failed to update visibility", variant: "destructive" });
       loadResumes(); // Revert
    }
  };

  const visibilityOptions = [
    { value: 'everyone', label: 'Everyone', description: 'Visible to all users' },
    { value: 'recruiters', label: 'Recruiters', description: 'Visible to recruiters only' },
    { value: 'only_me', label: 'Only Me', description: 'Private to you' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <h2 className="text-2xl font-bold">Resume Manager</h2>
        </div>
        <div className="flex gap-2">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
               <div className="relative p-[1px] rounded-full overflow-hidden group/btn">
                 <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                 <Button 
                   variant="outline"
                   className="relative bg-white hover:bg-transparent hover:text-white border-none rounded-full px-6 h-10 transition-all duration-300"
                 >
                   <Plus className="h-4 w-4 mr-2" />
                   Upload PDF
                 </Button>
               </div>
            </DialogTrigger>
            <DialogContent>
               <DialogHeader>
                 <DialogTitle>Upload Resume (PDF)</DialogTitle>
               </DialogHeader>
               <div className="space-y-4 pt-4">
                 <Input 
                   placeholder="Resume Title (e.g. Software Engineer 2024)" 
                   value={uploadTitle}
                   onChange={(e) => setUploadTitle(e.target.value)}
                 />
                 <VisibilitySelector 
                   title="Visibility" 
                   value={uploadVisibility} 
                   onChange={setUploadVisibility} 
                   options={visibilityOptions} 
                 />
                 <DocumentUpload 
                   bucket="resumes" 
                   acceptedTypes=".pdf"
                   onUploadComplete={handleUploadComplete}
                 />
               </div>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={resetForm} 
            className={`rounded-full px-6 h-10 font-bold transition-all duration-300 shadow-lg ${
              editingId 
                ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 shadow-none' 
                : 'bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-[#833AB4]/20'
            }`}
          >
             {editingId ? "Cancel Edit" : "New Builder Resume"}
          </Button>
        </div>
      </div>

      {/* Saved Resumes Section */}
      <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
        <CardHeader className="border-b border-gray-50 bg-gray-50/30">
          <CardTitle className="text-xl font-bold text-gray-900">Your Resumes</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-gray-400 font-medium">Loading resumes...</p>
            </div>
          ) : savedResumes.length === 0 ? (
            <div className="text-center py-12 bg-gray-50/50 rounded-[2rem] border-2 border-dashed border-gray-200">
               <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                 <FileText className="h-10 w-10 text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-gray-900 mb-2">No resumes found</h3>
               <p className="text-gray-500 max-w-sm mx-auto">Upload a PDF or build one from scratch to start your journey.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {savedResumes.map((resume) => (
                <Card key={resume.id} className="hover:shadow-xl transition-all duration-300 rounded-[2rem] border-gray-100 overflow-hidden flex flex-col group">
                  <CardContent className="p-6 space-y-4">
                    <div className="flex justify-between items-start">
                       <div>
                         <h3 className="font-bold text-gray-900 group-hover:text-[#833AB4] transition-colors">{resume.title}</h3>
                         <p className="text-xs text-gray-400 font-medium mt-1">
                           Updated {new Date(resume.updated_at).toLocaleDateString()}
                         </p>
                       </div>
                       {(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') && (
                         <Badge className="bg-[#0077B5]/10 text-[#0077B5] border-none rounded-full px-3 py-1 text-[10px] font-bold">
                           PDF
                         </Badge>
                       )}
                    </div>
                    
                    <div className="pt-2">
                       <VisibilitySelector
                          title="Visibility"
                          value={resume.visibility || 'recruiters'}
                          onChange={(val) => handleUpdateVisibility(resume.id, val)}
                          options={visibilityOptions}
                       />
                    </div>

                    <div className="flex gap-2 pt-4">
                      {!(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') && (
                        <div className="relative flex-1 p-[1px] rounded-full overflow-hidden group/btn">
                          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                          <Button
                            size="sm"
                            variant="outline"
                            className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full h-9 transition-all duration-300 flex items-center justify-center gap-2"
                            onClick={() => handleEdit(resume)}
                          >
                            <Edit className="h-3.5 w-3.5" />
                            <span className="text-xs font-bold">Edit</span>
                          </Button>
                        </div>
                      )}
                      <div className={`relative p-[1px] rounded-full overflow-hidden group/btn ${(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') ? "flex-1" : "flex-1"}`}>
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full h-9 transition-all duration-300 flex items-center justify-center gap-2"
                          onClick={() => handleDownloadPDF(resume)}
                        >
                          {(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') ? <Eye className="h-3.5 w-3.5"/> : <Download className="h-3.5 w-3.5" />}
                          <span className="text-xs font-bold">{(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') ? "View" : "PDF"}</span>
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full h-9 w-9 p-0 border-gray-100 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all duration-300"
                        onClick={() => handleDelete(resume.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Builder Form - Only show if not editing a PDF or if creating new */}
      <div className={editingId || (!loading && savedResumes.length === 0) ? "block" : "hidden"}>
         <div className="flex items-center gap-2 mb-4">
            <h3 className="text-xl font-semibold">Resume Editor</h3>
         </div>
         
         <div className="grid gap-6">
           <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
             <CardHeader className="border-b border-gray-50 bg-gray-50/30">
               <CardTitle className="text-xl font-bold text-gray-900">Resume Details</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <Input
                 placeholder="Resume Title"
                 value={formData.title}
                 onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all"
               />
               <VisibilitySelector
                  title="Visibility"
                  value={formData.visibility}
                  onChange={(val) => setFormData({...formData, visibility: val})}
                  options={visibilityOptions}
               />
             </CardContent>
           </Card>

           <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
             <CardHeader className="border-b border-gray-50 bg-gray-50/30">
               <CardTitle className="text-xl font-bold text-gray-900">Personal Information</CardTitle>
             </CardHeader>
             <CardContent className="p-6 space-y-4">
               <Input
                 placeholder="Full Name"
                 value={formData.personalInfo.name}
                 onChange={(e) => setFormData({
                   ...formData,
                   personalInfo: { ...formData.personalInfo, name: e.target.value }
                 })}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all"
               />
               <Input
                 placeholder="Email"
                 type="email"
                 value={formData.personalInfo.email}
                 onChange={(e) => setFormData({
                   ...formData,
                   personalInfo: { ...formData.personalInfo, email: e.target.value }
                 })}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all"
               />
             </CardContent>
           </Card>

           <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
             <CardHeader className="border-b border-gray-50 bg-gray-50/30">
               <CardTitle className="text-xl font-bold text-gray-900">Professional Summary</CardTitle>
             </CardHeader>
             <CardContent className="p-6">
               <Textarea
                 placeholder="Write a brief summary..."
                 value={formData.summary}
                 onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                 rows={4}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all resize-none"
               />
             </CardContent>
           </Card>

           <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
             <CardHeader className="border-b border-gray-50 bg-gray-50/30">
               <CardTitle className="text-xl font-bold text-gray-900">Experience</CardTitle>
             </CardHeader>
             <CardContent className="p-6">
               <Textarea
                 placeholder="List your work experience..."
                 value={formData.experience}
                 onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                 rows={6}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all resize-none"
               />
             </CardContent>
           </Card>

           <Card className="rounded-[2rem] border-gray-100 overflow-hidden shadow-sm">
             <CardHeader className="border-b border-gray-50 bg-gray-50/30">
               <CardTitle className="text-xl font-bold text-gray-900">Skills</CardTitle>
             </CardHeader>
             <CardContent className="p-6">
               <Textarea
                 placeholder="List your skills..."
                 value={formData.skills}
                 onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                 rows={3}
                 className="rounded-xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all resize-none"
               />
             </CardContent>
           </Card>
           
           <div className="flex justify-end pt-4">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                size="lg"
                className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 py-6 h-auto text-lg font-bold shadow-xl shadow-[#833AB4]/20 gap-3 transition-all duration-300 hover:scale-105"
              >
                {saving ? (
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving...</span>
                  </div>
                ) : (
                  <>
                    <FileText className="h-6 w-6" />
                    <span>Save Resume</span>
                  </>
                )}
              </Button>
           </div>
         </div>
      </div>
    </div>
  );
};

// Simple Badge component since it might not be imported
const Badge = ({ children, variant = "default", className }: any) => (
  <span className={`px-2 py-1 rounded text-xs font-medium ${variant === 'secondary' ? 'bg-gray-100 text-gray-800' : 'bg-primary text-primary-foreground'} ${className}`}>
    {children}
  </span>
);

export default ResumeBuilder;
