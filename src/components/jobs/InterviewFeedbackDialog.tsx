import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useInterviewActions, InterviewRecommendation } from '@/hooks/use-interview-rounds';
import { Loader2 } from 'lucide-react';

const RATING_FIELDS: { key: 'technical' | 'communication' | 'problemSolving' | 'overall'; label: string }[] = [
  { key: 'technical', label: 'Technical Skills' },
  { key: 'communication', label: 'Communication' },
  { key: 'problemSolving', label: 'Problem Solving' },
  { key: 'overall', label: 'Overall' },
];

interface InterviewFeedbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roundId: string;
  candidateName: string;
  onSubmitted?: () => void;
}

export const InterviewFeedbackDialog = ({ open, onOpenChange, roundId, candidateName, onSubmitted }: InterviewFeedbackDialogProps) => {
  const { toast } = useToast();
  const { submitFeedback } = useInterviewActions();
  const [ratings, setRatings] = useState<Record<string, number>>({ technical: 3, communication: 3, problemSolving: 3, overall: 3 });
  const [recommendation, setRecommendation] = useState<InterviewRecommendation>('hire');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await submitFeedback({
        roundId,
        technical: ratings.technical,
        communication: ratings.communication,
        problemSolving: ratings.problemSolving,
        overall: ratings.overall,
        recommendation,
        notes,
      });
      toast({ title: 'Feedback submitted', description: 'This is only visible to authorized recruiting personnel.' });
      onOpenChange(false);
      onSubmitted?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to submit feedback.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Interview Feedback</DialogTitle>
          <DialogDescription>
            Private evaluation for {candidateName}. The candidate will never see these scores or notes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {RATING_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <Label className="mb-1 block">{label}: {ratings[key]}/5</Label>
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={ratings[key]}
                onChange={(e) => setRatings((r) => ({ ...r, [key]: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          ))}

          <div>
            <Label className="mb-1 block">Recommendation</Label>
            <Select value={recommendation} onValueChange={(v) => setRecommendation(v as InterviewRecommendation)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strong_hire">Strong Hire</SelectItem>
                <SelectItem value="hire">Hire</SelectItem>
                <SelectItem value="maybe">Maybe</SelectItem>
                <SelectItem value="reject">Reject</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block">Private Notes (Optional)</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Only visible to the recruiting team..." />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
