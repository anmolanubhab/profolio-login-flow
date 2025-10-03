import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Search, UserPlus, Eye } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  bio?: string;
  profession?: string;
  location?: string;
  avatar_url?: string;
  profile_visibility?: string;
}

const Network = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
    };

    getUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchProfiles();
    }
  }, [user]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProfiles(profiles);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = profiles.filter(profile => 
        profile.display_name?.toLowerCase().includes(query) ||
        profile.profession?.toLowerCase().includes(query) ||
        profile.location?.toLowerCase().includes(query)
      );
      setFilteredProfiles(filtered);
    }
  }, [searchQuery, profiles]);

  const fetchProfiles = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out private profiles unless connected
      const visibleProfiles = data?.filter(profile => 
        profile.profile_visibility === 'public' || 
        profile.profile_visibility === 'connections_only'
      ) || [];

      setProfiles(visibleProfiles);
      setFilteredProfiles(visibleProfiles);
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleViewProfile = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <Layout user={user!} onSignOut={handleSignOut}>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user!} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Discover People</h1>
          <p className="text-muted-foreground">Connect with professionals and expand your network</p>
        </div>

        <Card className="mb-6 bg-gradient-card shadow-card border-0">
          <CardHeader>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, profession, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-background/50 border-muted focus:border-primary/50"
              />
            </div>
          </CardHeader>
        </Card>

        {filteredProfiles.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <p className="text-muted-foreground">
              {searchQuery ? 'No profiles found matching your search.' : 'No profiles available yet.'}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProfiles.map((profile) => (
              <Card key={profile.id} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center space-y-4">
                    <Avatar className="h-20 w-20 border-4 border-background shadow-elegant">
                      <AvatarImage src={profile.avatar_url} />
                      <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                        {profile.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>

                    <div className="space-y-2 w-full">
                      <h3 className="font-semibold text-lg text-foreground">
                        {profile.display_name || 'User'}
                      </h3>
                      {profile.profession && (
                        <p className="text-sm text-primary font-medium">
                          {profile.profession}
                        </p>
                      )}
                      {profile.location && (
                        <p className="text-sm text-muted-foreground">
                          {profile.location}
                        </p>
                      )}
                      {profile.bio && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                          {profile.bio}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2 w-full pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProfile(profile.user_id)}
                        className="flex-1"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Profile
                      </Button>
                    </div>

                    {profile.profile_visibility && (
                      <Badge variant="secondary" className="text-xs">
                        {profile.profile_visibility === 'public' ? 'Public' : 'Connections Only'}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Network;