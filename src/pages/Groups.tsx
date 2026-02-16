import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Users, Plus, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";

// Placeholder data - will be replaced with real data when backend is ready
const mockGroups = [
  {
    id: "1",
    name: "React Developers",
    description: "A community for React enthusiasts",
    memberCount: 12500,
    imageUrl: null,
  },
  {
    id: "2", 
    name: "UX/UI Designers",
    description: "Share design inspiration and feedback",
    memberCount: 8300,
    imageUrl: null,
  },
];

const discoverGroups = [
  {
    id: "3",
    name: "Tech Startups",
    description: "Connect with founders and startup enthusiasts",
    memberCount: 25000,
    imageUrl: null,
  },
  {
    id: "4",
    name: "Career Growth",
    description: "Tips and discussions on advancing your career",
    memberCount: 45000,
    imageUrl: null,
  },
];

interface GroupCardProps {
  group: {
    id: string;
    name: string;
    description: string;
    memberCount: number;
    imageUrl: string | null;
  };
  isJoined?: boolean;
  onOpen?: (group: GroupCardProps["group"]) => void;
}

const GroupCard = ({ group, isJoined = false, onOpen }: GroupCardProps) => (
  <Card className="hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] border-gray-100 overflow-hidden group bg-white animate-in fade-in slide-in-from-bottom-4 cursor-pointer"
        onClick={() => onOpen?.(group)}>
    <CardContent className="p-8">
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-2xl rounded-full group-hover:opacity-40 transition-opacity" />
          <Avatar className="h-20 w-20 rounded-[2rem] ring-4 ring-white shadow-xl relative z-10">
            <AvatarImage src={group.imageUrl || undefined} alt={group.name} />
            <AvatarFallback className="rounded-[2rem] bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4]">
              <Users className="h-10 w-10" />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0 text-center sm:text-left">
          <h3 className="font-extrabold text-2xl text-[#1D2226] truncate group-hover:text-[#833AB4] transition-colors tracking-tight">
            {group.name}
          </h3>
          <p className="text-[#5E6B7E] font-medium mt-1 line-clamp-2 leading-relaxed">
            {group.description}
          </p>
          <div className="flex flex-wrap justify-center sm:justify-start items-center gap-3 mt-4">
            <span className="text-xs font-bold px-4 py-1.5 rounded-full bg-gray-100 text-[#5E6B7E] border border-gray-200">
              {group.memberCount.toLocaleString()} members
            </span>
            <span className="text-xs font-bold px-4 py-1.5 rounded-full bg-[#833AB4]/10 text-[#833AB4] border border-[#833AB4]/10">
              Active Community
            </span>
          </div>
        </div>
        <div className="sm:self-center">
          {isJoined ? (
            <div className="relative p-[1px] rounded-full overflow-hidden group/btn">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-80" />
              <Button 
                variant="outline" 
                size="lg"
                className="relative bg-white hover:bg-transparent hover:text-white border-none rounded-full px-8 h-12 font-bold transition-all duration-300 shadow-lg shadow-black/5"
              >
                Joined
              </Button>
            </div>
          ) : (
            <Button 
              size="lg"
              className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 h-12 font-bold shadow-xl shadow-[#833AB4]/25 transition-all duration-300 transform hover:scale-105 active:scale-95"
            >
              Join Group
            </Button>
          )}
        </div>
      </div>
    </CardContent>
  </Card>
);

const Groups = () => {
  const { user, signOut } = useAuth();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my-groups");
  const [myGroups, setMyGroups] = useState<typeof mockGroups>([]);
  const navigate = useNavigate();
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<(typeof mockGroups)[number] | null>(null);
  const [newPost, setNewPost] = useState("");
  const [groupPosts, setGroupPosts] = useState<Record<string, Array<{ id: string; content: string; createdAt: number }>>>({});
  const [discover, setDiscover] = useState<typeof mockGroups>(discoverGroups);
  const [loading, setLoading] = useState(false);
  const [backendReady, setBackendReady] = useState(true);
  const [deepLinked, setDeepLinked] = useState(false);
  const [members, setMembers] = useState<Array<{ userId: string; role: string; displayName: string; avatarUrl?: string }>>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    const fetchLists = async () => {
      setLoading(true);
      setBackendReady(true);
      try {
        if (!user?.id) {
          const raw = localStorage.getItem("pf_groups_my");
          setMyGroups(raw ? JSON.parse(raw) : []);
          setDiscover(discoverGroups);
          return;
        }
        const { data: memberships, error: memErr } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("user_id", user.id);
        if (memErr) throw memErr;
        const joinedIds = (memberships || []).map(m => m.group_id);
        let joined: typeof mockGroups = [];
        if (joinedIds.length > 0) {
          const { data: gData, error: gErr } = await supabase
            .from("groups")
            .select("id,name,description,image_url")
            .in("id", joinedIds);
          if (gErr) throw gErr;
          const { data: allMembers } = await supabase
            .from("group_members")
            .select("group_id")
            .in("group_id", joinedIds);
          const counts: Record<string, number> = {};
          (allMembers || []).forEach(m => { counts[m.group_id] = (counts[m.group_id] || 0) + 1; });
          joined = (gData || []).map(g => ({
            id: g.id,
            name: g.name,
            description: g.description || "",
            memberCount: counts[g.id] || 1,
            imageUrl: g.image_url || null
          }));
        }
        setMyGroups(joined);
        let all: any[] | null = null;
        // Prefer public-only groups if schema supports it
        try {
          const { data, error } = await supabase
            .from("groups")
            .select("id,name,description,image_url,is_public");
          if (error) throw error;
          all = data || [];
        } catch {
          const { data, error } = await supabase
            .from("groups")
            .select("id,name,description,image_url");
          if (error) throw error;
          all = data || [];
        }
        const notJoined = (all || []).filter(g => !joinedIds.includes(g.id));
        const { data: allMembers2 } = await supabase
          .from("group_members")
          .select("group_id");
        const counts2: Record<string, number> = {};
        (allMembers2 || []).forEach(m => { counts2[m.group_id] = (counts2[m.group_id] || 0) + 1; });
        // Filter out private groups when is_public column exists
        const discoverPool = notJoined.filter((g: any) => {
          if (typeof g.is_public === "boolean") return g.is_public;
          return true;
        });
        setDiscover(discoverPool.map(g => ({
          id: g.id,
          name: g.name,
          description: g.description || "",
          memberCount: counts2[g.id] || 1,
          imageUrl: g.image_url || null
        })));
      } catch (e: any) {
        const msg = String(e?.message || "");
        if (msg.includes('relation') && msg.includes('does not exist')) {
          setBackendReady(false);
        }
        try {
          const raw = localStorage.getItem("pf_groups_my");
          setMyGroups(raw ? JSON.parse(raw) : []);
        } catch {
          setMyGroups([]);
        }
        setDiscover(discoverGroups);
      } finally {
        setLoading(false);
      }
    };
    fetchLists();

    // live updates when backend present
    const ch = supabase
      .channel('groups-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => {
        fetchLists();
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // ok
        }
      });
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id]);

  useEffect(() => {
    const gid = searchParams.get("group");
    if (!gid || deepLinked) return;
    const openFromParam = async () => {
      const inMy = myGroups.find(g => g.id === gid);
      if (inMy) {
        openDetails(inMy);
        setActiveTab("my-groups");
        setDeepLinked(true);
        return;
      }
      const inDiscover = discover.find(g => g.id === gid);
      if (inDiscover) {
        openDetails(inDiscover);
        setActiveTab("discover");
        setDeepLinked(true);
        return;
      }
      if (!backendReady) return;
      try {
        const { data: gData, error } = await supabase
          .from("groups")
          .select("id,name,description,image_url")
          .eq("id", gid)
          .maybeSingle();
        if (error || !gData) return;
        const { data: mems } = await supabase
          .from("group_members")
          .select("group_id")
          .eq("group_id", gData.id);
        const count = (mems || []).length || 1;
        const g = {
          id: gData.id,
          name: gData.name,
          description: gData.description || "",
          memberCount: count,
          imageUrl: gData.image_url || null
        };
        setDiscover(prev => {
          if (prev.some(x => x.id === g.id) || myGroups.some(x => x.id === g.id)) return prev;
          return [g, ...prev];
        });
        openDetails(g);
        setActiveTab("discover");
        setDeepLinked(true);
      } catch {}
    };
    openFromParam();
  }, [searchParams, myGroups, discover, backendReady, deepLinked]);

  // Load posts for a specific group id
  const loadPosts = (id: string) => {
    try {
      const raw = localStorage.getItem(`pf_groups_posts_${id}`);
      return raw ? JSON.parse(raw) as Array<{ id: string; content: string; createdAt: number }> : [];
    } catch {
      return [];
    }
  };
  const savePosts = (id: string, posts: Array<{ id: string; content: string; createdAt: number }>) => {
    try {
      localStorage.setItem(`pf_groups_posts_${id}`, JSON.stringify(posts));
    } catch {}
  };
  const openDetails = (g: (typeof mockGroups)[number]) => {
    setSelectedGroup(g);
    // ensure posts loaded into state map
    const posts = loadPosts(g.id);
    setGroupPosts(prev => ({ ...prev, [g.id]: posts }));
    setDetailOpen(true);
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const { data: gm, error: gmErr } = await supabase
          .from("group_members")
          .select("user_id, role")
          .eq("group_id", g.id);
        if (gmErr) throw gmErr;
        const ids = (gm || []).map(m => m.user_id);
        if (ids.length === 0) {
          setMembers([]);
          return;
        }
        const { data: profs, error: pErr } = await supabase
          .from("profiles")
          .select("user_id, display_name, full_name, avatar_url")
          .in("user_id", ids);
        if (pErr) throw pErr;
        const byUser: Record<string, { display_name?: string; full_name?: string; avatar_url?: string }> = {};
        (profs || []).forEach(p => { byUser[p.user_id] = p; });
        const merged = (gm || []).map(m => ({
          userId: m.user_id,
          role: m.role as string,
          displayName: byUser[m.user_id]?.display_name || byUser[m.user_id]?.full_name || "Member",
          avatarUrl: byUser[m.user_id]?.avatar_url || undefined
        }));
        setMembers(merged);
      } catch {
        setMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };
    if (backendReady) loadMembers();
  };
  const onCreatePost = () => {
    if (!selectedGroup) return;
    const content = newPost.trim();
    if (!content) return;
    const id = `${Date.now()}`;
    const post = { id, content, createdAt: Date.now() };
    const posts = [post, ...(groupPosts[selectedGroup.id] || [])];
    setGroupPosts(prev => ({ ...prev, [selectedGroup.id]: posts }));
    savePosts(selectedGroup.id, posts);
    setNewPost("");
  };
  const onRenameGroup = (name: string, desc: string) => {
    if (!selectedGroup) return;
    const updated = { ...selectedGroup, name: name.trim() || selectedGroup.name, description: desc.trim() || selectedGroup.description };
    setSelectedGroup(updated);
    setMyGroups(prev => prev.map(g => g.id === updated.id ? updated : g));
  };

  const join = (g: (typeof mockGroups)[number]) => {
    if (myGroups.find(x => x.id === g.id)) return;
    const doJoin = async () => {
      try {
        if (user?.id) {
          await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
        }
      } catch {}
      setMyGroups(prev => [{ ...g }, ...prev]);
      setDiscover(prev => prev.filter(x => x.id !== g.id));
      setActiveTab("my-groups");
      if (selectedGroup?.id === g.id) {
        openDetails(g);
      }
    };
    doJoin();
  };
  const leave = (id: string) => {
    const doLeave = async () => {
      try {
        if (user?.id) {
          await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", user.id);
        }
      } catch {}
      setMyGroups(prev => prev.filter(g => g.id !== id));
    };
    doLeave();
  };
  const isJoined = (id: string) => myGroups.some(g => g.id === id);

  

  const filteredMyGroups = myGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiscoverGroups = discover
    .filter(g => !isJoined(g.id))
    .filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-5xl mx-auto py-16 px-6 relative">
            <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between gap-8 md:gap-10">
              <div className="text-center md:text-left animate-in fade-in slide-in-from-left-8 duration-700">
                <h1 className="text-4xl md:text-6xl font-extrabold text-[#1D2226] mb-4 tracking-tight leading-tight">
                  Communities
                </h1>
                <p className="text-[#5E6B7E] text-lg md:text-2xl font-medium max-w-2xl mx-auto md:mx-0 leading-relaxed">
                  Connect with like-minded professionals in focused groups and accelerate your career.
                </p>
              </div>
              <div className="flex w-full md:w-auto justify-center animate-in fade-in slide-in-from-right-8 duration-700">
                <Button onClick={() => navigate("/groups/create")} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 py-7 h-auto text-xl font-bold shadow-2xl shadow-[#833AB4]/30 gap-4 transition-all duration-300 transform hover:scale-105 active:scale-95">
                  <Plus className="h-7 w-7" />
                  Create Group
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full lg:max-w-5xl lg:mx-auto py-16 px-6">
          <div className="w-full lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
            <div>
              <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                <div className="relative max-w-3xl mx-auto lg:mx-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-10 blur-3xl rounded-full" />
                  <div className="relative">
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
                    <Input
                      placeholder="Search groups by name or interest..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-16 h-16 rounded-[2rem] border-gray-100 bg-white shadow-xl shadow-black/5 focus:ring-2 focus:ring-[#833AB4]/20 transition-all text-xl"
                    />
                  </div>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <div className="flex justify-center mb-12">
                    <TabsList className="bg-gray-100/80 p-1.5 rounded-[2rem] h-auto backdrop-blur-sm border border-gray-200/50">
                      <TabsTrigger 
                        value="my-groups" 
                        className="rounded-[1.75rem] px-12 py-4 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-xl transition-all text-lg font-bold"
                      >
                        My Groups
                      </TabsTrigger>
                      <TabsTrigger 
                        value="discover" 
                        className="rounded-[1.75rem] px-12 py-4 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-xl transition-all text-lg font-bold"
                      >
                        Discover
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="my-groups" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    {filteredMyGroups.length > 0 ? (
                      <div className="grid gap-6">
                        {filteredMyGroups.map((group) => (
                          <div key={group.id} className="relative">
                            <GroupCard group={group} isJoined onOpen={openDetails} />
                            <div className="absolute top-6 right-8">
                              <Button variant="outline" className="rounded-full" onClick={() => leave(group.id)}>
                                Leave
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-2 border-dashed border-gray-100 bg-gray-50/30 rounded-[3rem] overflow-hidden">
                        <CardContent className="flex flex-col items-center justify-center py-24 px-6 text-center">
                          <div className="relative mb-8">
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                            <div className="relative h-24 w-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#833AB4]">
                              <Users className="h-12 w-12" />
                            </div>
                          </div>
                          <h3 className="text-2xl font-extrabold text-[#1D2226] mb-3 tracking-tight">No groups joined yet</h3>
                          <p className="text-[#5E6B7E] font-medium max-w-md mb-10 leading-relaxed text-lg">Join vibrant communities to connect with industry experts and peers.</p>
                          <Button 
                            onClick={() => setActiveTab("discover")}
                            className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-12 py-5 h-auto font-bold shadow-xl shadow-[#833AB4]/25 transition-all transform hover:scale-105"
                          >
                            Browse Discover
                          </Button>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="discover" className="space-y-6 focus-visible:outline-none focus-visible:ring-0">
                    {!backendReady && (
                      <Alert className="border-amber-300 bg-amber-50">
                        <AlertTitle>Groups backend not initialized</AlertTitle>
                        <AlertDescription>
                          Open Supabase SQL Editor and run the migration at supabase/migrations/20260216_groups.sql. 
                          Iske baad yahan Discover me naya group dikhega.
                          <Button
                            variant="outline"
                            className="ml-3 rounded-full"
                            onClick={() => {
                              const sql = `create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  image_url text,
  owner_user_id uuid references auth.users(id) on delete set null,
  created_at timestamp with time zone default now()
);
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member',
  created_at timestamp with time zone default now(),
  unique (group_id, user_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy if not exists groups_select_all on public.groups for select using (true);
create policy if not exists groups_insert_auth on public.groups for insert with check (auth.role() = 'authenticated');
create policy if not exists groups_update_owner on public.groups for update using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());
create policy if not exists gm_select_all on public.group_members for select using (true);
create policy if not exists gm_insert_self on public.group_members for insert with check (auth.uid() = user_id);
create policy if not exists gm_delete_self_or_owner on public.group_members for delete using (auth.uid() = user_id or auth.uid() in (select owner_user_id from public.groups g where g.id = group_id));`;
                              navigator.clipboard.writeText(sql);
                            }}
                          >
                            Copy SQL
                          </Button>
                        </AlertDescription>
                      </Alert>
                    )}
                    {filteredDiscoverGroups.length > 0 ? (
                      <div className="grid gap-6">
                        {filteredDiscoverGroups.map(group => (
                          <div key={group.id} className="relative">
                            <GroupCard group={group} onOpen={openDetails} />
                            <div className="absolute top-6 right-8">
                              <Button className="rounded-full" onClick={() => join(group)}>
                                Join
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <Card className="border-2 border-dashed border-gray-100 bg-gray-50/30 rounded-[3rem] overflow-hidden">
                        <CardContent className="flex flex-col items-center justify-center py-24 px-6 text-center">
                          <div className="relative mb-8">
                            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-20 blur-3xl rounded-full" />
                            <div className="relative h-24 w-24 bg-white rounded-[2.5rem] shadow-2xl flex items-center justify-center text-[#833AB4]">
                              <Search className="h-12 w-12" />
                            </div>
                          </div>
                          <h3 className="text-2xl font-extrabold text-[#1D2226] mb-3 tracking-tight">No communities found</h3>
                          <p className="text-[#5E6B7E] font-medium max-w-md leading-relaxed text-lg">Try searching for different keywords or interests.</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            </div>
            <aside className="hidden lg:block">
              <Card className="rounded-3xl border-gray-100 sticky top-20">
                <CardContent className="p-0">
                  <div className="px-6 pt-6 pb-3 text-[15px] font-bold text-[#1D2226]">Groups you might be interested in</div>
                  <div className="divide-y divide-gray-100">
                    {discover.slice(0, 8).map(g => (
                      <div key={g.id} className="flex items-center gap-3 px-6 py-4">
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={g.imageUrl || undefined} />
                          <AvatarFallback><Users className="h-4 w-4" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{g.name}</div>
                          <div className="text-xs text-muted-foreground">{g.memberCount.toLocaleString()} members</div>
                        </div>
                        <Button size="sm" className="rounded-full" onClick={() => join(g)}>Join</Button>
                      </div>
                    ))}
                    {discover.length === 0 && (
                      <div className="px-6 py-6 text-sm text-muted-foreground">No suggestions right now.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </aside>
          </div>
        </div>
        

        {/* Group Details Drawer/Dialog */}
        <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Group Details</DialogTitle>
            </DialogHeader>
            {selectedGroup && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={() => {
                      const url = `${window.location.origin}/groups?group=${selectedGroup.id}`;
                      navigator.clipboard.writeText(url);
                    }}
                  >
                    Copy invite link
                  </Button>
                  {!isJoined(selectedGroup.id) && (
                    <Button className="rounded-full" onClick={() => join(selectedGroup)}>
                      Join group
                    </Button>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Members ({members.length})</Label>
                  <div className="max-h-56 overflow-y-auto space-y-3">
                    {loadingMembers && (
                      <div className="text-sm text-muted-foreground">Loading members…</div>
                    )}
                    {!loadingMembers && members.length === 0 && (
                      <EmptyState title="No members yet" description="Share the invite link to add members." />
                    )}
                    {!loadingMembers && members.map(m => (
                      <div key={m.userId} className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={m.avatarUrl} />
                          <AvatarFallback>{m.displayName?.charAt(0)?.toUpperCase() || "U"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{m.displayName}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 border border-gray-200">
                          {m.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rename">Group name</Label>
                  <Input id="rename" defaultValue={selectedGroup.name} onBlur={e => onRenameGroup(e.target.value, selectedGroup.description)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="redesc">Description</Label>
                  <Input id="redesc" defaultValue={selectedGroup.description} onBlur={e => onRenameGroup(selectedGroup.name, e.target.value)} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Post something</Label>
                  <Textarea
                    placeholder="Share an update with the group…"
                    value={newPost}
                    onChange={(e) => setNewPost(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button onClick={onCreatePost} disabled={!newPost.trim()} className="rounded-full">
                      Post
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Recent posts</Label>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {(groupPosts[selectedGroup.id] || []).length === 0 && (
                      <EmptyState title="No posts yet" description="Be the first to post in this group." />
                    )}
                    {(groupPosts[selectedGroup.id] || []).map(p => (
                      <Card key={p.id}>
                        <CardContent className="p-4">
                          <p className="text-sm">{p.content}</p>
                          <p className="text-xs text-muted-foreground mt-1">{new Date(p.createdAt).toLocaleString()}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Groups;
