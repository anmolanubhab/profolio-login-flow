import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import NavBar from '@/components/NavBar';
import PostInput from '@/components/PostInput';
import QuickActions from '@/components/QuickActions';
import PostCard from '@/components/PostCard';

// Sample posts data - replace with real data from your backend
const samplePosts = [
  {
    id: '1',
    user: {
      name: 'John Doe',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
    },
    content: 'Attending the Future Innovators Conference! Excited to participate in the conference and connect with professionals in the field.',
    image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=400&fit=crop',
    timeAgo: '2h',
    likes: 12,
    comments: 3,
    isLiked: false
  },
  {
    id: '2',
    user: {
      name: 'Sarah Wilson',
      avatar: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
    },
    content: 'Just completed my project management certification! Ready to take on new challenges and lead amazing teams.',
    timeAgo: '4h',
    likes: 28,
    comments: 8,
    isLiked: true
  },
  {
    id: '3',
    user: {
      name: 'Mike Chen',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
    },
    content: 'Networking event was incredible! Met so many talented professionals and learned about exciting opportunities in tech.',
    image: 'https://images.unsplash.com/photo-1511578314322-379afb476865?w=600&h=400&fit=crop',
    timeAgo: '6h',
    likes: 15,
    comments: 5,
    isLiked: false
  }
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
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
        />

        {/* Quick Actions */}
        <QuickActions />

        {/* Feed Section */}
        <div className="space-y-4">
          {samplePosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;