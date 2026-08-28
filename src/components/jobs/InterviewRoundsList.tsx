import { Loader2 } from 'lucide-react';
import { useInterviewRounds } from '@/hooks/use-interview-rounds';
import { InterviewRoundCard } from './InterviewRoundCard';

interface InterviewRoundsListProps {
  applicationId: string;
  role: 'candidate' | 'recruiter';
  currentUserId?: string;
  candidateName?: string;
}

export function InterviewRoundsList({ applicationId, role, currentUserId, candidateName }: InterviewRoundsListProps) {
  const { rounds, isLoading, refetch } = useInterviewRounds(applicationId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (rounds.length === 0) return null;

  return (
    <div className="space-y-3">
      {rounds.map((round) => (
        <InterviewRoundCard
          key={round.id}
          round={round}
          role={role}
          currentUserId={currentUserId}
          candidateName={candidateName}
          onChanged={refetch}
        />
      ))}
    </div>
  );
}
