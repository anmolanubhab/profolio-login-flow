import { Layout } from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { Bookmark } from "lucide-react";

const SavedPosts = () => {
  const { user, signOut } = useAuth();

  return (
    <Layout user={user} onSignOut={signOut}>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Saved Posts</h1>
        
        <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-card text-card-foreground shadow-sm">
          <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No saved posts</h3>
          <p className="text-sm text-muted-foreground">
            Posts you save will appear here.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default SavedPosts;
