
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Briefcase, Calendar, Building2, CheckCircle2, DollarSign, Sparkles, MoreVertical, Edit, Trash2, Bookmark, Users, BarChart2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    experience_level?: string;
    matchReasons?: string[];
    company?: {
      name: string;
      logo_url?: string;
    } | null;
    posted_by?: string;
    is_featured?: boolean;
  };
  onApply?: (job: any) => void;
  onViewDetails: (job: any) => void;
  onEdit?: (job: any) => void;
  onDelete?: (jobId: string) => void;
  onToggleSave?: (jobId: string) => void;
  isSaved?: boolean;
  isApplied?: boolean;
  readOnly?: boolean;
  currentUserId?: string;
}

export const JobCard = ({ job, onApply, onViewDetails, onEdit, onDelete, onToggleSave, isSaved, isApplied, readOnly, currentUserId }: JobCardProps) => {
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
  const isOwner = currentUserId && job.posted_by === currentUserId;
  
  return (
    <Card className={cn(
      "hover:shadow-lg transition-all duration-200 group relative overflow-hidden",
      "rounded-none sm:rounded-[2rem] shadow-none sm:shadow-lg",
      "border-0 sm:border border-gray-100 bg-white",
      job.is_featured ? 'ring-1 ring-amber-400/30 bg-amber-50/10' : ''
    )}>
      
      <CardHeader className="px-4 py-6 sm:px-8 sm:pt-8 sm:pb-4">
        <div className="flex items-start gap-4">
          <div className="absolute top-0 right-0 p-4 flex flex-col gap-1 items-end z-10">
             {job.is_featured && (
               <Badge variant="default" className="bg-amber-500 hover:bg-amber-600 text-white gap-1 shadow-sm border-amber-600/20">
                <Sparkles className="w-3 h-3 fill-white" />
                Featured
               </Badge>
             )}
             {job.matchReasons && job.matchReasons.length > 0 && (
               <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20 border-primary/20 gap-1.5">
                <Sparkles className="w-3 h-3" />
                Recommended
               </Badge>
             )}
          </div>

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
          <div className="flex-1 min-w-0 pr-24">
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
          
          <div className="flex flex-col items-end gap-2 absolute top-4 right-4">
             {isApplied && (
              <Badge variant="secondary" className="gap-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Applied
              </Badge>
            )}

            {isOwner && (onEdit || onDelete) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to={`/jobs/${job.id}/applicants`} className="cursor-pointer">
                      <Users className="h-4 w-4 mr-2" />
                      View Applicants
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/jobs/${job.id}/insights`} className="cursor-pointer">
                      <BarChart2 className="h-4 w-4 mr-2" />
                      View Insights
                    </Link>
                  </DropdownMenuItem>
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(job)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Job
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <DropdownMenuItem 
                      onClick={() => onDelete(job.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Job
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 py-6 sm:px-8 sm:pb-8 space-y-4">
        <p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {job.description}
        </p>
        
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="flex items-center gap-1 text-xs font-normal bg-gray-100 text-gray-700">
            <MapPin className="w-3 h-3" />
            {job.location}
          </Badge>
          <Badge variant="secondary" className="flex items-center gap-1 text-xs font-normal bg-gray-100 text-gray-700">
            <Briefcase className="w-3 h-3" />
            {job.employment_type}
          </Badge>
          {job.remote_option && job.remote_option !== 'on-site' && (
            <Badge variant="outline" className="text-xs font-normal border-primary/20 text-primary">
              {job.remote_option}
            </Badge>
          )}
          {job.experience_level && (
            <Badge variant="outline" className="text-xs font-normal capitalize border-gray-200 text-gray-600">
              {job.experience_level}
            </Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1 text-xs font-normal text-gray-500 border-gray-100">
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

        {job.matchReasons && job.matchReasons.length > 0 && (
          <div className="pt-1">
            <p className="text-xs text-gray-500 italic">
              Matches your {job.matchReasons.join(', ').toLowerCase()}
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="px-4 pb-6 sm:px-8 sm:pb-8 gap-3 pt-0">
        <Button 
          onClick={() => onViewDetails(job)}
          variant="outline"
          className="flex-1"
          size="sm"
        >
          View Details
        </Button>
        {!readOnly && onApply && (
          <Button 
            onClick={() => onApply(job)}
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
        )}
      </CardFooter>
    </Card>
  );
};
