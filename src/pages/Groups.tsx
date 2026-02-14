import { useEffect, useMemo, useState } from "react";
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
}

const GroupCard = ({ group, isJoined = false }: GroupCardProps) => (
  <Card className="hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] border-gray-100 overflow-hidden group bg-white animate-in fade-in slide-in-from-bottom-4">
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my-groups");
  const [myGroups, setMyGroups] = useState<typeof mockGroups>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pf_groups_my");
      if (raw) {
        setMyGroups(JSON.parse(raw));
      } else {
        setMyGroups([]);
      }
    } catch {
      setMyGroups([]);
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("pf_groups_my", JSON.stringify(myGroups));
    } catch {}
  }, [myGroups]);

  const join = (g: (typeof mockGroups)[number]) => {
    if (!myGroups.find(x => x.id === g.id)) {
      setMyGroups(prev => [{ ...g }, ...prev]);
      setActiveTab("my-groups");
    }
  };
  const leave = (id: string) => {
    setMyGroups(prev => prev.filter(g => g.id !== id));
  };
  const isJoined = (id: string) => myGroups.some(g => g.id === id);

  const onCreate = () => {
    if (!newName.trim()) return;
    const id = Date.now().toString();
    const g = {
      id,
      name: newName.trim(),
      description: newDesc.trim() || "Community group",
      memberCount: 1,
      imageUrl: null,
    };
    setMyGroups(prev => [g, ...prev]);
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    setActiveTab("my-groups");
  };

  const filteredMyGroups = myGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiscoverGroups = discoverGroups
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
                <Button onClick={() => setCreateOpen(true)} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 py-7 h-auto text-xl font-bold shadow-2xl shadow-[#833AB4]/30 gap-4 transition-all duration-300 transform hover:scale-105 active:scale-95">
                  <Plus className="h-7 w-7" />
                  Create Group
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto py-16 px-6">
          {/* Search and Filters */}
          <div className="mb-12 space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
            <div className="relative max-w-3xl mx-auto">
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
                        <GroupCard group={group} isJoined />
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
                {filteredDiscoverGroups.length > 0 ? (
                  <div className="grid gap-6">
                    {filteredDiscoverGroups.map(group => (
                      <div key={group.id} className="relative">
                        <GroupCard group={group} />
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
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a Group</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="gname">Name</Label>
                <Input id="gname" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g., Frontend Engineers" />
              </div>
              <div>
                <Label htmlFor="gdesc">Description</Label>
                <Input id="gdesc" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this group about?" />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                <Button onClick={onCreate} className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white">Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default Groups;
