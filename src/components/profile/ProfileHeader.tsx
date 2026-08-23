import { useState, useEffect } from 'react';
import { Camera, Edit3, Save, X, User, MapPin, Phone, Globe, Briefcase, Lock, Sparkles, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Profile {
  id: string;
  display_name?: string | null;
  bio?: string | null;
  profession?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  cover_url?: string | null;
  phone?: string | null;
  website?: string | null;
  profile_visibility?: string | null;
  open_to_work?: boolean | null;
  [key: string]: any;
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
  const [uploadingCover, setUploadingCover] = useState(false);
  const { toast } = useToast();

  const [editData, setEditData] = useState({
    display_name: '',
    bio: '',
    profession: '',
    location: '',
    phone: '',
    website: '',
    profile_visibility: 'public'
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
        setProfile(data);
        setEditData({
          display_name: data.display_name || '',
          bio: data.bio || '',
          profession: data.profession || '',
          location: data.location || '',
          phone: data.phone || '',
          website: data.website || '',
          profile_visibility: data.profile_visibility || 'public'
        });
      } else {
        // Create a new profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ user_id: userId })
          .select()
          .single();

        if (createError) throw createError;

        setProfile(newProfile);
        setEditData({
          display_name: '',
          bio: '',
          profession: '',
          location: '',
          phone: '',
          website: '',
          profile_visibility: 'public'
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
      const { secureUpload } = await import('@/lib/secure-upload');
      const result = await secureUpload({
        bucket: 'avatars',
        file: file,
        userId: userId
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const publicUrl = result.url;

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

  const handleCoverUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const { secureUpload } = await import('@/lib/secure-upload');
      const result = await secureUpload({
        bucket: 'avatars',
        file: file,
        userId: userId
      });

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ cover_url: result.url })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      setProfile(prev => prev ? { ...prev, cover_url: result.url } : null);
      toast({
        title: "Success",
        description: "Cover photo updated successfully!",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingCover(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(editData)
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
      website: profile?.website || '',
      profile_visibility: profile?.profile_visibility || 'public'
    });
    setIsEditing(false);
  };

  if (loading) {
    return (
      <Card className="mb-6 shadow-card border-0 overflow-hidden">
        <div className="h-40 md:h-52 bg-muted animate-pulse" />
        <div className="px-6 pb-6">
          <div className="animate-pulse flex space-x-4 -mt-12">
            <div className="rounded-full bg-muted h-24 w-24 border-4 border-background"></div>
            <div className="flex-1 space-y-2 py-1 mt-14">
              <div className="h-4 bg-muted rounded w-3/4"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="mb-6 shadow-card border-0 overflow-hidden">
      {/* Cover */}
      <div
        className="relative h-36 md:h-48 w-full"
        style={
          profile?.cover_url
            ? { backgroundImage: `url(${profile.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : { background: 'var(--gradient-hero)' }
        }
      >
        <div className="absolute top-3 right-3 flex gap-2">
          {!isEditing && (
            <Button
              size="sm"
              onClick={() => setIsEditing(true)}
              className="bg-background/80 text-foreground hover:bg-background backdrop-blur-md shadow-elegant border-0"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
          <label
            htmlFor="cover-upload"
            className="inline-flex items-center gap-2 rounded-md bg-background/80 hover:bg-background text-foreground text-sm font-medium px-3 py-1.5 cursor-pointer backdrop-blur-md shadow-elegant transition-smooth"
          >
            <ImagePlus className="h-4 w-4" />
            <span className="hidden sm:inline">{uploadingCover ? 'Uploading...' : 'Cover'}</span>
            <input
              id="cover-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
              disabled={uploadingCover}
            />
          </label>
        </div>

        {/* Avatar, overlapping the cover/content boundary */}
        <div className="absolute -bottom-12 left-6">
          <div className="relative">
            <Avatar className="h-24 w-24 md:h-28 md:w-28 border-4 border-background shadow-elegant ring-2 ring-primary/20">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-xl font-bold bg-primary text-primary-foreground">
                {profile?.display_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <label htmlFor="photo-upload" className="absolute -bottom-1 -right-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 cursor-pointer transition-smooth shadow-elegant">
              <Camera className="h-3.5 w-3.5" />
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
        </div>
      </div>

      <CardContent className="pt-16 space-y-6">
        {uploadingPhoto && (
          <p className="text-sm text-muted-foreground -mt-4">Uploading photo...</p>
        )}

        {isEditing && (
          <div className="flex justify-end gap-2 -mt-2">
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
          </div>
        )}

        <div className="flex-1 space-y-6">
            {isEditing ? (
              <div className="space-y-6">
                {/* Privacy Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wide flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Privacy Settings
                  </h4>
                  <div className="space-y-2">
                    <Label htmlFor="profile_visibility" className="text-sm font-medium text-foreground">
                      Profile Visibility
                    </Label>
                    <Select
                      value={editData.profile_visibility}
                      onValueChange={(value) => setEditData(prev => ({ ...prev, profile_visibility: value }))}
                    >
                      <SelectTrigger className="bg-background/50 border-muted focus:border-primary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public - Everyone can view</SelectItem>
                        <SelectItem value="connections_only">Connections Only - Only connected users</SelectItem>
                        <SelectItem value="private">Private - Only you can view</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Control who can see your full profile information
                    </p>
                  </div>
                </div>

                <Separator className="bg-muted/30" />

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
              <div className="space-y-5">
                {/* Basic Information Display */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      {profile?.display_name || 'Your Name'}
                    </h1>
                    {profile?.open_to_work && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success/10 text-success text-xs font-semibold px-2.5 py-1 border border-success/20">
                        <Sparkles className="h-3 w-3" />
                        Open to work
                      </span>
                    )}
                  </div>
                  {profile?.profession && (
                    <p className="text-base text-primary font-semibold">
                      {profile.profession}
                    </p>
                  )}
                </div>

                {/* Contact Information Display */}
                {(profile?.location || profile?.phone || profile?.website) && (
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {profile?.location && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm">{profile.location}</span>
                      </div>
                    )}
                    {profile?.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-sm">{profile.phone}</span>
                      </div>
                    )}
                    {profile?.website && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe className="h-3.5 w-3.5 text-primary flex-shrink-0" />
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
                )}

                {/* Bio Display */}
                {profile?.bio && (
                  <div className="rounded-lg bg-secondary/50 p-4 space-y-1.5">
                    <h4 className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">About</h4>
                    <p className="text-foreground leading-relaxed text-sm">
                      {profile.bio}
                    </p>
                  </div>
                )}
              </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeader;