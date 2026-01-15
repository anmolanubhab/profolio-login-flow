import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Building2, Check, X, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useCompanyInvitations } from '@/hooks/use-company';
import { useCompanyAdmin } from '@/hooks/use-company-admin';

// Self-contained component that fetches its own data
export const CompanyInvitationsCard = () => {
  const { toast } = useToast();
  const { invitations, isLoading, acceptInvitation, rejectInvitation } = useCompanyInvitations();
  const { refetch: refetchCompanies } = useCompanyAdmin();

  const handleAccept = async (invitationId: string, companyName: string) => {
    const result = await acceptInvitation(invitationId);
    if (result.success) {
      toast({
        title: 'Invitation Accepted',
        description: `You are now a team member of ${companyName}.`,
      });
      // Refresh company memberships after accepting
      refetchCompanies();
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to accept invitation.',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (invitationId: string) => {
    const result = await rejectInvitation(invitationId);
    if (result.success) {
      toast({
        title: 'Invitation Declined',
        description: 'The invitation has been declined.',
      });
    } else {
      toast({
        title: 'Error',
        description: result.error || 'Failed to decline invitation.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-primary" />
            Company Invitations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) {
    return null; // Don't show the card if there are no invitations
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="w-4 h-4 text-primary" />
          Company Invitations ({invitations.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <div
              key={invitation.id}
              className="p-4 rounded-lg border border-border bg-background"
            >
              <div className="flex items-start gap-3">
                {invitation.company?.logo_url ? (
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={invitation.company.logo_url} />
                    <AvatarFallback>
                      <Building2 className="w-6 h-6" />
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">
                    {invitation.company?.name || 'Unknown Company'}
                  </h3>
                  {invitation.company?.industry && (
                    <p className="text-sm text-muted-foreground">{invitation.company.industry}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant={invitation.role === 'super_admin' ? 'default' : 'secondary'}>
                      {invitation.role === 'super_admin' ? 'Admin' : 'Content Admin'}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Expires {formatDistanceToNow(new Date(invitation.expires_at), { addSuffix: true })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleReject(invitation.id)}
                  >
                    <X className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Decline</span>
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAccept(invitation.id, invitation.company?.name || 'this company')}
                  >
                    <Check className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Accept</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
