import { useState, useEffect } from 'react';
import { Camera, Edit3, Save, X, User, MapPin, Phone, Globe, Briefcase, Lock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { ProfileHero } from './redesign/ProfileHero';

interface Profile {
  id: string;
  display_name?: string;
  bio?: string;
  profession?: string;
  location?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  profile_visibility?: string;
  [key: string]: any;
}

interface ProfileHeaderProps {
  userId: string;
}

const ProfileHeader = ({ userId }: ProfileHeaderProps) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [skillsCount, setSkillsCount] = useState(0);
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
    profile_visibility: 'public',
    cover_url: ''
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

      // Fetch skills count
      const { count: sCount } = await supabase
        .from('skills')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      setSkillsCount(sCount || 0);

      if (data) {
        setProfile(data as any);
        setEditData({
          display_name: (data as any).display_name || '',
          bio: (data as any).bio || '',
          profession: (data as any).profession || '',
          location: (data as any).location || '',
          phone: (data as any).phone || '',
          website: (data as any).website || '',
          profile_visibility: (data as any).profile_visibility || 'public',
          cover_url: (data as any).cover_url || ''
        });
      } else {
        // Create a new profile if it doesn't exist
        const { data: newProfile, error: createError } = await supabase
          .from('profiles')
          .insert({ user_id: userId })
          .select()
          .single();

        if (createError) throw createError;

        setProfile(newProfile as any);
        setEditData({
          display_name: '',
          bio: '',
          profession: '',
          location: '',
          phone: '',
          website: '',
          profile_visibility: 'public',
          cover_url: ''
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
      // Use 'avatars' bucket for cover images (public bucket that exists)
      const result = await secureUpload({
        bucket: 'avatars',
        file: file,
        userId: userId
      });

      if (!result.success) {
        console.error('Cover upload failed:', result.error);
        throw new Error(result.error || 'Upload failed');
      }

      const publicUrl = result.url;
      console.log('Cover uploaded successfully:', publicUrl);

      // Store cover URL in photo_url field (existing column in profiles table)
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ photo_url: publicUrl })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Database update error:', updateError);
        throw updateError;
      }

      setProfile(prev => prev ? { ...prev, photo_url: publicUrl } : null);
      setEditData(prev => ({ ...prev, cover_url: publicUrl }));
      
      toast({
        title: "Success",
        description: "Cover photo updated successfully!",
      });
    } catch (error: any) {
      console.error('Cover upload error:', error);
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
      website: profile?.website || '',
      profile_visibility: profile?.profile_visibility || 'public',
      cover_url: profile?.cover_url || ''
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

  if (!isEditing && profile) {
    return (
      <ProfileHero 
        profile={profile} 
        isOwnProfile={true} 
        onEdit={() => setIsEditing(true)} 
        skillsCount={skillsCount}
      />
    );
  }

  return (
    <Card className="mb-6 bg-gradient-card shadow-card border-0">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-foreground">Edit Profile</h2>
          <div className="flex gap-2">
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
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Cover Photo Section */}
        <div className="relative h-32 md:h-40 w-full rounded-xl overflow-hidden bg-muted group">
          {editData.cover_url ? (
            <img src={editData.cover_url} alt="Cover" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-primary/10 to-primary/5 flex items-center justify-center text-muted-foreground">
              <span className="text-sm">No cover photo</span>
            </div>
          )}
          <label htmlFor="cover-upload" className="absolute bottom-4 right-4 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 cursor-pointer transition-smooth backdrop-blur-sm">
            <Camera className="h-5 w-5" />
            <input
              id="cover-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverUpload}
              disabled={uploadingCover}
            />
          </label>
          {uploadingCover && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
          )}
        </div>

        {/* Profile Photo Section */}
        <div className="flex flex-col md:flex-row gap-6 -mt-12 px-4 relative z-10">
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProfileHeader;