
import { Applicant } from "@/hooks/useJobApplicants";
import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, FileText, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ApplicantListProps {
  applicants: Applicant[];
  onViewDetails: (applicant: Applicant) => void;
  onUpdateStatus: (id: string, status: Applicant['status']) => void;
}

export const ApplicantList = ({ applicants, onViewDetails, onUpdateStatus }: ApplicantListProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shortlisted': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'viewed': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-4">
      {applicants.map((app) => (
        <div 
          key={app.id} 
          className="flex items-center justify-between p-4 bg-card rounded-lg border shadow-sm hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onViewDetails(app)}
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-10 w-10">
              <AvatarImage src={app.profile?.avatar_url} />
              <AvatarFallback>{app.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-medium text-sm md:text-base">{app.profile?.full_name || 'Unknown Candidate'}</h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}</span>
                {app.resume && (
                  <span className="flex items-center gap-1 text-primary">
                    <FileText className="h-3 w-3" />
                    Resume
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className={`hidden md:inline-flex capitalize ${getStatusColor(app.status)}`}>
              {app.status}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onViewDetails(app)}>
                  <Eye className="mr-2 h-4 w-4" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateStatus(app.id, 'shortlisted')}>
                  Shortlist
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onUpdateStatus(app.id, 'rejected')}>
                  Reject
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}
    </div>
  );
};
