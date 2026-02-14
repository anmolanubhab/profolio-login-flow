import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mail, Building2, Check, X, Clock, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { useCompanyInvitations } from '@/hooks/use-company';
import { useCompanyAdmin } from '@/hooks/use-company-admin';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Self-contained component that fetches its own data
export const CompanyInvitationsCard = () => {
  const { toast } = useToast();
  const { invitations, isLoading, acceptInvitation, rejectInvitation } = useCompanyInvitations();
  const { refetch: refetchCompanies } = useCompanyAdmin();

  // State for acceptance dialog
  const [selectedInvitation, setSelectedInvitation] = useState<{id: string, companyName: string} | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onAcceptClick = (invitationId: string, companyName: string) => {
    setSelectedInvitation({ id: invitationId, companyName });
    setTokenInput('');
  };

  const handleConfirmAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvitation) return;
    if (!tokenInput.trim()) {
      toast({
        title: 'Token Required',
        description: 'Please enter the invitation token sent to your email.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    const result = await acceptInvitation(selectedInvitation.id, tokenInput.trim());
    setIsSubmitting(false);

    if (result.success) {
      toast({
        title: 'Invitation Accepted',
        description: `You are now a team member of ${selectedInvitation.companyName}.`,
      });
      // Refresh company memberships after accepting
      refetchCompanies();
      setSelectedInvitation(null);
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
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-gradient-to-r from-primary/5 to-primary/10 shadow-none sm:shadow-card mb-4 sm:mb-6 overflow-hidden">
        <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-primary" />
            Company Invitations
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
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
    <>
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-gradient-to-r from-primary/5 to-primary/10 shadow-none sm:shadow-card mb-4 sm:mb-6 overflow-hidden">
        <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="w-4 h-4 text-primary" />
            Company Invitations ({invitations.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
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
                      onClick={() => onAcceptClick(invitation.id, invitation.company?.name || 'this company')}
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

      <Dialog open={!!selectedInvitation} onOpenChange={(open) => !open && setSelectedInvitation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Verify Invitation
            </DialogTitle>
            <DialogDescription>
              For security, please enter the invitation token sent to your email to join <strong>{selectedInvitation?.companyName}</strong>.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleConfirmAccept} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="token">Invitation Token</Label>
              <Input
                id="token"
                placeholder="Paste your token here..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                autoComplete="off"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedInvitation(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Verifying...' : 'Verify & Join'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
