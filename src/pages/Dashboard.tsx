import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NavBar from '@/components/NavBar';
import PostInput from '@/components/PostInput';
import QuickActions from '@/components/QuickActions';
import Feed from '@/components/Feed';

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "You have been signed out successfully.",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p>Please log in to access the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <NavBar 
        user={{
          email: user.email,
          avatar: user.user_metadata?.avatar_url
        }} 
        onSignOut={handleSignOut} 
      />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Post Input Section */}
        <PostInput 
          user={{
            email: user.email,
            avatar: user.user_metadata?.avatar_url
          }}
          onPostCreated={() => setFeedRefresh(prev => prev + 1)}
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Feed Section */}
        <Feed refresh={feedRefresh} />
      </main>
    </div>
  );
};

export default Dashboard;