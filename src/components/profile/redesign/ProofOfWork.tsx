import { useState, useEffect } from 'react';
import { Plus, ExternalLink, Award, FolderGit2, Image as ImageIcon, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Certificate {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  created_at: string;
}

interface ProofOfWorkProps {
  userId: string;
  isOwnProfile: boolean;
}

export const ProofOfWork = ({ userId, isOwnProfile }: ProofOfWorkProps) => {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    return () => controller.abort();
  }, [userId]);

  const fetchData = async (signal?: AbortSignal) => {
    try {
      setLoading(true);
      // Fetch Certificates only (projects table doesn't exist in schema)
      const { data: certsData, error: certsError } = await supabase
        .from('certificates')
        .select('id, title, description, file_url, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (certsError) {
        if (certsError.code === 'ABORTED') return;
        throw certsError;
      }

      setCertificates(certsData || []);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      console.error('Error fetching proof of work:', error);
    } finally {
      setLoading(false);
    }
  };

  const CertificateCard = ({ cert }: { cert: Certificate }) => (
    <Card className="group hover:shadow-md transition-all duration-200 border-gray-100">
      <CardContent className="p-4 flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
          <Award className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{cert.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{cert.description || 'No description'}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">Issued {format(new Date(cert.created_at), 'MMM yyyy')}</span>
            {cert.file_url && (
              <a 
                href={cert.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View Credential <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Proof of Work</h2>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted rounded-lg"></div>
          <div className="h-20 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Certificates & Credentials</h2>
      </div>

      <div className="space-y-4">
        {certificates.map(cert => (
          <CertificateCard key={cert.id} cert={cert} />
        ))}
        {certificates.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Award className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p>No certificates added yet.</p>
            {isOwnProfile && (
              <p className="text-sm mt-2">Upload certificates from the Certificates page.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};