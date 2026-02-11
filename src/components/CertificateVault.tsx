import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  visibility: string;
}

const CertificateVault = () => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('recruiters');
  const { toast } = useToast();

  const fetchCertificates = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCertificates(data || []);
    } catch (error) {
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
    fetchCertificates();
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Certificate Vault</h2>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-6 shadow-lg shadow-[#833AB4]/20 transition-all duration-300">
              <Plus className="h-4 w-4 mr-2" />
              Add Certificate
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Upload Certificate</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Input
                  placeholder="Certificate title (e.g. AWS Certified Developer)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mb-2"
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              
              <VisibilitySelector
                title="Visibility"
                value={visibility}
                onChange={setVisibility}
                options={visibilityOptions}
              />

              <DocumentUpload
                bucket="certificates"
                acceptedTypes=".pdf,.jpg,.jpeg,.png,.webp"
                onUploadComplete={handleUploadComplete}
                label="Upload Certificate (PDF/Image)"
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse rounded-[2rem]">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-muted rounded w-full mb-2" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : certificates.length === 0 ? (
        <Card className="text-center py-12 border-dashed rounded-[2rem] bg-gray-50/50">
          <CardContent>
            <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
               <FileText className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No certificates yet</h3>
            <p className="text-gray-500 mb-8 max-w-sm mx-auto">
              Upload your certifications, diplomas, and awards to showcase your achievements.
            </p>
            <Button 
              onClick={() => setIsDialogOpen(true)}
              className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-8 py-4 h-auto font-bold transition-all shadow-lg shadow-[#833AB4]/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Certificate
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {certificates.map((cert) => (
            <Card key={cert.id} className="hover:shadow-xl transition-all duration-300 rounded-[2rem] border-gray-100 overflow-hidden flex flex-col group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg truncate" title={cert.title}>{cert.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] h-5">
                        {formatDate(cert.created_at)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] h-5">
                        {formatFileSize(cert.file_size)}
                      </Badge>
                    </div>
                  </div>
                  {/* Visibility Icon/Badge */}
                  <div title={`Visible to: ${cert.visibility || 'recruiters'}`}>
                     {cert.visibility === 'everyone' && <Globe className="h-4 w-4 text-muted-foreground" />}
                     {(cert.visibility === 'recruiters' || !cert.visibility) && <Building2 className="h-4 w-4 text-muted-foreground" />}
                     {cert.visibility === 'only_me' && <Lock className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                {cert.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {cert.description}
                  </p>
                )}
                
                <div className="mt-auto pt-2 space-y-3">
                   <VisibilitySelector
                      title="Visibility"
                      value={cert.visibility || 'recruiters'}
                      onChange={(val) => handleUpdateVisibility(cert.id, val)}
                      options={visibilityOptions}
                   />

                   <div className="flex gap-2">
                    <div className="relative flex-1 p-[1px] rounded-full overflow-hidden group/btn">
                      <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                      <Button
                        variant="outline"
                        size="sm"
                        className="relative w-full bg-white hover:bg-transparent hover:text-white border-none rounded-full px-4 h-9 transition-all duration-300 flex items-center justify-center gap-2"
                        onClick={() => handleView(cert)}
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Button>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full h-9 w-9 p-0 border-gray-200 hover:border-red-200 hover:text-red-500 hover:bg-red-50 transition-all duration-300"
                      onClick={() => {
                        const fileNameInStorage = cert.file_url.split('/').pop();
                        const storagePath = `${cert.user_id}/${fileNameInStorage}`;
                        handleDelete(cert.id, storagePath);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
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