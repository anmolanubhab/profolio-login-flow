import { useState, useEffect } from 'react';
import { Save, X, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface SocialLinksSectionProps {
  userId: string;
}

const SocialLinksSection = ({ userId }: SocialLinksSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const [socialLinks, setSocialLinks] = useState({
    linkedin_url: '',
    github_url: '',
    twitter_url: '',
    website: ''
  });

  useEffect(() => {
    fetchSocialLinks();
  }, [userId]);

  const fetchSocialLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('linkedin_url, github_url, twitter_url, website' as any)
        .eq('user_id', userId)
        .single();

      if (error) throw error;
      
      setSocialLinks({
        linkedin_url: (data as any)?.linkedin_url || '',
        github_url: (data as any)?.github_url || '',
        twitter_url: (data as any)?.twitter_url || '',
        website: (data as any)?.website || ''
      });
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(socialLinks as any)
        .eq('user_id', userId);

      if (error) throw error;

      setIsEditing(false);
      toast({
        title: "Success",
        description: "Social links updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    fetchSocialLinks(); // Reset to original values
    setIsEditing(false);
  };

  const formatUrl = (url: string) => {
    if (!url) return '';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  };

  const getDisplayUrl = (url: string) => {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
              <div className="h-10 bg-muted rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Social Links</h2>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            Edit Links
          </Button>
        )}
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Professional Links</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">LinkedIn</label>
                  <Input
                    placeholder="https://linkedin.com/in/your-profile"
                    value={socialLinks.linkedin_url}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, linkedin_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">GitHub</label>
                  <Input
                    placeholder="https://github.com/your-username"
                    value={socialLinks.github_url}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, github_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Twitter</label>
                  <Input
                    placeholder="https://twitter.com/your-handle"
                    value={socialLinks.twitter_url}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter_url: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Personal Website</label>
                  <Input
                    placeholder="https://your-website.com"
                    value={socialLinks.website}
                    onChange={(e) => setSocialLinks(prev => ({ ...prev, website: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="bg-success hover:bg-success/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {socialLinks.linkedin_url && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium">LinkedIn</p>
                    <p className="text-sm text-muted-foreground">
                      {getDisplayUrl(socialLinks.linkedin_url)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={formatUrl(socialLinks.linkedin_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {socialLinks.github_url && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium">GitHub</p>
                    <p className="text-sm text-muted-foreground">
                      {getDisplayUrl(socialLinks.github_url)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={formatUrl(socialLinks.github_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {socialLinks.twitter_url && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium">Twitter</p>
                    <p className="text-sm text-muted-foreground">
                      {getDisplayUrl(socialLinks.twitter_url)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={formatUrl(socialLinks.twitter_url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {socialLinks.website && (
                <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                  <div>
                    <p className="font-medium">Personal Website</p>
                    <p className="text-sm text-muted-foreground">
                      {getDisplayUrl(socialLinks.website)}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={formatUrl(socialLinks.website)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              )}

              {!socialLinks.linkedin_url && !socialLinks.github_url && !socialLinks.twitter_url && !socialLinks.website && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    No social links added yet. Click "Edit Links" to add your professional profiles.
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SocialLinksSection;