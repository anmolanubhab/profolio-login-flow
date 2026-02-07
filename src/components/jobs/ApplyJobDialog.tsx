
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useResumes } from '@/hooks/useResumes';
import { useJobApplication } from '@/hooks/useJobApplication';
import { useNavigate } from 'react-router-dom';
import { FileText, Loader2, AlertCircle } from 'lucide-react';

interface ApplyJobDialogProps {
  job: {
    id: string;
    title: string;
    company_name?: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ApplyJobDialog = ({ job, open, onOpenChange }: ApplyJobDialogProps) => {
  const navigate = useNavigate();
  const { resumes, isLoading: isLoadingResumes } = useResumes();
  const { apply, isApplying } = useJobApplication();
  
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [coverNote, setCoverNote] = useState('');

  // Filter resumes visible to recruiters
  // If no resumes at all, we'll guide to create one.
  // If resumes exist but none are public/recruiter, we also guide.
  const availableResumes = resumes?.filter(r => r.visibility === 'recruiters' || r.visibility === 'everyone') || [];
  const hasAnyResumes = resumes && resumes.length > 0;
  
  const handleApply = () => {
    if (!job || !selectedResumeId) return;
    
    apply({
      jobId: job.id,
      resumeId: selectedResumeId,
      coverNote: coverNote.trim()
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setCoverNote('');
        setSelectedResumeId('');
      }
    });
  };

  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Apply for {job.title}</DialogTitle>
          <DialogDescription>
            {job.company_name ? `at ${job.company_name}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Resume</label>
            {isLoadingResumes ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading resumes...
              </div>
            ) : availableResumes.length > 0 ? (
              <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a resume..." />
                </SelectTrigger>
                <SelectContent>
                  {availableResumes.map(resume => (
                    <SelectItem key={resume.id} value={resume.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>{resume.title}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="p-4 border border-dashed rounded-lg bg-muted/50 text-center">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium mb-1">
                  {hasAnyResumes ? "No suitable resumes found" : "No resumes found"}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {hasAnyResumes 
                    ? "You need a resume visible to recruiters to apply." 
                    : "You need to create a resume to apply for jobs."}
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/resume')}>
                  {hasAnyResumes ? "Update Resume Visibility" : "Create Resume"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Cover Note (Optional)</label>
            <Textarea
              placeholder="Briefly introduce yourself..."
              value={coverNote}
              onChange={(e) => setCoverNote(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleApply} 
            disabled={!selectedResumeId || isApplying}
          >
            {isApplying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Applying...
              </>
            ) : (
              'Submit Application'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
