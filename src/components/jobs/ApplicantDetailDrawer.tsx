
import { Applicant } from "@/hooks/useJobApplicants";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExternalLink, FileText, Mail, ThumbsDown, ThumbsUp, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { JobChat } from "./JobChat";

interface ApplicantDetailDrawerProps {
  applicant: Applicant | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdateStatus: (id: string, status: Applicant['status']) => void;
}

export const ApplicantDetailDrawer = ({ applicant, open, onOpenChange, onUpdateStatus }: ApplicantDetailDrawerProps) => {
  const [chatOpen, setChatOpen] = useState(false);

  if (!applicant) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="space-y-4">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={applicant.profile?.avatar_url} />
              <AvatarFallback className="text-lg">{applicant.profile?.full_name?.charAt(0) || 'U'}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <SheetTitle className="text-xl">{applicant.profile?.full_name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-3 w-3" />
                {applicant.profile?.email || 'No email provided'}
              </SheetDescription>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="capitalize">
                  {applicant.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  Applied {formatDistanceToNow(new Date(applicant.created_at), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>
        </SheetHeader>

        <div className="py-6 space-y-6">
          {/* Resume Section */}
          <div className="space-y-3">
            <h3 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Resume
            </h3>
            {applicant.resume ? (
              <div className="p-4 border rounded-lg bg-muted/20 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{applicant.resume.title}</p>
                  <p className="text-xs text-muted-foreground">Attached resume</p>
                </div>
                {applicant.resume.file_url && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={applicant.resume.file_url} target="_blank" rel="noopener noreferrer" className="gap-2">
                      View
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">No resume attached.</p>
            )}
          </div>

          <Separator />

          {/* Cover Note Section */}
          <div className="space-y-3">
            <h3 className="font-medium">Cover Note</h3>
            <div className="p-4 rounded-lg bg-muted/30 text-sm leading-relaxed whitespace-pre-wrap">
              {applicant.cover_note || "No cover note provided."}
            </div>
          </div>
        </div>

        <SheetFooter className="flex-col sm:flex-row gap-2 sm:gap-4 mt-auto border-t pt-4">
          <Dialog open={chatOpen} onOpenChange={setChatOpen}>
            <DialogTrigger asChild>
              <Button className="flex-1 gap-2" variant="outline">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Message {applicant.profile?.full_name}</DialogTitle>
              </DialogHeader>
              <JobChat 
                jobId={applicant.job_id} 
                correspondentId={applicant.user_id} 
                correspondentName={applicant.profile?.full_name || 'Candidate'}
                correspondentAvatar={applicant.profile?.avatar_url}
              />
            </DialogContent>
          </Dialog>

          <Button 
            className="flex-1 gap-2" 
            variant={applicant.status === 'shortlisted' ? 'secondary' : 'default'}
            onClick={() => onUpdateStatus(applicant.id, 'shortlisted')}
          >
            <ThumbsUp className="h-4 w-4" />
            Shortlist
          </Button>
          <Button 
            className="flex-1 gap-2" 
            variant="outline"
            onClick={() => onUpdateStatus(applicant.id, 'rejected')}
          >
            <ThumbsDown className="h-4 w-4" />
            Reject
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
