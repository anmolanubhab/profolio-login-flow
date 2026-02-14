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

import { useAuth } from '@/contexts/AuthContext';

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
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [filteredProfiles, setFilteredProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      const controller = new AbortController();
      fetchProfiles(controller.signal);
      return () => controller.abort();
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

  const fetchProfiles = async (signal?: AbortSignal) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .neq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .abortSignal(signal);

      if (error) {
        if (error.code === 'ABORTED') return;
        throw error;
      }

      // Filter out private profiles unless connected
      const visibleProfiles = data?.filter(profile => 
        profile.profile_visibility === 'public' || 
        profile.profile_visibility === 'connections_only'
      ) || [];

      setProfiles(visibleProfiles);
      setFilteredProfiles(visibleProfiles);
    } catch (error: any) {
      if (error.name === 'AbortError') return;
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
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Discover People
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Connect with professionals and expand your network.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto py-8 px-0 sm:px-4">
          <Card className="mb-10 bg-white rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 shadow-none sm:shadow-card overflow-hidden">
            <CardHeader className="p-4 sm:p-8">
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-[#833AB4] transition-colors" />
                <Input
                  type="text"
                  placeholder="Search by name, profession, or location..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 bg-gray-50/50 border-gray-100 rounded-2xl focus:border-[#833AB4]/30 focus:ring-[#833AB4]/10 transition-all text-lg"
                />
              </div>
            </CardHeader>
          </Card>

          {filteredProfiles.length === 0 ? (
            <Card className="p-12 sm:p-20 text-center bg-white rounded-none sm:rounded-[2rem] border-0 sm:border shadow-none sm:shadow-card">
              <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <Search className="h-10 w-10 text-gray-300" />
              </div>
              <p className="text-xl font-medium text-gray-400">
                {searchQuery ? 'No profiles found matching your search.' : 'No profiles available yet.'}
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {filteredProfiles.map((profile) => (
                <Card key={profile.id} className="group bg-white rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 shadow-none sm:shadow-card hover:shadow-2xl hover:-translate-y-2 transition-all duration-500 overflow-hidden flex flex-col">
                  <div className="h-24 bg-gradient-to-r from-[#0077B5]/10 via-[#833AB4]/10 to-[#E1306C]/10 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-gradient-shift" />
                  </div>
                  <CardContent className="pt-0 px-4 sm:px-8 pb-6 sm:pb-8 flex-1 flex flex-col items-center text-center relative">
                    <div className="relative -mt-12 mb-6">
                      <Avatar className="h-24 w-24 border-4 border-white shadow-xl group-hover:scale-105 transition-transform duration-500">
                        <AvatarImage src={profile.avatar_url} className="object-cover" />
                        <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600">
                          {profile.display_name?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute bottom-1 right-1 bg-green-500 h-4 w-4 rounded-full border-2 border-white shadow-sm" />
                    </div>

                    <div className="space-y-2 w-full mb-8">
                      <h3 className="font-bold text-xl text-gray-900 group-hover:text-[#0077B5] transition-colors line-clamp-1">
                        {profile.display_name || 'User'}
                      </h3>
                      {profile.profession && (
                        <p className="text-sm font-bold text-[#833AB4] uppercase tracking-wider">
                          {profile.profession}
                        </p>
                      )}
                      {profile.location && (
                        <p className="text-sm text-gray-400 font-medium">
                          {profile.location}
                        </p>
                      )}
                      {profile.bio && (
                        <p className="text-sm text-gray-500 line-clamp-2 mt-4 leading-relaxed px-2">
                          {profile.bio}
                        </p>
                      )}
                    </div>

                    <div className="mt-auto w-full space-y-3">
                      <Button
                        variant="outline"
                        onClick={() => handleViewProfile(profile.id)}
                        className="w-full rounded-full font-bold h-11 border-gray-100 text-gray-600 hover:bg-gray-50 hover:border-gray-200 transition-all"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Profile
                      </Button>
                      <Button
                        className="w-full rounded-full font-bold h-11 text-white border-none transition-all hover:opacity-90 active:scale-[0.98] bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Connect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Network;