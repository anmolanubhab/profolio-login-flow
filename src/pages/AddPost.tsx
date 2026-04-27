import { useState } from 'react'; // FIXED: Added state management
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, FileText, MapPin } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';
import { supabase } from '@/integrations/supabase/client'; // FIXED: Added Supabase client
import { useToast } from '@/hooks/use-toast'; // FIXED: Added toast notifications
import { useNavigate } from 'react-router-dom'; // FIXED: Added navigation

const AddPost = () => {
  // FIXED: Added state management
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // FIXED: Handle post submission
  const handlePost = async (isDraft = false) => {
    if (!content.trim() && !isDraft) {
      toast({
        title: 'Validation Error',
        description: 'Please enter some content for your post',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase.from('posts').insert({
        user_id: user.id,
        content: content,
        status: isDraft ? 'draft' : 'published',
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: isDraft ? 'Draft saved successfully!' : 'Post published successfully!',
      });

      setContent('');
      navigate('/dashboard');
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="bg-primary text-primary-foreground sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-xl font-bold">Create Post</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Share an update</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea 
              placeholder="What do you want to talk about?" 
              className="min-h-32 resize-none"
              value={content} // FIXED: Bind state to textarea
              onChange={(e) => setContent(e.target.value)} // FIXED: Update state on change
              disabled={loading} // FIXED: Disable during loading
            />
            
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm">
                <Image className="h-4 w-4 mr-2" />
                Photo
              </Button>
              <Button variant="ghost" size="sm">
                <Video className="h-4 w-4 mr-2" />
                Video
              </Button>
              <Button variant="ghost" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Document
              </Button>
              <Button variant="ghost" size="sm">
                <MapPin className="h-4 w-4 mr-2" />
                Location
              </Button>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => handlePost(true)} // FIXED: Added save draft handler
                disabled={loading || !content.trim()} // FIXED: Disable when loading or empty
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button 
                onClick={() => handlePost(false)} // FIXED: Added post handler
                disabled={loading || !content.trim()} // FIXED: Disable when loading or empty
              >
                {loading ? 'Posting...' : 'Post'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AddPost;