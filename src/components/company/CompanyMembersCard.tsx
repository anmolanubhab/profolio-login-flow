import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, MoreVertical, Crown, UserMinus, ShieldCheck, ShieldAlert } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Member {
  id: string;
  company_id: string;
  user_id: string;
  role: 'super_admin' | 'content_admin';
  created_at: string;
  profile?: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
    profession: string | null;
  };
}

interface CompanyMembersCardProps {
  members: Member[];
  isAdmin: boolean;
  ownerId?: string;
  onRemoveMember: (memberId: string) => Promise<boolean>;
  onUpdateRole: (memberId: string, newRole: 'super_admin' | 'content_admin') => Promise<boolean>;
  currentUserId?: string;
}

export const CompanyMembersCard = ({
  members,
  isAdmin,
  ownerId,
  onRemoveMember,
  onUpdateRole,
  currentUserId
}: CompanyMembersCardProps) => {
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRemove = async () => {
    if (!removingMemberId) return;
    
    const success = await onRemoveMember(removingMemberId);
    if (success) {
      toast({
        title: 'Member Removed',
        description: 'The team member has been removed from the company.',
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to remove team member.',
        variant: 'destructive',
      });
    }
    setRemovingMemberId(null);
  };

  const handleRoleChange = async (memberId: string, newRole: 'super_admin' | 'content_admin') => {
    const success = await onUpdateRole(memberId, newRole);
    if (success) {
      toast({
        title: 'Role Updated',
        description: `Team member role has been updated to ${newRole === 'super_admin' ? 'Super Admin' : 'Content Admin'}.`,
      });
    } else {
      toast({
        title: 'Error',
        description: 'Failed to update team member role.',
        variant: 'destructive',
      });
    }
  };

  const getRoleBadge = (role: string, userId: string) => {
    if (userId === ownerId) {
      return (
        <Badge variant="default" className="bg-amber-500 hover:bg-amber-500">
          <Crown className="w-3 h-3 mr-1" />
          Owner
        </Badge>
      );
    }
    
    if (role === 'super_admin') {
      return (
        <Badge variant="default" className="bg-primary hover:bg-primary">
          <ShieldCheck className="w-3 h-3 mr-1" />
          Super Admin
        </Badge>
      );
    }
    
    return (
      <Badge variant="secondary">
        <ShieldAlert className="w-3 h-3 mr-1" />
        Content Admin
      </Badge>
    );
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Team Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No team members yet.</p>
              {isAdmin && <p className="text-sm">Invite team members to help manage this company.</p>}
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={member.profile?.avatar_url || ''} />
                      <AvatarFallback>
                        {member.profile?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">
                        {member.profile?.display_name || 'Unknown User'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {member.profile?.profession || 'Team Member'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {getRoleBadge(member.role, member.user_id)}
                    
                    {isAdmin && member.user_id !== ownerId && member.user_id !== currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {member.role === 'content_admin' && (
                            <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'super_admin')}>
                              <ShieldCheck className="w-4 h-4 mr-2" />
                              Promote to Super Admin
                            </DropdownMenuItem>
                          )}
                          {member.role === 'super_admin' && (
                            <DropdownMenuItem onClick={() => handleRoleChange(member.id, 'content_admin')}>
                              <ShieldAlert className="w-4 h-4 mr-2" />
                              Demote to Content Admin
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem 
                            onClick={() => setRemovingMemberId(member.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <UserMinus className="w-4 h-4 mr-2" />
                            Remove from Company
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!removingMemberId} onOpenChange={(open) => !open && setRemovingMemberId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this team member from the company? 
              They will lose access to company management features.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
