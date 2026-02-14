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
      <Card className="rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 bg-white shadow-none sm:shadow-card overflow-hidden">
        <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4 border-b border-gray-50">
          <CardTitle className="flex items-center gap-2 text-gray-900">
            <Users className="w-5 h-5 text-primary" />
            Team Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 py-6 sm:px-8 sm:pb-8">
          {members.length === 0 ? (
            <div className="text-center py-16 text-gray-500 border-2 border-dashed border-gray-100 rounded-[2rem] bg-gray-50/30">
              <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center shadow-sm mx-auto mb-4">
                <Users className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">No team members yet</h3>
              <p className="max-w-[260px] mx-auto">
                {isAdmin ? 'Invite team members to help manage this company.' : 'No team members are listed for this company.'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 hover:border-primary/20 hover:bg-primary/[0.02] transition-all duration-300 group"
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                      <AvatarImage src={member.profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-gray-100 text-gray-600 font-semibold">
                        {member.profile?.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-bold text-gray-900">
                        {member.profile?.display_name || 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-500">
                        {member.profile?.profession || 'Team Member'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {getRoleBadge(member.role, member.user_id)}
                    
                    {isAdmin && member.user_id !== ownerId && member.user_id !== currentUserId && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-xl shadow-lg border-gray-100">
                          {member.role === 'content_admin' && (
                            <DropdownMenuItem 
                              className="rounded-lg py-2.5 cursor-pointer"
                              onClick={() => handleRoleChange(member.id, 'super_admin')}
                            >
                              <ShieldCheck className="w-4 h-4 mr-2 text-gray-500" />
                              Promote to Super Admin
                            </DropdownMenuItem>
                          )}
                          {member.role === 'super_admin' && (
                            <DropdownMenuItem 
                              className="rounded-lg py-2.5 cursor-pointer"
                              onClick={() => handleRoleChange(member.id, 'content_admin')}
                            >
                              <ShieldAlert className="w-4 h-4 mr-2 text-gray-500" />
                              Demote to Content Admin
                            </DropdownMenuItem>
                          )}
                          <div className="h-px bg-gray-50 my-1" />
                          <DropdownMenuItem 
                            onClick={() => setRemovingMemberId(member.id)}
                            className="text-destructive focus:text-destructive focus:bg-destructive/5 rounded-lg py-2.5 cursor-pointer font-medium"
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
