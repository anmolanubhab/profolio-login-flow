import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Calendar, Building2, Bookmark, BookmarkCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    description: string;
    location: string;
    employment_type: string;
    posted_at: string;
    salary_min?: number;
    salary_max?: number;
    currency?: string;
    company_name?: string;
    company_id?: string;
    company?: {
      name: string;
      logo_url?: string;
    } | null;
  };
  onApply: (jobId: string) => void;
  onViewDetails: (jobId: string) => void;
  isApplied?: boolean;
  isSaved?: boolean;
  onToggleSave?: (jobId: string) => void;
  matchLabel?: string;
}

export const JobCard = ({ job, onApply, onViewDetails, isApplied, isSaved, onToggleSave, matchLabel }: JobCardProps) => {
  const companyName = job.company?.name || job.company_name || 'Company';

  return (
    <Card className="hover:shadow-lg transition-shadow relative h-full flex flex-col">
      {onToggleSave && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-3 h-8 w-8 p-0 z-10"
          aria-label={isSaved ? 'Unsave job' : 'Save job'}
          onClick={(e) => { e.stopPropagation(); onToggleSave(job.id); }}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4 text-muted-foreground" />}
        </Button>
      )}
      {matchLabel && (
        <Badge className="absolute top-3 left-3 z-10" variant="secondary">{matchLabel}</Badge>
      )}
      <CardHeader>
        <div className="flex items-start gap-4">
          {job.company_id ? (
            <Link to={`/company/${job.company_id}`} className="shrink-0">
              {job.company?.logo_url ? (
                <img 
                  src={job.company.logo_url} 
                  alt={companyName}
                  className="w-12 h-12 rounded-lg object-cover hover:ring-2 hover:ring-primary/50 transition-all"
                />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center hover:ring-2 hover:ring-primary/50 transition-all">
                  <Building2 className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
            </Link>
          ) : (
            job.company?.logo_url ? (
              <img 
                src={job.company.logo_url} 
                alt={companyName}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                <Building2 className="w-6 h-6 text-muted-foreground" />
              </div>
            )
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl mb-1">{job.title}</CardTitle>
            {job.company_id ? (
              <Link 
                to={`/company/${job.company_id}`}
                className="text-base text-muted-foreground hover:text-primary hover:underline transition-colors"
              >
                {companyName}
              </Link>
            ) : (
              <CardDescription className="text-base">{companyName}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 flex-1">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {job.description}
        </p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {job.location}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {job.employment_type}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })}
          </Badge>
        </div>
        {job.salary_min && job.salary_max && (
          <p className="text-sm font-semibold text-primary">
            {job.currency || '$'}{job.salary_min.toLocaleString()} - {job.currency || '$'}
            {job.salary_max.toLocaleString()}
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2 mt-auto">
        <Button
          onClick={() => onViewDetails(job.id)}
          variant="outline"
          className="flex-1 min-w-0 h-10"
        >
          View Details
        </Button>
        <Button
          onClick={() => onApply(job.id)}
          disabled={isApplied}
          className="flex-1 min-w-0 h-10"
        >
          {isApplied ? 'Applied' : 'Apply Now'}
        </Button>
      </CardFooter>
    </Card>
  );
};