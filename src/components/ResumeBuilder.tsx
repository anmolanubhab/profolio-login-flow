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
    const controller = new AbortController();
    loadResumes(controller.signal);
    return () => controller.abort();
  }, []);

  const loadResumes = async (signal?: AbortSignal) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (signal && signal.aborted)) return;

      const { data, error } = await supabase
        .from('resumes')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }
      setSavedResumes(data || []);
    } catch (error) {
      if (error.name === 'AbortError') return;
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
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/50 backdrop-blur-sm p-6 rounded-[2.5rem] border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/dashboard')}
            className="rounded-full hover:bg-gray-100/80 transition-all duration-300"
          >
            <ArrowLeft className="h-5 w-5 text-[#5E6B7E]" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-[#1D2226] tracking-tight">Resume Manager</h2>
            <p className="text-[#5E6B7E] font-medium text-sm">Manage and build your professional resumes</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
               <div className="relative p-[1px] rounded-full overflow-hidden group/btn">
                 <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-80 group-hover/btn:opacity-100 transition-opacity" />
                 <Button 
                   variant="outline"
                   className="relative bg-white hover:bg-transparent hover:text-white border-none rounded-full px-8 h-12 font-bold transition-all duration-300 shadow-lg shadow-black/5"
                 >
                   <Plus className="h-5 w-5 mr-2" />
                   Upload PDF
                 </Button>
               </div>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
               <div className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] p-8 text-white">
                 <DialogHeader>
                   <DialogTitle className="text-2xl font-bold text-white">Upload Resume (PDF)</DialogTitle>
                 </DialogHeader>
               </div>
               <div className="p-8 space-y-6 bg-white">
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-[#1D2226] ml-1">Resume Title</label>
                   <Input 
                     placeholder="e.g. Senior Software Engineer 2024" 
                     value={uploadTitle}
                     onChange={(e) => setUploadTitle(e.target.value)}
                     className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all h-12"
                   />
                 </div>
                 <VisibilitySelector 
                   title="Who can see this?" 
                   value={uploadVisibility} 
                   onChange={setUploadVisibility} 
                   options={visibilityOptions} 
                 />
                 <div className="pt-2">
                   <DocumentUpload 
                     bucket="resumes" 
                     acceptedTypes=".pdf"
                     onUploadComplete={handleUploadComplete}
                   />
                 </div>
               </div>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={resetForm} 
            className={`rounded-full px-8 h-12 font-bold transition-all duration-300 transform hover:scale-105 active:scale-95 shadow-xl ${
              editingId 
                ? 'bg-gray-100 text-[#1D2226] hover:bg-gray-200' 
                : 'bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-[#833AB4]/20'
            }`}
          >
             {editingId ? "Cancel Editing" : "Build New Resume"}
          </Button>
        </div>
      </div>

      {/* Saved Resumes Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-2xl font-bold text-[#1D2226] tracking-tight">Your Portfolio</h3>
          {!loading && savedResumes.length > 0 && (
            <span className="bg-gray-100 text-[#5E6B7E] px-4 py-1.5 rounded-full text-xs font-bold border border-gray-200">
              {savedResumes.length} {savedResumes.length === 1 ? 'Resume' : 'Resumes'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/50 backdrop-blur-sm rounded-[3rem] border border-gray-100">
            <div className="h-12 w-12 border-4 border-gray-100 border-t-[#833AB4] rounded-full animate-spin mb-4" />
            <p className="text-[#5E6B7E] font-bold animate-pulse">Loading your portfolio...</p>
          </div>
        ) : savedResumes.length === 0 ? (
          <Card className="border-2 border-dashed border-gray-100 bg-gray-50/30 rounded-[3rem] overflow-hidden">
            <CardContent className="flex flex-col items-center justify-center py-24 px-6 text-center">
               <div className="relative mb-8">
                 <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                 <div className="relative h-24 w-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#833AB4]">
                   <FileText className="h-12 w-12" />
                 </div>
               </div>
               <h3 className="text-2xl font-extrabold text-[#1D2226] mb-3 tracking-tight">Your portfolio is ready for its first resume</h3>
               <p className="text-[#5E6B7E] font-medium max-w-md mb-10 leading-relaxed text-lg">
                 Upload your existing PDF or use our professional builder to create a standout resume in minutes.
               </p>
               <div className="flex flex-wrap justify-center gap-4">
                 <Button 
                   onClick={() => setIsUploadDialogOpen(true)}
                   variant="outline"
                   className="rounded-full px-8 h-12 font-bold border-2 border-[#833AB4]/20 hover:border-[#833AB4] hover:bg-[#833AB4]/5 text-[#833AB4] transition-all"
                 >
                   Upload PDF
                 </Button>
                 <Button 
                   onClick={resetForm}
                   className="rounded-full px-8 h-12 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white font-bold hover:opacity-90 shadow-xl shadow-[#833AB4]/25 transition-all transform hover:scale-105"
                 >
                   Start Building
                 </Button>
               </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {savedResumes.map((resume, index) => (
              <Card 
                key={resume.id} 
                className="group relative hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] border-gray-100 overflow-hidden flex flex-col bg-white animate-in fade-in slide-in-from-bottom-4"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <CardContent className="p-8 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                     <div className="space-y-1">
                       <h3 className="font-extrabold text-xl text-[#1D2226] group-hover:text-[#833AB4] transition-colors line-clamp-2 leading-tight">
                         {resume.title}
                       </h3>
                       <p className="text-xs text-[#5E6B7E] font-bold tracking-wider uppercase opacity-70">
                         Updated {new Date(resume.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                       </p>
                     </div>
                     {(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') && (
                       <div className="bg-gradient-to-br from-[#0077B5]/10 to-[#833AB4]/10 p-2.5 rounded-2xl">
                         <FileText className="h-5 w-5 text-[#0077B5]" />
                       </div>
                     )}
                  </div>
                  
                  <div className="pt-2">
                     <VisibilitySelector
                        title=""
                        value={resume.visibility || 'recruiters'}
                        onChange={(val) => handleUpdateVisibility(resume.id, val)}
                        options={visibilityOptions}
                     />
                  </div>

                  <div className="flex gap-3 pt-4 mt-auto">
                    {!(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') && (
                      <div className="relative flex-1 p-[1px] rounded-full overflow-hidden group/btn-inner">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-80 group-hover/btn-inner:opacity-100 transition-opacity" />
                        <Button
                          size="sm"
                          variant="outline"
                          className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full h-11 transition-all duration-300 flex items-center justify-center gap-2"
                          onClick={() => handleEdit(resume)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="text-sm font-bold">Edit</span>
                        </Button>
                      </div>
                    )}
                    <div className="relative flex-1 p-[1px] rounded-full overflow-hidden group/btn-inner">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-80 group-hover/btn-inner:opacity-100 transition-opacity" />
                      <Button
                        size="sm"
                        variant="outline"
                        className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full h-11 transition-all duration-300 flex items-center justify-center gap-2"
                        onClick={() => handleDownloadPDF(resume)}
                      >
                        {(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') ? <Eye className="h-4 w-4"/> : <Download className="h-4 w-4" />}
                        <span className="text-sm font-bold">{(resume.pdf_url || resume.file_url || resume.content?.type === 'upload') ? "View" : "PDF"}</span>
                      </Button>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full h-11 w-11 p-0 border-gray-100 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all duration-300 bg-gray-50/50"
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
      </div>

      {/* Builder Form - Only show if not editing a PDF or if creating new */}
      <div className={`${editingId || (!loading && savedResumes.length === 0) ? "block" : "hidden"} space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 pt-12 border-t border-gray-100`}>
         <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-2">
            <div>
              <h3 className="text-3xl font-extrabold text-[#1D2226] tracking-tight">
                {editingId ? "Refine Your Resume" : "Create Professional Resume"}
              </h3>
              <p className="text-[#5E6B7E] font-medium mt-1">Fill in your details to generate a stunning PDF</p>
            </div>
            {editingId && (
              <Button 
                variant="outline" 
                onClick={resetForm}
                className="rounded-full border-2 border-gray-100 hover:bg-gray-50 text-[#5E6B7E] font-bold h-11"
              >
                Discard Changes
              </Button>
            )}
         </div>
         
         <div className="grid gap-8">
           <div className="grid md:grid-cols-2 gap-8">
             <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden shadow-xl shadow-black/5 hover:shadow-black/10 transition-shadow duration-500 bg-white">
               <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-8">
                 <CardTitle className="text-xl font-extrabold text-[#1D2226] flex items-center gap-3">
                   <div className="p-2 bg-white rounded-xl shadow-sm">
                     <Edit className="h-5 w-5 text-[#833AB4]" />
                   </div>
                   Resume Basics
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                 <div className="space-y-2">
                   <label className="text-sm font-bold text-[#1D2226] ml-1">Document Title</label>
                   <Input
                     placeholder="e.g. Creative Director Resume"
                     value={formData.title}
                     onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                     className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all h-12 px-5"
                   />
                 </div>
                 <VisibilitySelector
                    title="Visibility Preference"
                    value={formData.visibility}
                    onChange={(val) => setFormData({...formData, visibility: val})}
                    options={visibilityOptions}
                 />
               </CardContent>
             </Card>

             <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden shadow-xl shadow-black/5 hover:shadow-black/10 transition-shadow duration-500 bg-white">
               <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-8">
                 <CardTitle className="text-xl font-extrabold text-[#1D2226] flex items-center gap-3">
                   <div className="p-2 bg-white rounded-xl shadow-sm">
                     <Plus className="h-5 w-5 text-[#0077B5]" />
                   </div>
                   Personal Details
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8 space-y-6">
                 <div className="grid gap-6">
                   <div className="space-y-2">
                     <label className="text-sm font-bold text-[#1D2226] ml-1">Full Name</label>
                     <Input
                       placeholder="John Doe"
                       value={formData.personalInfo.name}
                       onChange={(e) => setFormData({
                         ...formData,
                         personalInfo: { ...formData.personalInfo, name: e.target.value }
                       })}
                       className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all h-12 px-5"
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-sm font-bold text-[#1D2226] ml-1">Email Address</label>
                     <Input
                       placeholder="john@example.com"
                       type="email"
                       value={formData.personalInfo.email}
                       onChange={(e) => setFormData({
                         ...formData,
                         personalInfo: { ...formData.personalInfo, email: e.target.value }
                       })}
                       className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all h-12 px-5"
                     />
                   </div>
                 </div>
               </CardContent>
             </Card>
           </div>

           <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden shadow-xl shadow-black/5 hover:shadow-black/10 transition-shadow duration-500 bg-white">
             <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-8">
               <CardTitle className="text-xl font-extrabold text-[#1D2226] flex items-center gap-3">
                 <div className="p-2 bg-white rounded-xl shadow-sm">
                   <FileText className="h-5 w-5 text-[#E1306C]" />
                 </div>
                 Professional Summary
               </CardTitle>
             </CardHeader>
             <CardContent className="p-8">
               <Textarea
                 placeholder="Write a compelling summary of your career and goals..."
                 value={formData.summary}
                 onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                 rows={4}
                 className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all px-6 py-4 resize-none min-h-[120px] leading-relaxed"
               />
             </CardContent>
           </Card>

           <div className="grid md:grid-cols-2 gap-8">
             <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden shadow-xl shadow-black/5 hover:shadow-black/10 transition-shadow duration-500 bg-white">
               <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-8">
                 <CardTitle className="text-xl font-extrabold text-[#1D2226] flex items-center gap-3">
                   <div className="p-2 bg-white rounded-xl shadow-sm">
                     <Edit className="h-5 w-5 text-[#833AB4]" />
                   </div>
                   Experience
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8">
                 <Textarea
                   placeholder="Describe your work history, projects, and achievements..."
                   value={formData.experience}
                   onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                   rows={8}
                   className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all px-6 py-4 resize-none min-h-[200px] leading-relaxed"
                 />
               </CardContent>
             </Card>

             <Card className="rounded-[2.5rem] border-gray-100 overflow-hidden shadow-xl shadow-black/5 hover:shadow-black/10 transition-shadow duration-500 bg-white">
               <CardHeader className="border-b border-gray-50 bg-gray-50/50 p-8">
                 <CardTitle className="text-xl font-extrabold text-[#1D2226] flex items-center gap-3">
                   <div className="p-2 bg-white rounded-xl shadow-sm">
                     <Plus className="h-5 w-5 text-[#0077B5]" />
                   </div>
                   Core Skills
                 </CardTitle>
               </CardHeader>
               <CardContent className="p-8">
                 <Textarea
                   placeholder="List your key technical and soft skills (e.g., React, Project Management, UI/UX)..."
                   value={formData.skills}
                   onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                   rows={8}
                   className="rounded-2xl border-gray-100 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all px-6 py-4 resize-none min-h-[200px] leading-relaxed"
                 />
               </CardContent>
             </Card>
           </div>
           
           <div className="flex justify-center md:justify-end pt-6 pb-12">
              <Button 
                onClick={handleSave} 
                disabled={saving} 
                size="lg"
                className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-12 py-7 h-auto text-xl font-bold shadow-2xl shadow-[#833AB4]/30 gap-4 transition-all duration-300 transform hover:scale-105 active:scale-95"
              >
                {saving ? (
                  <div className="flex items-center gap-3">
                    <div className="h-6 w-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving Portfolio...</span>
                  </div>
                ) : (
                  <>
                    <FileText className="h-7 w-7" />
                    <span>{editingId ? "Update Resume" : "Save to Portfolio"}</span>
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
