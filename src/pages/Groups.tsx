import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Users, Plus, Building2 } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string | null;
  industry: string[] | null;
  is_public: boolean | null;
  owner_user_id: string | null;
  rules: string | null;
  memberCount: number;
  isMember: boolean;
}

const Groups = () => {
  const [user, setUser] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newIndustry, setNewIndustry] = useState('');
  const [newRules, setNewRules] = useState('');
  const [newIsPublic, setNewIsPublic] = useState(true);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/');
        return;
      }
      setUser(user);
    };
    getUser();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      fetchGroups();
    }
  }, [user]);

  const fetchGroups = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: groupsData, error } = await supabase
        .from('groups')
        .select('*')
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const { data: memberships } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', user.id);

      const myGroupIds = new Set((memberships || []).map((m) => m.group_id));

      const withCounts: Group[] = await Promise.all(
        (groupsData || []).map(async (g) => {
          const { count } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', g.id);
          return {
            ...g,
            memberCount: count || 0,
            isMember: myGroupIds.has(g.id),
          };
        })
      );

      setGroups(withCounts);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleCreateGroup = async () => {
    if (!user || !newName.trim()) {
      toast({ title: 'Name required', description: 'Please enter a group name.', variant: 'destructive' });
      return;
    }
    setCreating(true);
    try {
      const industryArray = newIndustry
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name: newName.trim(),
          industry: industryArray.length > 0 ? industryArray : null,
          rules: newRules.trim() || null,
          is_public: newIsPublic,
          owner_user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Owner auto-joins their own group
      await supabase.from('group_members').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'owner',
      });

      toast({ title: 'Group created', description: `"${data.name}" has been created.` });
      setShowCreateDialog(false);
      setNewName('');
      setNewIndustry('');
      setNewRules('');
      setNewIsPublic(true);
      fetchGroups();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleMembership = async (group: Group) => {
    if (!user) return;
    setJoiningId(group.id);
    try {
      if (group.isMember) {
        const { error } = await supabase
          .from('group_members')
          .delete()
          .eq('group_id', group.id)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('group_members')
          .insert({ group_id: group.id, user_id: user.id });
        if (error) throw error;
      }
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? {
                ...g,
                isMember: !g.isMember,
                memberCount: g.isMember ? Math.max(0, g.memberCount - 1) : g.memberCount + 1,
              }
            : g
        )
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) {
    return (
      <Layout user={user} onSignOut={handleSignOut}>
        <div className="container mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout user={user} onSignOut={handleSignOut}>
      <div className="container mx-auto max-w-6xl">
        <div className="mb-8 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Groups</h1>
            <p className="text-muted-foreground">Join public groups to connect around shared interests</p>
          </div>

          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Group
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create a Group</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label htmlFor="group-name">Name</Label>
                  <Input
                    id="group-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Frontend Developers"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-industry">Industry (comma-separated)</Label>
                  <Input
                    id="group-industry"
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    placeholder="e.g. Technology, Software"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="group-rules">Rules</Label>
                  <Textarea
                    id="group-rules"
                    value={newRules}
                    onChange={(e) => setNewRules(e.target.value)}
                    placeholder="Group rules for members (optional)"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="group-public">Public group</Label>
                  <Switch id="group-public" checked={newIsPublic} onCheckedChange={setNewIsPublic} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleCreateGroup} disabled={creating}>
                  {creating ? 'Creating...' : 'Create Group'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {groups.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card shadow-card border-0">
            <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No public groups yet. Be the first to create one!</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Card key={group.id} className="bg-gradient-card shadow-card border-0 hover:shadow-elegant transition-smooth">
                <CardHeader className="pb-2">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-lg text-foreground truncate">{group.name}</h3>
                      {group.industry && group.industry.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {group.industry.map((ind) => (
                            <Badge key={ind} variant="secondary" className="text-xs">
                              {ind}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
                  )}
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Users className="w-4 h-4 mr-1" />
                    <span>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</span>
                  </div>
                  <Button
                    variant={group.isMember ? 'outline' : 'default'}
                    size="sm"
                    className="w-full"
                    onClick={() => handleToggleMembership(group)}
                    disabled={joiningId === group.id}
                  >
                    {group.isMember ? 'Leave' : 'Join'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Groups;
