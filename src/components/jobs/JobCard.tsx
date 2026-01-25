import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Calendar, Building2, CheckCircle2, DollarSign } from "lucide-react";
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
    remote_option?: string;
    company?: {
      name: string;
      logo_url?: string;
    } | null;
  };
  onApply: (jobId: string) => void;
  onViewDetails: (jobId: string) => void;
  isApplied?: boolean;
}

export const JobCard = ({ job, onApply, onViewDetails, isApplied }: JobCardProps) => {
  const companyName = job.company?.name || job.company_name || 'Company';
  
  const formatSalary = () => {
    if (!job.salary_min && !job.salary_max) return null;
    const currency = job.currency || 'USD';
    const min = job.salary_min?.toLocaleString();
    const max = job.salary_max?.toLocaleString();
    if (min && max) return `${currency} ${min} - ${max}`;
    if (min) return `${currency} ${min}+`;
    if (max) return `Up to ${currency} ${max}`;
    return null;
  };

  const salary = formatSalary();
  
  return (
    <Card className="hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/20 group">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {job.company_id ? (
            <Link to={`/company/${job.company_id}`} className="shrink-0">
              {job.company?.logo_url ? (
                <img 
                  src={job.company.logo_url} 
                  alt={companyName}
                  className="w-14 h-14 rounded-xl object-cover ring-2 ring-background shadow-sm group-hover:ring-primary/20 transition-all"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center ring-2 ring-background shadow-sm">
                  <Building2 className="w-7 h-7 text-primary" />
                </div>
              )}
            </Link>
          ) : (
            job.company?.logo_url ? (
              <img 
                src={job.company.logo_url} 
                alt={companyName}
                className="w-14 h-14 rounded-xl object-cover ring-2 ring-background shadow-sm"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
            )
          )}
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg font-semibold leading-tight mb-1 group-hover:text-primary transition-colors">
              {job.title}
            </CardTitle>
            {job.company_id ? (
              <Link 
                to={`/company/${job.company_id}`}
                className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors"
              >
                {companyName}
              </Link>
            ) : (
              <CardDescription className="text-sm">{companyName}</CardDescription>
            )}
          </div>
          {isApplied && (
            <Badge variant="secondary" className="shrink-0 gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <CheckCircle2 className="w-3 h-3" />
              Applied
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-3">
        <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
          {job.description}
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs font-normal">
            <MapPin className="w-3 h-3" />
            {job.location}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1 text-xs font-normal">
            <Briefcase className="w-3 h-3" />
            {job.employment_type}
          </Badge>
          {job.remote_option && (
            <Badge variant="outline" className="text-xs font-normal">
              {job.remote_option}
            </Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1 text-xs font-normal text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {formatDistanceToNow(new Date(job.posted_at), { addSuffix: true })}
          </Badge>
        </div>
        
        {salary && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-primary pt-1">
            <DollarSign className="h-4 w-4" />
            <span>{salary}</span>
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2 pt-0">
        <Button 
          onClick={() => onViewDetails(job.id)}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          View Details
        </Button>
        <Button 
          onClick={() => onApply(job.id)}
          disabled={isApplied}
          className="flex-1"
          size="sm"
        >
          {isApplied ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              Applied
            </>
          ) : (
            'Apply Now'
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};