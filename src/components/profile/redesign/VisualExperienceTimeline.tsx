import { Briefcase, Calendar, MapPin, Building2, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';

interface Experience {
  id: string;
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  employment_type?: string;
  location?: string;
  description?: string;
}

interface VisualExperienceTimelineProps {
  experiences: Experience[];
  isOwnProfile: boolean;
  onEdit: (experience: Experience) => void;
  onDelete: (id: string) => void;
}

export const VisualExperienceTimeline = ({ 
  experiences, 
  isOwnProfile, 
  onEdit, 
  onDelete 
}: VisualExperienceTimelineProps) => {
  // Sort experiences by date (newest first)
  const sortedExperiences = [...experiences].sort((a, b) => {
    if (a.is_current && !b.is_current) return -1;
    if (!a.is_current && b.is_current) return 1;
    return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
  });

  if (experiences.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
        <div className="bg-white p-4 rounded-full shadow-sm inline-block mb-4">
          <Briefcase className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">No experience added yet</h3>
        <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
          Share your professional journey to build credibility and trust.
        </p>
      </div>
    );
  }

  return (
    <div className="relative pl-4 md:pl-8 py-4">
      {/* Vertical Timeline Line */}
      <div className="absolute left-4 md:left-8 top-4 bottom-4 w-px bg-gradient-to-b from-primary/20 via-primary/10 to-transparent transform -translate-x-1/2" />

      <div className="space-y-8">
        {sortedExperiences.map((exp, index) => (
          <div key={exp.id} className="relative pl-8 md:pl-12 group">
            {/* Timeline Dot */}
            <div className={`absolute left-0 top-1.5 w-8 h-8 rounded-full border-4 border-white shadow-sm flex items-center justify-center z-10 
              ${index === 0 ? 'bg-primary text-white' : 'bg-white text-gray-400'}`}>
              <div className={`w-2.5 h-2.5 rounded-full ${index === 0 ? 'bg-white' : 'bg-gray-300'}`} />
            </div>

            {/* Content Card */}
            <Card className="px-4 py-6 sm:p-8 rounded-none sm:rounded-[2rem] border-0 sm:border border-gray-100 shadow-none sm:shadow-sm hover:shadow-md transition-shadow duration-200 bg-white/80 backdrop-blur-sm">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-gray-900">{exp.role}</h3>
                    {exp.is_current && (
                      <Badge variant="secondary" className="w-fit bg-green-50 text-green-700 hover:bg-green-100 border-green-200 gap-1">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                        Current
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-primary font-medium mb-3">
                    <Building2 className="h-4 w-4" />
                    {exp.company}
                  </div>

                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {format(new Date(exp.start_date), 'MMM yyyy')} - {
                          exp.is_current ? 'Present' : 
                          exp.end_date ? format(new Date(exp.end_date), 'MMM yyyy') : 'Present'
                        }
                      </span>
                    </div>
                    {exp.location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        <span>{exp.location}</span>
                      </div>
                    )}
                  </div>

                  {/* Achievements / Description */}
                  {exp.description && (
                    <div className="relative pl-4 border-l-2 border-primary/10 mt-2">
                      <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                        {exp.description}
                      </p>
                    </div>
                  )}
                </div>

                {isOwnProfile && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400 hover:text-primary hover:bg-primary/5"
                      onClick={() => onEdit(exp)}
                    >
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-gray-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => onDelete(exp.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
};
