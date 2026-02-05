import { useState, useEffect } from 'react';
import { Save, X, ExternalLink, Mail, Phone, Globe, Linkedin, Github, Twitter, Briefcase, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface SocialLinksSectionProps {
  userId: string;
  isOwnProfile?: boolean;
}

const SocialLinksSection = ({ userId, isOwnProfile = false }: SocialLinksSectionProps) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    linkedin_url: '',
    github_url: '',
    twitter_url: '',
    website: '',
    display_email: '',
    phone: '',
    show_email: false,
    show_phone: false,
    availability_status: 'open_to_networking'
  });

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('linkedin_url, github_url, twitter_url, website, display_email, phone, show_email, show_phone, availability_status')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setFormData({
          linkedin_url: data.linkedin_url || '',
          github_url: data.github_url || '',
          twitter_url: data.twitter_url || '',
          website: data.website || '',
          display_email: data.display_email || '',
          phone: data.phone || '',
          show_email: data.show_email || false,
          show_phone: data.show_phone || false,
          availability_status: data.availability_status || 'open_to_networking'
        });
      }
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
        .update(formData)
        .eq('user_id', userId);

      if (error) throw error;

      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile settings updated successfully!",
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
    fetchData(); // Reset to original values
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

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
      case 'hiring':
        return <Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200">Hiring</Badge>;
      case 'open_to_work':
        return <Badge className="bg-green-100 text-green-700 border-green-200 hover:bg-green-200">Open to Work</Badge>;
      case 'busy':
        return <Badge className="bg-red-100 text-red-700 border-red-200 hover:bg-red-200">Busy</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200">Open to Networking</Badge>;
    }
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
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Contact & Visibility</h2>
        {!isEditing && isOwnProfile && (
          <Button onClick={() => setIsEditing(true)}>
            Edit Settings
          </Button>
        )}
      </div>

      <Card className="shadow-card overflow-hidden">
        <CardHeader className="bg-muted/30 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="h-5 w-5 text-gray-500" />
              Availability Status
            </CardTitle>
            {!isEditing && getAvailabilityBadge(formData.availability_status)}
          </div>
        </CardHeader>
        {isEditing && (
          <CardContent className="pt-4">
             <Select 
                value={formData.availability_status} 
                onValueChange={(val) => setFormData({...formData, availability_status: val})}
              >
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_to_networking">Open to Networking</SelectItem>
                <SelectItem value="open_to_work">Open to Work</SelectItem>
                <SelectItem value="hiring">Hiring</SelectItem>
                <SelectItem value="busy">Busy / Do Not Disturb</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Email */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-500" /> Display Email
              </Label>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-email" className="text-xs text-muted-foreground">Public</Label>
                  <Switch 
                    id="show-email"
                    checked={formData.show_email}
                    onCheckedChange={(checked) => setFormData({...formData, show_email: checked})}
                  />
                </div>
              )}
            </div>
            {isEditing ? (
              <Input 
                value={formData.display_email}
                onChange={(e) => setFormData({...formData, display_email: e.target.value})}
                placeholder="email@example.com"
              />
            ) : (
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <span className={!formData.display_email ? "text-muted-foreground italic" : ""}>
                  {formData.display_email || "No email added"}
                </span>
                {isOwnProfile && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white px-2 py-1 rounded-md border shadow-sm">
                    {formData.show_email ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {formData.show_email ? "Visible" : "Hidden"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-500" /> Phone Number
              </Label>
              {isEditing && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="show-phone" className="text-xs text-muted-foreground">Public</Label>
                  <Switch 
                    id="show-phone"
                    checked={formData.show_phone}
                    onCheckedChange={(checked) => setFormData({...formData, show_phone: checked})}
                  />
                </div>
              )}
            </div>
            {isEditing ? (
              <Input 
                value={formData.phone}
                onChange={(e) => setFormData({...formData, phone: e.target.value})}
                placeholder="+1 (555) 000-0000"
              />
            ) : (
              <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
                <span className={!formData.phone ? "text-muted-foreground italic" : ""}>
                  {formData.phone || "No phone added"}
                </span>
                {isOwnProfile && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white px-2 py-1 rounded-md border shadow-sm">
                    {formData.show_phone ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {formData.show_phone ? "Visible" : "Hidden"}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="text-lg">Social Profiles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isEditing ? (
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Linkedin className="h-4 w-4" /> LinkedIn
                </Label>
                <Input
                  placeholder="https://linkedin.com/in/..."
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkedin_url: e.target.value }))}
                />
              </div>

              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Github className="h-4 w-4" /> GitHub
                </Label>
                <Input
                  placeholder="https://github.com/..."
                  value={formData.github_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, github_url: e.target.value }))}
                />
              </div>

              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Twitter className="h-4 w-4" /> Twitter / X
                </Label>
                <Input
                  placeholder="https://twitter.com/..."
                  value={formData.twitter_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, twitter_url: e.target.value }))}
                />
              </div>

              <div>
                <Label className="mb-2 block flex items-center gap-2">
                  <Globe className="h-4 w-4" /> Personal Website
                </Label>
                <Input
                  placeholder="https://your-website.com"
                  value={formData.website}
                  onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-4 justify-end">
                <Button variant="outline" onClick={handleCancel} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
                <Button 
                  onClick={handleSave} 
                  disabled={saving}
                  className="bg-primary hover:bg-primary/90"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {formData.linkedin_url && (
                <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                  <a href={formatUrl(formData.linkedin_url)} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="h-5 w-5 mr-3 text-[#0077b5]" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium text-sm">LinkedIn</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {getDisplayUrl(formData.linkedin_url)}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </a>
                </Button>
              )}
              
              {formData.github_url && (
                <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                  <a href={formatUrl(formData.github_url)} target="_blank" rel="noopener noreferrer">
                    <Github className="h-5 w-5 mr-3" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium text-sm">GitHub</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {getDisplayUrl(formData.github_url)}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </a>
                </Button>
              )}

              {formData.twitter_url && (
                <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                  <a href={formatUrl(formData.twitter_url)} target="_blank" rel="noopener noreferrer">
                    <Twitter className="h-5 w-5 mr-3 text-[#1DA1F2]" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium text-sm">Twitter</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {getDisplayUrl(formData.twitter_url)}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </a>
                </Button>
              )}

              {formData.website && (
                <Button variant="outline" className="justify-start h-auto py-3 px-4" asChild>
                  <a href={formatUrl(formData.website)} target="_blank" rel="noopener noreferrer">
                    <Globe className="h-5 w-5 mr-3 text-green-600" />
                    <div className="text-left overflow-hidden">
                      <div className="font-medium text-sm">Website</div>
                      <div className="text-xs text-muted-foreground truncate max-w-[150px]">
                        {getDisplayUrl(formData.website)}
                      </div>
                    </div>
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </a>
                </Button>
              )}

              {!formData.linkedin_url && !formData.github_url && !formData.twitter_url && !formData.website && (
                <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg border border-dashed">
                  <p className="text-muted-foreground text-sm">
                    No social links added yet.
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