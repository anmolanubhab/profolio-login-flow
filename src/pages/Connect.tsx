import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatInterface from '@/components/connect/ChatInterface';
import InterviewInterface from '@/components/connect/InterviewInterface';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const Connect = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

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
        <p>Please log in to access Connect.</p>
      </div>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div
        className="min-h-screen"
        style={{ background: "radial-gradient(1000px 300px at 0% 0%, #e9d5ff 0%, #fce7f3 40%, #dbeafe 80%)" }}
      >
        <div className="relative w-full bg-gradient-to-r from-indigo-300 via-pink-200 to-blue-200 rounded-b-3xl py-14 px-8 overflow-hidden">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
              <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                <h1 className="page-title">Connect</h1>
                <p className="text-[#5E6B7E] text-base md:text-xl mt-2">Stay in touch with your network and coordinate interviews.</p>
              </div>
              <div className="flex w-full md:w-auto justify-center md:justify-end animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                <Button 
                  variant="outline" 
                  onClick={() => navigate('/dashboard')}
                  className="group rounded-full h-10 px-0 relative p-[1px] overflow-hidden border-none transition-transform hover:scale-105 hover:shadow-lg"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                  <span className="relative z-10 rounded-full bg-white text-gray-900 px-4 py-2 flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </span>
                </Button>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-40">
            <div className="absolute -top-20 -right-32 w-[400px] h-[400px] bg-white/30 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-16 w-[300px] h-[300px] bg-white/20 rounded-full blur-3xl" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto py-8 sm:py-12 px-0 sm:px-6">
          <Tabs defaultValue="chat" className="w-full">
            <div className="flex justify-center mb-10">
              <TabsList className="bg-gray-100/50 p-1.5 rounded-2xl h-auto">
                <TabsTrigger 
                  value="chat" 
                  className="rounded-xl px-12 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-base font-semibold"
                >
                  Messages
                </TabsTrigger>
                <TabsTrigger 
                  value="interviews" 
                  className="rounded-xl px-12 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-base font-semibold"
                >
                  Interviews
                </TabsTrigger>
              </TabsList>
            </div>
            
            <TabsContent value="chat" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <ChatInterface user={user} />
            </TabsContent>
            
            <TabsContent value="interviews" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <InterviewInterface user={user} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
};

export default Connect;
