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
  <Card className="hover:shadow-md transition-shadow">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 rounded-lg">
          <AvatarImage src={group.imageUrl || undefined} alt={group.name} />
          <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
            <Users className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{group.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">{group.description}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {group.memberCount.toLocaleString()} members
          </p>
        </div>
        <Button 
          variant={isJoined ? "outline" : "default"} 
          size="sm"
          className="flex-shrink-0"
        >
          {isJoined ? "Joined" : "Join"}
        </Button>
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
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Groups</h1>
          <Button size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Create
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="my-groups" className="flex-1">My Groups</TabsTrigger>
            <TabsTrigger value="discover" className="flex-1">Discover</TabsTrigger>
          </TabsList>

          <TabsContent value="my-groups" className="mt-4 space-y-3">
            {filteredMyGroups.length > 0 ? (
              filteredMyGroups.map(group => (
                <GroupCard key={group.id} group={group} isJoined />
              ))
            ) : (
              <EmptyState
                icon={Users}
                title="No groups yet"
                description="Join groups to connect with like-minded professionals"
                action={
                  <Button onClick={() => setActiveTab("discover")}>
                    Discover Groups
                  </Button>
                }
              />
            )}
          </TabsContent>

          <TabsContent value="discover" className="mt-4 space-y-3">
            {filteredDiscoverGroups.length > 0 ? (
              filteredDiscoverGroups.map(group => (
                <GroupCard key={group.id} group={group} />
              ))
            ) : (
              <EmptyState
                icon={Users}
                title="No groups found"
                description="Try a different search term"
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Groups;
