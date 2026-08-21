import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Users, UserPlus, Copy, X, Loader2 } from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type CompanyRole = Database['public']['Enums']['company_role'];

interface CompanyTeamManagerProps {
  companyId: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: CompanyRole;
  created_at: string;
  profile: { full_name: string | null; avatar_url: string | null } | null;
}

interface InvitationRow {
  id: string;
  email: string;
  role: CompanyRole;
  status: string;
  expires_at: string;
  created_at: string;
}

export const CompanyTeamManager = ({ companyId }: CompanyTeamManagerProps) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CompanyRole>('content_admin');
  const [inviting, setInviting] = useState(false);
  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  useEffect(() => {
    fetchTeamData();
  }, [companyId]);

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const [{ data: memberData, error: memberError }, { data: inviteData, error: inviteError }] = await Promise.all([
        supabase
          .from('company_members')
          .select('id, user_id, role, created_at, profiles!company_members_user_id_fkey(full_name, avatar_url)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
        supabase
          .from('company_invitations')
          .select('id, email, role, status, expires_at, created_at')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false }),
      ]);

      if (memberError) throw memberError;
      if (inviteError) throw inviteError;

      setMembers(
        (memberData || []).map((m: any) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          created_at: m.created_at,
          profile: m.profiles || null,
        }))
      );
      setInvitations(inviteData || []);
    } catch (error: any) {
      console.error('Error fetching team data:', error);
      toast({ title: 'Error', description: 'Could not load team information.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email) {
      toast({ title: 'Email required', description: 'Enter an email address to invite.', variant: 'destructive' });
      return;
    }

    setInviting(true);
    setInviteLink(null);
    try {
      const { data: token, error } = await supabase.rpc('create_company_invitation', {
        company_id: companyId,
        email,
        role: inviteRole,
      });

      if (error) throw error;

      // The RPC returns only the plain token; look up the invitation id it just created
      const { data: invRow, error: lookupError } = await supabase
        .from('company_invitations')
        .select('id')
        .eq('company_id', companyId)
        .eq('email', email)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      if (invRow && token) {
        const link = `${window.location.origin}/company-invite/${invRow.id}/${token}`;
        setInviteLink(link);
      }

      toast({ title: 'Invitation created', description: `Share the invite link with ${email}.` });
      setInviteEmail('');
      fetchTeamData();
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      toast({ title: 'Error', description: error.message || 'Could not create invitation.', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleCancelInvite = async (invitationId: string) => {
    setCancelingId(invitationId);
    try {
      const { error } = await supabase.from('company_invitations').delete().eq('id', invitationId);
      if (error) throw error;
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
      toast({ title: 'Invitation canceled' });
    } catch (error: any) {
      console.error('Error canceling invitation:', error);
      toast({ title: 'Error', description: error.message || 'Could not cancel invitation.', variant: 'destructive' });
    } finally {
      setCancelingId(null);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast({ title: 'Copied', description: 'Invite link copied to clipboard.' });
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy the link manually.', variant: 'destructive' });
    }
  };

  const pendingInvitations = invitations.filter((i) => i.status === 'pending');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          Team
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite form */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Invite a teammate</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              type="email"
              placeholder="teammate@email.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1"
            />
            <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="content_admin">Content Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleInvite} disabled={inviting}>
              {inviting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
              Invite
            </Button>
          </div>
          {inviteLink && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-muted text-sm">
              <span className="flex-1 truncate">{inviteLink}</span>
              <Button variant="outline" size="sm" onClick={handleCopyLink}>
                <Copy className="w-3.5 h-3.5 mr-1" />
                Copy
              </Button>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Share this link with the invitee directly &mdash; invites aren't emailed automatically yet.
          </p>
        </div>

        {/* Members list */}
        <div>
          <h3 className="text-sm font-medium mb-2">Members ({members.length})</h3>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground">No team members yet besides the owner.</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback>{(member.profile?.full_name || '?').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.profile?.full_name || 'Unknown user'}</p>
                  </div>
                  <Badge variant="secondary">{member.role === 'super_admin' ? 'Super Admin' : 'Content Admin'}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending invitations */}
        {pendingInvitations.length > 0 && (
          <div>
            <h3 className="text-sm font-medium mb-2">Pending Invitations ({pendingInvitations.length})</h3>
            <div className="space-y-2">
              {pendingInvitations.map((invite) => (
                <div key={invite.id} className="flex items-center gap-3 p-2 rounded-md border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{invite.email}</p>
                    <p className="text-xs text-muted-foreground">
                      Expires {new Date(invite.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge variant="outline">{invite.role === 'super_admin' ? 'Super Admin' : 'Content Admin'}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvite(invite.id)}
                    disabled={cancelingId === invite.id}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
