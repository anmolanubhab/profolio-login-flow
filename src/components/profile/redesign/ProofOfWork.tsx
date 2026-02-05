import { useState, useEffect } from 'react';
import { Plus, ExternalLink, Award, FolderGit2, FileText, Image as ImageIcon, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Project {
  id: string;
  title: string;
  description: string;
  url?: string;
  image_url?: string;
  category: string;
  technologies?: string[];
  start_date?: string;
  end_date?: string;
}

interface Certificate {
  id: string;
  title: string;
  description: string;
  file_url: string;
  created_at: string;
}

interface ProofOfWorkProps {
  userId: string;
  isOwnProfile: boolean;
}

export const ProofOfWork = ({ userId, isOwnProfile }: ProofOfWorkProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const { toast } = useToast();

  // Form State
  const [newItem, setNewItem] = useState({
    title: '',
    description: '',
    url: '',
    image_url: '',
    category: 'project',
    technologies: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Fetch Projects
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (projectsError) throw projectsError;

      // Fetch Certificates
      const { data: certsData, error: certsError } = await supabase
        .from('certificates')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (certsError) throw certsError;

      setProjects(projectsData || []);
      setCertificates(certsData || []);
    } catch (error: any) {
      console.error('Error fetching proof of work:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItem.title) {
      toast({
        title: "Required Field",
        description: "Please enter a title for your item.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const technologiesArray = newItem.technologies 
        ? newItem.technologies.split(',').map(t => t.trim()).filter(t => t.length > 0) 
        : [];

      const { error } = await supabase
        .from('projects')
        .insert({
          user_id: userId,
          title: newItem.title,
          description: newItem.description,
          url: newItem.url || null,
          image_url: newItem.image_url || null,
          category: newItem.category,
          technologies: technologiesArray,
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Item added successfully.",
      });

      setNewItem({
        title: '',
        description: '',
        url: '',
        image_url: '',
        category: 'project',
        technologies: '',
      });
      setIsAddingProject(false);
      fetchData();
    } catch (error: any) {
      console.error('Error adding item:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to add item.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <Card className="group hover:shadow-md transition-all duration-200 overflow-hidden border-gray-100">
      <div className="aspect-video bg-gray-50 relative overflow-hidden">
        {project.image_url ? (
          <img 
            src={project.image_url} 
            alt={project.title} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            {project.category === 'media' ? <ImageIcon className="h-10 w-10" /> : 
             project.category === 'achievement' ? <Trophy className="h-10 w-10" /> :
             <FolderGit2 className="h-10 w-10" />}
          </div>
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors" />
      </div>
      <CardContent className="p-4">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-1">{project.title}</h3>
          {project.url && (
            <a 
              href={project.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-primary transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </div>
        <p className="text-sm text-gray-500 line-clamp-2 mb-3 h-10">
          {project.description}
        </p>
        {project.technologies && project.technologies.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {project.technologies.slice(0, 3).map((tech, i) => (
              <Badge key={i} variant="secondary" className="text-[10px] px-1.5 h-5 bg-gray-50 text-gray-600 border-gray-100">
                {tech}
              </Badge>
            ))}
            {project.technologies.length > 3 && (
              <span className="text-[10px] text-gray-400 self-center">+{project.technologies.length - 3}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const CertificateCard = ({ cert }: { cert: Certificate }) => (
    <Card className="group hover:shadow-md transition-all duration-200 border-gray-100">
      <CardContent className="p-4 flex items-start gap-4">
        <div className="h-12 w-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
          <Award className="h-6 w-6" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{cert.title}</h3>
          <p className="text-sm text-gray-500 line-clamp-2 mt-1">{cert.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-gray-400">Issued {format(new Date(cert.created_at), 'MMM yyyy')}</span>
            {cert.file_url && (
              <a 
                href={cert.file_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
              >
                View Credential <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Proof of Work</h2>
        {isOwnProfile && (
          <Dialog open={isAddingProject} onOpenChange={setIsAddingProject}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add to Portfolio</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select 
                    value={newItem.category} 
                    onValueChange={(value) => setNewItem({...newItem, category: value})}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="project">Project</SelectItem>
                      <SelectItem value="media">Media / Work Sample</SelectItem>
                      <SelectItem value="achievement">Achievement / Award</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input 
                    id="title" 
                    value={newItem.title} 
                    onChange={(e) => setNewItem({...newItem, title: e.target.value})}
                    placeholder="e.g. E-commerce Platform Redesign" 
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    value={newItem.description} 
                    onChange={(e) => setNewItem({...newItem, description: e.target.value})}
                    placeholder="Describe what you built or achieved..." 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="url">Link (Optional)</Label>
                    <Input 
                      id="url" 
                      value={newItem.url} 
                      onChange={(e) => setNewItem({...newItem, url: e.target.value})}
                      placeholder="https://..." 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="image_url">Image URL (Optional)</Label>
                    <Input 
                      id="image_url" 
                      value={newItem.image_url} 
                      onChange={(e) => setNewItem({...newItem, image_url: e.target.value})}
                      placeholder="https://..." 
                    />
                  </div>
                </div>

                {newItem.category === 'project' && (
                  <div className="grid gap-2">
                    <Label htmlFor="technologies">Technologies (Comma separated)</Label>
                    <Input 
                      id="technologies" 
                      value={newItem.technologies} 
                      onChange={(e) => setNewItem({...newItem, technologies: e.target.value})}
                      placeholder="React, TypeScript, Tailwind..." 
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsAddingProject(false)}>Cancel</Button>
                <Button onClick={handleAddItem} disabled={isSubmitting}>
                  {isSubmitting ? "Adding..." : "Add Item"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="projects" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="projects" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Projects
          </TabsTrigger>
          <TabsTrigger value="media" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Media
          </TabsTrigger>
          <TabsTrigger value="certificates" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Certificates
          </TabsTrigger>
          <TabsTrigger value="achievements" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Awards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.filter(p => p.category === 'project').map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projects.filter(p => p.category === 'project').length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <FolderGit2 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No projects showcased yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.filter(p => p.category === 'media').map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projects.filter(p => p.category === 'media').length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <ImageIcon className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No media or work samples yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="certificates" className="mt-6">
          <div className="space-y-4">
            {certificates.map(cert => (
              <CertificateCard key={cert.id} cert={cert} />
            ))}
            {certificates.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Award className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No certificates added yet.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {projects.filter(p => p.category === 'achievement').map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
            {projects.filter(p => p.category === 'achievement').length === 0 && (
              <div className="col-span-full text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <Trophy className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p>No achievements listed yet.</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
