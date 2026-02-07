
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useJobConversations, Conversation } from '@/hooks/useJobConversations';
import { JobChat } from '@/components/jobs/JobChat';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquare, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const JobMessagesPage = () => {
  const { conversations, isLoading } = useJobConversations();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const jobId = searchParams.get('jobId');
  const correspondentId = searchParams.get('correspondentId');
  
  const selectedConversation = conversations?.find(
    c => c.jobId === jobId && c.correspondentId === correspondentId
  );

  const handleSelect = (conv: Conversation) => {
    setSearchParams({ jobId: conv.jobId, correspondentId: conv.correspondentId });
  };

  const handleBack = () => {
    navigate('/jobs/messages');
  };

  // Mobile View Logic
  if (isMobile) {
    if (jobId && correspondentId && selectedConversation) {
      return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
          <div className="flex items-center gap-2 p-4 border-b">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={selectedConversation.correspondentAvatar} />
                <AvatarFallback>{selectedConversation.correspondentName.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="overflow-hidden">
                <h3 className="font-medium text-sm truncate">{selectedConversation.correspondentName}</h3>
                <p className="text-xs text-muted-foreground truncate">{selectedConversation.jobTitle}</p>
              </div>
            </div>
          </div>
          <JobChat 
            jobId={jobId} 
            correspondentId={correspondentId}
            correspondentName={selectedConversation.correspondentName}
            correspondentAvatar={selectedConversation.correspondentAvatar}
            jobTitle={selectedConversation.jobTitle}
            className="flex-1 border-0 rounded-none"
          />
        </div>
      );
    }

    return (
      <div className="container py-4 space-y-4">
        <h1 className="text-2xl font-bold px-2">Messages</h1>
        <ConversationList 
          conversations={conversations} 
          isLoading={isLoading} 
          onSelect={handleSelect} 
        />
      </div>
    );
  }

  // Desktop View Logic
  return (
    <div className="container py-6 max-w-6xl h-[calc(100vh-5rem)]">
      <div className="grid grid-cols-12 h-full border rounded-xl overflow-hidden bg-card shadow-sm">
        {/* Sidebar List */}
        <div className="col-span-4 border-r flex flex-col bg-muted/10">
          <div className="p-4 border-b bg-background/50 backdrop-blur">
            <h1 className="text-xl font-bold">Messages</h1>
          </div>
          <ScrollArea className="flex-1">
            <ConversationList 
              conversations={conversations} 
              isLoading={isLoading} 
              onSelect={handleSelect} 
              selectedId={`${jobId}-${correspondentId}`}
            />
          </ScrollArea>
        </div>

        {/* Chat Area */}
        <div className="col-span-8 flex flex-col bg-background">
          {jobId && correspondentId && selectedConversation ? (
            <JobChat 
              jobId={jobId} 
              correspondentId={correspondentId}
              correspondentName={selectedConversation.correspondentName}
              correspondentAvatar={selectedConversation.correspondentAvatar}
              jobTitle={selectedConversation.jobTitle}
              className="flex-1 border-0 rounded-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <MessageSquare className="h-8 w-8 opacity-50" />
              </div>
              <h3 className="text-lg font-medium">Select a conversation</h3>
              <p className="max-w-xs mt-2">
                Choose a conversation from the list to start messaging.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Sub-component for list
const ConversationList = ({ 
  conversations, 
  isLoading, 
  onSelect, 
  selectedId 
}: { 
  conversations?: Conversation[], 
  isLoading: boolean, 
  onSelect: (c: Conversation) => void,
  selectedId?: string 
}) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (!conversations || conversations.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>No messages yet.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {conversations.map((conv) => {
        const id = `${conv.jobId}-${conv.correspondentId}`;
        const isSelected = selectedId === id;
        
        return (
          <button
            key={id}
            onClick={() => onSelect(conv)}
            className={`flex items-start gap-3 p-4 text-left transition-colors hover:bg-muted/50 border-b last:border-0 ${
              isSelected ? 'bg-muted' : ''
            }`}
          >
            <Avatar className="h-10 w-10 border mt-1">
              <AvatarImage src={conv.correspondentAvatar} />
              <AvatarFallback>{conv.correspondentName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-semibold text-sm truncate">{conv.correspondentName}</h4>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true })}
                </span>
              </div>
              <p className="text-xs font-medium text-primary/80 truncate mb-0.5">
                {conv.jobTitle} • {conv.companyName}
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                  {conv.lastMessage}
                </p>
                {conv.unreadCount > 0 && (
                  <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px]">
                    {conv.unreadCount}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default JobMessagesPage;
