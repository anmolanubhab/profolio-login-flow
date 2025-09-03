import { useState, useEffect } from 'react';
import { Camera, Edit3, Save, X, User, MapPin, Phone, Globe, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

interface Profile {
  id: string;
  display_name?: string;
  bio?: string;
  profession?: string;
  location?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  [key: string]: any; // Allow additional properties
}

interface ProfileHeaderProps {
  userId: string;
}

const ProfileHeader = ({ userId }: ProfileHeaderProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    display_name: '',
    bio: '',
    profession: '',
    location: '',
    phone: '',
    website: ''
  });

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data as any);
        setEditData({
          display_name: (data as any).display_name || '',
          bio: (data as any).bio || '',
          profession: (data as any).profession || '',
          location: (data as any).location || '',
          phone: (data as any).phone || '',
          website: (data as any).website || ''
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

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, avatar_url: publicUrl } : null);
      toast({
        title: "Success",
        description: "Profile photo updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(editData as any)
        .eq('user_id', userId);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...editData } : null);
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Profile updated successfully!",
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
    setEditData({
      display_name: profile?.display_name || '',
      bio: profile?.bio || '',
      profession: profile?.profession || '',
      location: profile?.location || '',
      phone: profile?.phone || '',
      website: profile?.website || ''
    });
    setIsEditing(false);
  };

  if (loading) {
    return (
      <Card className="p-6 mb-6 bg-gradient-card shadow-card">
        <div className="animate-pulse flex space-x-4">
          <div className="rounded-full bg-muted h-24 w-24"></div>
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 bg-gradient-card shadow-card border-0">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Profile Information</h2>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-success hover:bg-success/90 text-success-foreground shadow-elegant"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={saving}
                  className="border-muted-foreground/20 hover:bg-muted/50"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsEditing(true)}
                className="border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40"
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Profile Photo Section */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="relative">
              <Avatar className="h-28 w-28 md:h-32 md:w-32 border-4 border-background shadow-elegant">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                  {profile?.display_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
              <label htmlFor="photo-upload" className="absolute -bottom-1 -right-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2.5 cursor-pointer transition-smooth shadow-elegant">
                <Camera className="h-4 w-4" />
                <input
                  id="photo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                />
              </label>
            </div>
            {uploadingPhoto && (
              <p className="text-sm text-muted-foreground">Uploading photo...</p>
            )}
          </div>

          <div className="flex-1 space-y-6">
            {isEditing ? (
              <div className="space-y-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name" className="text-sm font-medium text-foreground flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      Full Name
                    </Label>
                    <Input
                      id="display_name"
                      placeholder="Enter your full name"
                      value={editData.display_name}
                      onChange={(e) => setEditData(prev => ({ ...prev, display_name: e.target.value }))}
                      className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="profession" className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-primary" />
                      Profession
                    </Label>
                    <Input
                      id="profession"
                      placeholder="e.g., Senior Software Engineer"
                      value={editData.profession}
                      onChange={(e) => setEditData(prev => ({ ...prev, profession: e.target.value }))}
                      className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth"
                    />
                  </div>
                </div>

                <Separator className="bg-muted/30" />

                {/* Contact Information */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">Contact Information</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location" className="text-sm font-medium text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        Location
                      </Label>
                      <Input
                        id="location"
                        placeholder="City, Country"
                        value={editData.location}
                        onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                        className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4 text-primary" />
                        Phone Number
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+1 (555) 123-4567"
                        value={editData.phone}
                        onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                        className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="website" className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" />
                      Website
                    </Label>
                    <Input
                      id="website"
                      placeholder="https://yourwebsite.com"
                      value={editData.website}
                      onChange={(e) => setEditData(prev => ({ ...prev, website: e.target.value }))}
                      className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth"
                    />
                  </div>
                </div>

                <Separator className="bg-muted/30" />

                {/* About Section */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">About Me</h4>
                  <div className="space-y-2">
                    <Label htmlFor="bio" className="text-sm font-medium text-foreground">
                      Professional Summary
                    </Label>
                    <Textarea
                      id="bio"
                      placeholder="Write a brief description about yourself, your experience, and your professional goals..."
                      value={editData.bio}
                      onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      className="bg-background/50 border-muted focus:border-primary/50 focus:bg-background transition-smooth resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      {editData.bio.length}/500 characters
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Display Mode */
              <div className="space-y-6">
                {/* Basic Information Display */}
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold text-foreground">
                    {profile?.display_name || 'Your Name'}
                  </h1>
                  {profile?.profession && (
                    <p className="text-lg text-primary font-semibold">
                      {profile.profession}
                    </p>
                  )}
                </div>

                {/* Contact Information Display */}
                {(profile?.location || profile?.phone || profile?.website) && (
                  <>
                    <Separator className="bg-muted/30" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {profile?.location && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm">{profile.location}</span>
                        </div>
                      )}
                      {profile?.phone && (
                        <div className="flex items-center gap-3 text-muted-foreground">
                          <Phone className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-sm">{profile.phone}</span>
                        </div>
                      )}
                      {profile?.website && (
                        <div className="flex items-center gap-3 text-muted-foreground md:col-span-2">
                          <Globe className="h-4 w-4 text-primary flex-shrink-0" />
                          <a 
                            href={profile.website} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-sm text-primary hover:underline transition-smooth"
                          >
                            {profile.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Bio Display */}
                {profile?.bio && (
                  <>
                    <Separator className="bg-muted/30" />
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">About</h4>
                      <p className="text-foreground leading-relaxed text-sm">
                        {profile.bio}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeader;