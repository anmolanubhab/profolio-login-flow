import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Building2, CheckCircle2, Loader2 } from 'lucide-react';

interface InvitationDetails {
  id: string;
  company_id: string;
  email: string;
  role: string;
  status: string;
  company: { name: string; logo_url: string | null } | null;
}

export default function CompanyInviteAccept() {
  const { invitationId, token } = useParams<{ invitationId: string; token: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [invitationId]);

  const init = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);

    if (!user) {
      setLoading(false);
      return;
    }

    if (!invitationId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('company_invitations')
        .select('id, company_id, email, role, status, companies(name, logo_url)')
        .eq('id', invitationId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setInvitation({
          id: data.id,
          company_id: data.company_id,
          email: data.email,
          role: data.role,
          status: data.status,
          company: (data as any).companies || null,
        });
      }
    } catch (error) {
      console.error('Error fetching invitation:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleAccept = async () => {
    if (!invitationId || !token) return;
    setAccepting(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.rpc('accept_company_invitation_v2', {
        invitation_id: invitationId,
        token_input: token,
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (result?.success) {
        setAccepted(true);
        toast({ title: 'Welcome to the team!', description: 'You have joined the company.' });
        setTimeout(() => navigate(`/company/${invitation?.company_id}`), 1500);
      } else {
        setErrorMsg(result?.error || 'Could not accept this invitation.');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setErrorMsg(error.message || 'Could not accept this invitation.');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onSignOut={handleSignOut}>
        <div className="max-w-md mx-auto py-16 px-4">
          <Skeleton className="h-56 w-full" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-md mx-auto py-16 px-4 text-center">
          <Card>
            <CardContent className="p-8">
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h1 className="text-xl font-semibold mb-2">Sign in required</h1>
              <p className="text-muted-foreground mb-6">
                Please sign in with the email address this invitation was sent to.
              </p>
              <Button asChild>
                <Link to="/">Go to sign in</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="max-w-md mx-auto py-16 px-4">
        <Card>
          <CardHeader className="text-center">
            {invitation?.company?.logo_url ? (
              <img
                src={invitation.company.logo_url}
                alt={invitation.company.name}
                className="w-16 h-16 rounded-xl object-cover mx-auto mb-2 border border-border"
              />
            ) : (
              <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-2" />
            )}
            <CardTitle>Company Invitation</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            {accepted ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
                <p className="text-foreground font-medium">Invitation accepted!</p>
                <p className="text-sm text-muted-foreground">Redirecting to the company page&hellip;</p>
              </div>
            ) : !invitation ? (
              <p className="text-muted-foreground">
                This invitation could not be found, or it isn't addressed to your account's email.
              </p>
            ) : invitation.status !== 'pending' ? (
              <p className="text-muted-foreground">This invitation has already been {invitation.status}.</p>
            ) : (
              <>
                <p className="text-foreground">
                  You've been invited to join{' '}
                  <span className="font-semibold">{invitation.company?.name || 'this company'}</span> as a{' '}
                  <span className="font-semibold">
                    {invitation.role === 'super_admin' ? 'Super Admin' : 'Content Admin'}
                  </span>
                  .
                </p>
                {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
                <Button onClick={handleAccept} disabled={accepting} className="w-full">
                  {accepting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Accept Invitation
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
