import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Building } from 'lucide-react';
import { Layout } from '@/components/Layout';

const Jobs = () => {
  const jobs = [
    {
      id: 1,
      title: 'Senior React Developer',
      company: 'TechCorp Solutions',
      location: 'San Francisco, CA',
      type: 'Full-time',
      posted: '2 days ago',
      salary: '$120k - $160k',
      tags: ['React', 'TypeScript', 'Node.js']
    },
    {
      id: 2,
      title: 'Frontend Engineer',
      company: 'InnovateLab',
      location: 'Remote',
      type: 'Full-time',
      posted: '1 week ago',
      salary: '$90k - $130k',
      tags: ['Vue.js', 'JavaScript', 'CSS']
    },
    {
      id: 3,
      title: 'Full Stack Developer',
      company: 'StartupXYZ',
      location: 'New York, NY',
      type: 'Contract',
      posted: '3 days ago',
      salary: '$80/hour',
      tags: ['Python', 'React', 'PostgreSQL']
    }
  ];

  return (
    <Layout>
      <div className="container mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold mb-6">Jobs</h1>
        
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{job.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                      <Building className="h-4 w-4" />
                      <span>{job.company}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{job.posted}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-primary">{job.salary}</p>
                      <p className="text-sm text-muted-foreground">{job.type}</p>
                    </div>
                    <Button size="sm">Apply</Button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {job.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </Layout>
  );
};

export default Jobs;