import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Mail, UserPlus, ShieldCheck, ShieldAlert } from 'lucide-react';

interface InviteEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyName: string;
  onInvite: (email: string, role: 'super_admin' | 'content_admin') => Promise<{ success: boolean; error?: string; token?: string }>;
}

export const InviteEmployeeDialog = ({
  open,
  onOpenChange,
  companyName,
  onInvite
}: InviteEmployeeDialogProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'super_admin' | 'content_admin'>('content_admin');
  const [isLoading, setIsLoading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const { toast } = useToast();

  const handleCopyLink = () => {
    if (inviteToken) {
      navigator.clipboard.writeText(inviteToken);
      toast({
        title: 'Copied',
        description: 'Invitation token copied to clipboard.',
      });
    }
  };

  const handleClose = () => {
    setInviteToken(null);
    setEmail('');
    setRole('content_admin');
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: 'Email Required',
        description: 'Please enter an email address.',
        variant: 'destructive',
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    const result = await onInvite(email.trim().toLowerCase(), role);
    setIsLoading(false);

    if (result.success && result.token) {
      setInviteToken(result.token);
      toast({
        title: 'Invitation Created',
        description: `Invitation created for ${email}. Please share the token.`,
      });
    } else if (result.success) {
       // Fallback if no token returned (legacy path?)
       toast({ title: 'Invitation Sent', description: `Invitation sent to ${email}.` });
       handleClose();
    } else {
      toast({
        title: 'Invitation Failed',
        description: result.error || 'Failed to send invitation. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (inviteToken) {
     return (
       <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
         <DialogContent className="sm:max-w-md">
           <DialogHeader>
             <DialogTitle>Invitation Created</DialogTitle>
             <DialogDescription>
               Share this secure token with <strong>{email}</strong>. They will need it to accept the invitation.
             </DialogDescription>
           </DialogHeader>
           <div className="p-4 bg-muted rounded-md break-all font-mono text-sm border">
             {inviteToken}
           </div>
           <DialogFooter className="sm:justify-start">
             <Button type="button" variant="secondary" onClick={handleCopyLink}>
               Copy Token
             </Button>
             <Button type="button" onClick={handleClose}>
               Done
             </Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>
     );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Invite Team Member
          </DialogTitle>
          <DialogDescription>
            Invite someone to join <strong>{companyName}</strong> as a team member.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The person must have an account with this email to accept the invitation.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={(value: 'super_admin' | 'content_admin') => setRole(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="content_admin">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Content Admin</p>
                      <p className="text-xs text-muted-foreground">Can post and manage content</p>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="super_admin">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4" />
                    <div>
                      <p className="font-medium">Super Admin</p>
                      <p className="text-xs text-muted-foreground">Full access including team management</p>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted p-3 text-sm">
            <h4 className="font-medium mb-1">Role Permissions:</h4>
            <ul className="text-muted-foreground space-y-1">
              <li>• <strong>Content Admin:</strong> Create posts, manage content</li>
              <li>• <strong>Super Admin:</strong> All content permissions + invite/manage team members</li>
            </ul>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send Invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
