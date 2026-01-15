import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Briefcase, Edit, Trash2, Send } from 'lucide-react';
import { format } from 'date-fns';

interface Draft {
  id: string;
  title: string;
  description: string;
  location: string;
  employment_type: string;
  remote_option: string;
  posted_at: string;
  company: {
    name: string;
  };
}

interface MyDraftsProps {
  companyId: string;
  onPublish: () => void;
}

export const MyDrafts = ({ companyId, onPublish }: MyDraftsProps) => {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDrafts();
  }, [companyId]);

  const fetchDrafts = async () => {
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          title,
          description,
          location,
          employment_type,
          remote_option,
          posted_at,
          company:companies(name)
        `)
        .eq('company_id', companyId)
        .eq('status', 'draft')
        .order('posted_at', { ascending: false });

      if (error) throw error;
      setDrafts(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (jobId: string) => {
    setPublishing(jobId);
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: 'open' })
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Job published successfully!',
      });

      fetchDrafts();
      onPublish();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setPublishing(null);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this draft?')) return;

    setDeleting(jobId);
    try {
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Draft deleted successfully',
      });

      fetchDrafts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-4" />
              <Skeleton className="h-10 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
        <Briefcase className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">No draft jobs yet. Create one to save for later!</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {drafts.map((draft) => (
        <Card key={draft.id} className="bg-gradient-card shadow-card border-0">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-xl mb-2">{draft.title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{draft.location}</span>
                </div>
              </div>
              <Badge variant="secondary">Draft</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground line-clamp-2">
              {draft.description}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{draft.employment_type}</Badge>
              {draft.remote_option && (
                <Badge variant="outline">{draft.remote_option}</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Created {format(new Date(draft.posted_at), 'MMM dd, yyyy')}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => handlePublish(draft.id)}
                disabled={publishing === draft.id || deleting === draft.id}
              >
                <Send className="h-4 w-4 mr-2" />
                {publishing === draft.id ? 'Publishing...' : 'Publish'}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleDelete(draft.id)}
                disabled={publishing === draft.id || deleting === draft.id}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleting === draft.id ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
