import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Image, Video, FileText, MapPin } from 'lucide-react';
import BottomNavigation from '@/components/BottomNavigation';

const AddPost = () => {
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
              <Button variant="outline">Save Draft</Button>
              <Button>Post</Button>
            </div>
          </CardContent>
        </Card>
      </main>

      <BottomNavigation />
    </div>
  );
};

export default AddPost;