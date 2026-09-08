import { useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ChatInterface from '@/components/connect/ChatInterface';
import InterviewInterface from '@/components/connect/InterviewInterface';
import { ArrowLeft, CalendarDays, MessageSquare } from 'lucide-react';
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
      {/* min-w-0 + w-full: every level can shrink, so nothing forces the page
          wider than the viewport. The .layout wrapper (Layout) already gives
          the horizontal page padding + centred max-width; no extra container
          here (the old `container mx-auto max-w-6xl` double-wrapper is what
          pushed content past the screen edge on mobile). */}
      <div className="mx-auto w-full min-w-0 max-w-5xl space-y-4 sm:space-y-6">
        {/* Back + hero. Back to Dashboard gets its own row; the title sits
            below it and can never be clipped by a sibling on a narrow row. */}
        <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-accent/50 via-background to-background p-4 sm:p-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="rounded-full"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to Dashboard
          </Button>
          <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-tight sm:text-[26px]">
            Stay Connected
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Messages and interviews in one place
          </p>
        </div>

        <Tabs defaultValue="chat" className="w-full min-w-0">
          {/* Full-width, equal-width segmented control. h-auto + py on the
              triggers so the icon+label fit without clipping on 320px. */}
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-xl p-1">
            <TabsTrigger value="chat" className="min-w-0 gap-2 rounded-lg py-2.5">
              <MessageSquare className="h-4 w-4 shrink-0" />
              <span className="truncate">Messages</span>
            </TabsTrigger>
            <TabsTrigger value="interviews" className="min-w-0 gap-2 rounded-lg py-2.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span className="truncate">Interviews</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="mt-4 min-w-0">
            <ChatInterface user={user} />
          </TabsContent>

          <TabsContent value="interviews" className="mt-4 min-w-0">
            <InterviewInterface user={user} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Connect;