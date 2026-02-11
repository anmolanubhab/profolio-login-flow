
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
    <div className="grid gap-6">
      {applicants.map((app) => (
        <div 
          key={app.id} 
          className="group flex flex-col md:flex-row md:items-center justify-between p-6 bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
          onClick={() => onViewDetails(app)}
        >
          <div className="flex items-center gap-5 mb-4 md:mb-0">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] rounded-2xl opacity-0 group-hover:opacity-20 transition-opacity blur-lg" />
              <Avatar className="h-14 w-14 rounded-2xl ring-4 ring-gray-50 relative">
                <AvatarImage src={app.profile?.avatar_url} />
                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-[#0077B5]/10 to-[#E1306C]/10 text-[#833AB4] font-bold">
                  {app.profile?.full_name?.charAt(0) || 'U'}
                </AvatarFallback>
              </Avatar>
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-[#0077B5] transition-colors">{app.profile?.full_name || 'Unknown Candidate'}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-sm text-gray-500 flex items-center gap-1">
                  Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                </span>
                {app.resume && (
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#0077B5]/5 text-[#0077B5] rounded-full text-xs font-semibold">
                    <FileText className="h-3.5 w-3.5" />
                    Resume Attached
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 self-end md:self-center">
            <Badge 
              variant="outline" 
              className={`capitalize px-4 py-1.5 rounded-full text-xs font-bold border-2 ${
                app.status === 'shortlisted' ? 'bg-green-50 text-green-700 border-green-100' :
                app.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' :
                app.status === 'viewed' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                'bg-gray-50 text-gray-700 border-gray-100'
              }`}
            >
              {app.status}
            </Badge>
            
            <div className="flex items-center gap-2">
              <div className="relative p-[1px] rounded-full overflow-hidden group/btn">
                <div className="absolute inset-0 bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C]" />
                <Button
                  variant="outline"
                  size="sm"
                  className="relative bg-white hover:bg-transparent hover:text-white border-none rounded-full h-9 px-5 transition-all duration-300 font-bold"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewDetails(app);
                  }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View
                </Button>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-9 w-9 rounded-full hover:bg-gray-100" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreVertical className="h-5 w-5 text-gray-500" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl p-2 border-gray-100 shadow-xl">
                  <DropdownMenuItem 
                    className="rounded-xl focus:bg-[#0077B5]/5 focus:text-[#0077B5] cursor-pointer"
                    onClick={() => onViewDetails(app)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Full Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="rounded-xl focus:bg-green-50 focus:text-green-600 cursor-pointer"
                    onClick={() => onUpdateStatus(app.id, 'shortlisted')}
                  >
                    Shortlist Candidate
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="rounded-xl focus:bg-red-50 focus:text-red-600 cursor-pointer text-red-600"
                    onClick={() => onUpdateStatus(app.id, 'rejected')}
                  >
                    Reject Application
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
