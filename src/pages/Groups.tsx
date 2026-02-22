import { useState } from "react"
import { Layout } from "@/components/Layout"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Users } from "lucide-react"

type Group = {
  id: string
  name: string
  description: string
  memberCount: number
  imageUrl: string | null
}

const myGroupsSeed: Group[] = [
  {
    id: "1",
    name: "Profolio Builders",
    description: "Share portfolio tips, profile reviews, and success stories.",
    memberCount: 1280,
    imageUrl: null,
  },
]

const discoverGroupsSeed: Group[] = [
  {
    id: "2",
    name: "SolidWorks Product Community",
    description: "CAD, simulation, and manufacturing best practices.",
    memberCount: 36418,
    imageUrl: null,
  },
  {
    id: "3",
    name: "AutoCAD Plant 3D",
    description: "Discussions around piping, layouts, and 3D workflows.",
    memberCount: 155666,
    imageUrl: null,
  },
  {
    id: "4",
    name: "ASME (American Society of Mechanical Engineers)",
    description: "Mechanical engineering news, standards, and community.",
    memberCount: 482048,
    imageUrl: null,
  },
  {
    id: "5",
    name: "INDIA REAL ESTATE MARKET UPDATES",
    description: "Market trends, updates, and analysis.",
    memberCount: 23822,
    imageUrl: null,
  },
]

const GroupsPage = () => {
  const [activeTab, setActiveTab] = useState<"your-groups" | "requested">("your-groups")
  const [myGroups, setMyGroups] = useState<Group[]>(myGroupsSeed)
  const [discoverGroups, setDiscoverGroups] = useState<Group[]>(discoverGroupsSeed)

  const join = (group: Group) => {
    if (myGroups.some((g) => g.id === group.id)) return
    setMyGroups((prev) => [...prev, group])
    setDiscoverGroups((prev) => prev.filter((g) => g.id !== group.id))
  }

  const leave = (groupId: string) => {
    setMyGroups((prev) => prev.filter((g) => g.id !== groupId))
    const fromSeed = discoverGroupsSeed.find((g) => g.id === groupId)
    if (fromSeed && !discoverGroups.some((g) => g.id === fromSeed.id)) {
      setDiscoverGroups((prev) => [...prev, fromSeed])
    }
  }

  return (
    <Layout>
      <div className="py-8">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "your-groups" | "requested")}
              className="w-full"
            >
              <Card className="rounded-2xl border-gray-200">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 pt-4 border-b">
                  <TabsList className="bg-transparent p-0 h-auto border-none shadow-none">
                    <TabsTrigger
                      value="your-groups"
                      className="relative rounded-none px-0 mr-8 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-emerald-700 data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-emerald-600"
                    >
                      Your groups
                    </TabsTrigger>
                    <TabsTrigger
                      value="requested"
                      className="relative rounded-none px-0 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:text-emerald-700 data-[state=active]:font-semibold data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:bottom-0 data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-emerald-600"
                    >
                      Requested
                    </TabsTrigger>
                  </TabsList>
                  <Button className="mt-3 sm:mt-0 rounded-full text-sm font-semibold">
                    Create group
                  </Button>
                </div>

                <TabsContent value="your-groups" className="p-6">
                  {myGroups.length > 0 ? (
                    <div className="space-y-4">
                      {myGroups.map((group) => (
                        <div
                          key={group.id}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 rounded-2xl">
                              <AvatarImage src={group.imageUrl || undefined} alt={group.name} />
                              <AvatarFallback className="rounded-2xl bg-gray-100 text-[#0a66c2]">
                                <Users className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#1D2226] truncate">
                                {group.name}
                              </p>
                              <p className="text-xs text-[#5E6B7E]">
                                {group.memberCount.toLocaleString()} members
                              </p>
                              <p className="mt-1 text-xs text-[#5E6B7E] line-clamp-2">
                                {group.description}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            className="rounded-full text-sm font-semibold"
                            onClick={() => leave(group.id)}
                          >
                            Leave
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#e6f0ff]">
                        <Users className="h-12 w-12 text-[#0a66c2]" />
                      </div>
                      <h2 className="mb-2 text-xl font-semibold text-[#1D2226]">Discover groups</h2>
                      <p className="mb-4 max-w-sm text-sm text-[#5E6B7E]">
                        Find other trusted communities that share and support your goals.
                      </p>
                      <Button variant="outline" className="rounded-full px-6 text-sm font-semibold">
                        Discover
                      </Button>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="requested" className="p-6">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <h2 className="mb-2 text-xl font-semibold text-[#1D2226]">
                      No pending requests
                    </h2>
                    <p className="max-w-sm text-sm text-[#5E6B7E]">
                      When you request to join a group, you will see the status here.
                    </p>
                  </div>
                </TabsContent>
              </Card>
            </Tabs>
          </div>

          <aside className="w-full lg:w-80 xl:w-96">
            <Card className="rounded-2xl border-gray-200 bg-[#f3f6f8]">
              <CardContent className="p-4">
                <h2 className="mb-3 text-sm font-semibold text-[#1D2226]">
                  Groups you might be interested in
                </h2>
                <div className="space-y-2">
                  {discoverGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-xl">
                          <AvatarImage src={group.imageUrl || undefined} alt={group.name} />
                          <AvatarFallback className="rounded-xl bg-gray-100 text-[#0a66c2]">
                            <Users className="h-5 w-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold leading-snug text-[#1D2226] line-clamp-2">
                            {group.name}
                          </p>
                          <p className="text-xs text-[#5E6B7E]">
                            {group.memberCount.toLocaleString()} members
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full px-4 text-xs font-semibold"
                        onClick={() => join(group)}
                      >
                        Join
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </Layout>
  )
}

export default GroupsPage

