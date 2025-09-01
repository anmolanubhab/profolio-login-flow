import { useState, useEffect } from 'react';
import { Camera, Edit3, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';

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
      const fileName = `${userId}_${Date.now()}.${fileExt}`;

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
    <Card className="p-6 mb-6 bg-gradient-card shadow-card">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Profile Photo */}
        <div className="flex flex-col items-center">
          <div className="relative">
            <Avatar className="h-24 w-24 md:h-32 md:w-32">
              <AvatarImage src={profile?.avatar_url} />
              <AvatarFallback className="text-lg font-semibold bg-primary text-primary-foreground">
                {profile?.display_name?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            <label htmlFor="photo-upload" className="absolute bottom-0 right-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full p-2 cursor-pointer transition-smooth">
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
            <p className="text-sm text-muted-foreground mt-2">Uploading...</p>
          )}
        </div>

        {/* Profile Information */}
        <div className="flex-1">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-4">
                  <Input
                    placeholder="Full Name"
                    value={editData.display_name}
                    onChange={(e) => setEditData(prev => ({ ...prev, display_name: e.target.value }))}
                  />
                  <Input
                    placeholder="Profession"
                    value={editData.profession}
                    onChange={(e) => setEditData(prev => ({ ...prev, profession: e.target.value }))}
                  />
                  <Input
                    placeholder="Location"
                    value={editData.location}
                    onChange={(e) => setEditData(prev => ({ ...prev, location: e.target.value }))}
                  />
                  <Input
                    placeholder="Phone Number"
                    value={editData.phone}
                    onChange={(e) => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                  <Input
                    placeholder="Website"
                    value={editData.website}
                    onChange={(e) => setEditData(prev => ({ ...prev, website: e.target.value }))}
                  />
                  <Textarea
                    placeholder="About me..."
                    value={editData.bio}
                    onChange={(e) => setEditData(prev => ({ ...prev, bio: e.target.value }))}
                    rows={3}
                  />
                </div>
              ) : (
                <div>
                  <h1 className="text-2xl font-bold text-foreground mb-2">
                    {profile?.display_name || 'Your Name'}
                  </h1>
                  {profile?.profession && (
                    <p className="text-lg text-primary font-medium mb-1">
                      {profile.profession}
                    </p>
                  )}
                  {profile?.location && (
                    <p className="text-muted-foreground mb-2">
                      📍 {profile.location}
                    </p>
                  )}
                  {profile?.phone && (
                    <p className="text-muted-foreground mb-2">
                      📞 {profile.phone}
                    </p>
                  )}
                  {profile?.website && (
                    <p className="text-muted-foreground mb-2">
                      🌐 <a href={profile.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        {profile.website}
                      </a>
                    </p>
                  )}
                  {profile?.bio && (
                    <p className="text-foreground mt-4 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 ml-4">
              {isEditing ? (
                <>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-success hover:bg-success/90"
                  >
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={saving}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-4 w-4 mr-1" />
                  Edit
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ProfileHeader;