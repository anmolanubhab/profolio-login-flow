import { useState } from "react";
import { Users, Plus, Search } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";

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
  <Card className="hover:shadow-xl transition-all duration-300 rounded-[2rem] border-gray-100 overflow-hidden group">
    <CardContent className="p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16 rounded-2xl ring-4 ring-gray-50">
          <AvatarImage src={group.imageUrl || undefined} alt={group.name} />
          <AvatarFallback className="rounded-2xl bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4]">
            <Users className="h-8 w-8" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-lg text-gray-900 truncate group-hover:text-[#833AB4] transition-colors">{group.name}</h3>
          <p className="text-sm text-gray-500 line-clamp-1">{group.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {group.memberCount.toLocaleString()} members
            </span>
          </div>
        </div>
        {isJoined ? (
          <div className="relative p-[1px] rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
            <Button 
              variant="outline" 
              size="sm"
              className="relative bg-white hover:bg-transparent hover:text-white border-none rounded-full px-6 transition-all duration-300"
            >
              Joined
            </Button>
          </div>
        ) : (
          <Button 
            size="sm"
            className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-6 shadow-lg shadow-[#833AB4]/20 transition-all duration-300"
          >
            Join
          </Button>
        )}
      </div>
    </CardContent>
  </Card>
);

const Groups = () => {
  const { user, signOut } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("my-groups");

  const filteredMyGroups = mockGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredDiscoverGroups = discoverGroups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="min-h-screen bg-white">
        {/* Universal Page Hero Section */}
        <div className="relative w-full overflow-hidden border-b border-gray-100">
          <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] opacity-5 animate-gradient-shift" />
          <div className="max-w-4xl mx-auto py-12 px-6 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
              <div className="text-center md:text-left">
                <h1 className="text-3xl md:text-5xl font-extrabold text-[#1D2226] mb-3 tracking-tight">
                  Communities
                </h1>
                <p className="text-[#5E6B7E] text-base md:text-xl font-medium max-w-2xl mx-auto md:mx-0">
                  Connect with like-minded professionals in focused groups.
                </p>
              </div>
              <div className="flex justify-center">
                <Button className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-8 py-6 h-auto text-lg font-bold shadow-xl shadow-[#833AB4]/20 gap-3 transition-all duration-300 hover:scale-105">
                  <Plus className="h-6 w-6" />
                  Create Group
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-4xl mx-auto py-12 px-6">
          {/* Search and Filters */}
          <div className="mb-10 space-y-8">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search groups by name or interest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-14 rounded-2xl border-gray-100 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-[#833AB4]/20 transition-all text-lg"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-center mb-8">
                <TabsList className="bg-gray-100/50 p-1.5 rounded-2xl h-auto">
                  <TabsTrigger 
                    value="my-groups" 
                    className="rounded-xl px-8 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-base font-semibold"
                  >
                    My Groups
                  </TabsTrigger>
                  <TabsTrigger 
                    value="discover" 
                    className="rounded-xl px-8 py-3 data-[state=active]:bg-white data-[state=active]:text-[#833AB4] data-[state=active]:shadow-sm transition-all text-base font-semibold"
                  >
                    Discover
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="my-groups" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                {filteredMyGroups.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredMyGroups.map(group => (
                      <GroupCard key={group.id} group={group} isJoined />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-gray-200">
                    <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Users className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No groups yet</h3>
                    <p className="text-gray-500 mb-8 max-w-xs mx-auto">Join groups to connect with like-minded professionals in your field.</p>
                    <Button 
                      onClick={() => setActiveTab("discover")}
                      className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-8 py-4 h-auto font-bold transition-all"
                    >
                      Browse Discover
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="discover" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                {filteredDiscoverGroups.length > 0 ? (
                  <div className="grid gap-4">
                    {filteredDiscoverGroups.map(group => (
                      <GroupCard key={group.id} group={group} />
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50/50 rounded-[2rem] p-12 text-center border-2 border-dashed border-gray-200">
                    <div className="bg-white h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                      <Users className="h-10 w-10 text-gray-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No results found</h3>
                    <p className="text-gray-500 max-w-xs mx-auto">Try adjusting your search terms to find what you're looking for.</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Groups;
