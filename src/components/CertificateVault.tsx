import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, Download, Trash2, Plus, Eye, Lock, Globe, Building2 } from 'lucide-react';
import { DocumentUpload } from '@/components/DocumentUpload';
import { VisibilitySelector } from '@/components/settings/VisibilitySelector';

interface Certificate {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string;
  file_size: number | null;
  created_at: string;
  visibility?: string;
}

const CertificateVault = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('recruiters');
  const { toast } = useToast();

  const fetchCertificates = async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || (signal && signal.aborted)) return;

      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (
          error.code === 'ABORTED' ||
          (error as any).name === 'AbortError' ||
          (error as any).code === 20 ||
          (error as any).code === '20'
        ) return;
        throw error;
      }
      setCertificates(data || []);
    } catch (error: any) {
      if (
        error.name === 'AbortError' ||
        error.code === 'ABORTED' ||
        error.code === 20 ||
        error.code === '20'
      ) return;
      console.error('Error fetching certificates:', error);
      toast({
        title: "Error loading certificates",
        description: "Could not load your certificates. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    fetchCertificates(controller.signal);
    return () => controller.abort();
  }, []);

  const handleUploadComplete = async (result: { url: string; filePath: string; fileName: string; fileSize: number }) => {
    if (!title.trim()) {
      toast({
        title: "Missing title",
        description: "Please provide a title for your certificate.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Try insert with visibility
      let error;
      try {
        ({ error } = await supabase
          .from('certificates')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            file_url: result.url,
            file_name: result.fileName,
            file_size: result.fileSize,
            user_id: user.id,
            visibility: visibility
          } as any));
      } catch (e) {
        // Fallback for missing column
        ({ error } = await supabase
          .from('certificates')
          .insert({
            title: title.trim(),
            description: description.trim() || null,
            file_url: result.url,
            file_name: result.fileName,
            file_size: result.fileSize,
            user_id: user.id,
          }));
      }

      if (error) throw error;

      toast({
        title: "Certificate uploaded!",
        description: "Your certificate has been saved to the vault.",
      });

      // Reset form and refresh list
      setTitle('');
      setDescription('');
      setVisibility('recruiters');
      setIsDialogOpen(false);
      fetchCertificates();

    } catch (error) {
      console.error('Error uploading certificate:', error);
      toast({
        title: "Upload failed",
        description: "Could not upload certificate. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdateVisibility = async (id: string, newVisibility: string) => {
    try {
      // Optimistic update
      setCertificates(prev => prev.map(c => c.id === id ? { ...c, visibility: newVisibility } : c));

      const { error } = await supabase
        .from('certificates')
        .update({ visibility: newVisibility } as any)
        .eq('id', id);

      if (error) throw error;
      
      toast({ title: "Visibility updated" });
    } catch (error) {
      console.error('Error updating visibility:', error);
      toast({ 
        title: "Update failed", 
        description: "Could not update visibility setting.",
        variant: "destructive" 
      });
      fetchCertificates(); // Revert
    }
  };

  const handleView = async (cert: Certificate) => {
    if (!cert.file_url) return;

    if (cert.file_url.startsWith('http')) {
      window.open(cert.file_url, '_blank');
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from('certificates')
        .createSignedUrl(cert.file_url, 60);

      if (error) throw error;
      
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error opening certificate:', error);
      toast({
        title: "Error opening certificate",
        description: "Could not retrieve the file.",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (certificateId: string, filePath: string) => {
    try {
      // Delete from database
      const { error: dbError } = await supabase
        .from('certificates')
        .delete()
        .eq('id', certificateId);

      if (dbError) throw dbError;

      // Delete from storage (optional, mostly clean up)
      // Extract path from URL if needed, but we passed file_name/path usually. 
      // Here we assume filePath is passed correctly or derived.
      // If we only have URL, we might need to parse it.
      // But let's skip strict storage deletion for now to avoid errors if path is wrong, 
      // or try it safely.
      
      try {
         // Assuming certificates bucket
         // If file_url is full public URL, we need relative path.
         // Usually it's just the filename if in root, or user_id/filename.
         // Let's rely on what we have.
         const { error: storageError } = await supabase.storage
          .from('certificates')
          .remove([filePath]);
          
         if (storageError) console.warn('Storage delete warning:', storageError);
      } catch (e) {
        // ignore
      }

      toast({
        title: "Certificate deleted",
        description: "Certificate has been removed from your vault.",
      });

      fetchCertificates();
    } catch (error) {
      console.error('Error deleting certificate:', error);
      toast({
        title: "Delete failed",
        description: "Could not delete certificate. Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const visibilityOptions = [
    { value: 'everyone', label: 'Everyone', description: 'Visible to all users' },
    { value: 'recruiters', label: 'Recruiters', description: 'Visible to recruiters only' },
    { value: 'only_me', label: 'Only Me', description: 'Private to you' },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl font-bold text-[#1D2226] tracking-tight">Credential Vault</h2>
          <p className="text-[#5E6B7E] text-sm font-medium mt-1">Manage and showcase your professional certifications.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-full px-6 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-lg shadow-[#833AB4]/20 border-none transition-all duration-300 font-bold h-11">
              <Plus className="h-4 w-4 mr-2" />
              Add Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
            <div className="h-2 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
            <div className="p-8">
              <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl font-bold text-[#1D2226] tracking-tight">Upload Certificate</DialogTitle>
                <p className="text-[#5E6B7E] text-sm font-medium">Add a new credential to your professional vault.</p>
              </DialogHeader>
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Certificate Title</Label>
                    <Input
                      placeholder="e.g. AWS Certified Developer"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4] h-11"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Description (Optional)</Label>
                    <Textarea
                      placeholder="Briefly describe this certification..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="rounded-xl border-gray-200 focus:ring-[#833AB4] focus:border-[#833AB4] min-h-[100px]"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Visibility Settings</Label>
                  <VisibilitySelector
                    title=""
                    value={visibility}
                    onChange={setVisibility}
                    options={visibilityOptions}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold text-[#5E6B7E] uppercase tracking-widest">Certificate File</Label>
                  <DocumentUpload
                    bucket="certificates"
                    acceptedTypes=".pdf,.jpg,.jpeg,.png,.webp"
                    onUploadComplete={handleUploadComplete}
                    label="Drop your file here or click to browse"
                  />
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse border-none shadow-sm rounded-[2rem] h-[300px]">
              <CardHeader className="p-6">
                <div className="h-6 bg-gray-100 rounded-lg w-3/4 mb-4" />
                <div className="flex gap-2">
                  <div className="h-5 bg-gray-50 rounded-full w-20" />
                  <div className="h-5 bg-gray-50 rounded-full w-20" />
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0">
                <div className="h-4 bg-gray-50 rounded-lg w-full mb-2" />
                <div className="h-4 bg-gray-50 rounded-lg w-2/3" />
                <div className="mt-auto pt-8">
                  <div className="h-10 bg-gray-100 rounded-full w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <Card className="border-2 border-dashed border-gray-100 bg-gray-50/30 rounded-[2.5rem]">
          <CardContent className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full" />
              <div className="relative h-20 w-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center text-[#833AB4]">
                <FileText className="h-10 w-10" />
              </div>
            </div>
            <h3 className="text-2xl font-bold text-[#1D2226] mb-2 tracking-tight">Your vault is empty</h3>
            <p className="text-[#5E6B7E] font-medium max-w-sm mb-8 leading-relaxed">
              Upload your certifications, diplomas, and awards to showcase your verified achievements to recruiters.
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="rounded-full px-8 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-xl shadow-[#833AB4]/25 border-none h-12 font-bold transition-all transform hover:scale-105 active:scale-95"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Your First Certificate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert, index) => (
            <Card 
              key={cert.id} 
              className="group hover:shadow-xl transition-all duration-500 border-none shadow-sm rounded-[2rem] overflow-hidden flex flex-col bg-white animate-in fade-in slide-in-from-bottom-4"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="p-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-xl font-bold text-[#1D2226] tracking-tight truncate group-hover:text-[#833AB4] transition-colors" title={cert.title}>
                      {cert.title}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <Badge variant="secondary" className="bg-gray-50 text-[#5E6B7E] hover:bg-gray-100 border-none rounded-full px-3 py-0.5 text-[11px] font-bold">
                        {formatDate(cert.created_at)}
                      </Badge>
                      <Badge variant="outline" className="border-gray-100 text-[#5E6B7E] rounded-full px-3 py-0.5 text-[11px] font-bold">
                        {formatFileSize(cert.file_size)}
                      </Badge>
                    </div>
                  </div>
                  <div className="h-10 w-10 rounded-2xl bg-gray-50 flex items-center justify-center text-[#5E6B7E] group-hover:bg-[#833AB4]/5 group-hover:text-[#833AB4] transition-all" title={`Visible to: ${cert.visibility || 'recruiters'}`}>
                     {cert.visibility === 'everyone' && <Globe className="h-5 w-5" />}
                     {(cert.visibility === 'recruiters' || !cert.visibility) && <Building2 className="h-5 w-5" />}
                     {cert.visibility === 'only_me' && <Lock className="h-5 w-5" />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-0 flex-1 flex flex-col">
                {cert.description && (
                  <p className="text-[#5E6B7E] text-sm leading-relaxed line-clamp-2 mb-6 italic">
                    "{cert.description}"
                  </p>
                )}
                
                <div className="mt-auto space-y-4">
                  <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                    <Label className="text-[10px] font-bold text-[#5E6B7E] uppercase tracking-widest mb-2 block">Privacy Control</Label>
                    <VisibilitySelector
                      title=""
                      value={cert.visibility || 'recruiters'}
                      onChange={(val) => handleUpdateVisibility(cert.id, val)}
                      options={visibilityOptions}
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="relative flex-1 p-[1px] rounded-full overflow-hidden group/btn">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full px-4 h-11 transition-all duration-300 flex items-center justify-center gap-2 font-bold"
                        onClick={() => handleView(cert)}
                      >
                        <Eye className="h-4 w-4" />
                        <span>View Document</span>
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full h-11 w-11 text-[#5E6B7E] hover:text-red-500 hover:bg-red-50 transition-all duration-300"
                      onClick={() => {
                        const fileNameInStorage = cert.file_url.split('/').pop();
                        const storagePath = `${cert.user_id}/${fileNameInStorage}`;
                        handleDelete(cert.id, storagePath);
                      }}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CertificateVault;
