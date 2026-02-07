
import { useEffect, useRef, useState } from 'react';
import { useJobMessages } from '@/hooks/useJobMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';

interface JobChatProps {
  jobId: string;
  correspondentId: string;
  correspondentName: string;
  correspondentAvatar?: string;
  jobTitle?: string;
  className?: string;
}

export const JobChat = ({ 
  jobId, 
  correspondentId, 
  correspondentName, 
  correspondentAvatar,
  jobTitle,
  className 
}: JobChatProps) => {
  const { user } = useAuth();
  const { messages, isLoading, sendMessage, isSending, markAsRead } = useJobMessages(jobId, correspondentId);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messages && messages.length > 0) {
      markAsRead();
      // Scroll to bottom
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, markAsRead]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    
    sendMessage(newMessage, {
      onSuccess: () => {
        setNewMessage('');
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-[500px] border rounded-lg bg-background ${className}`}>
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3 bg-muted/30">
        <Avatar className="h-10 w-10 border">
          <AvatarImage src={correspondentAvatar} />
          <AvatarFallback>{correspondentName.charAt(0)}</AvatarFallback>
        </Avatar>
        <div>
          <h3 className="font-semibold text-sm">{correspondentName}</h3>
          {jobTitle && <p className="text-xs text-muted-foreground">{jobTitle}</p>}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages?.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-8">
              No messages yet. Start the conversation!
            </div>
          ) : (
            messages?.map((msg) => {
              const isMe = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-none'
                        : 'bg-muted text-foreground rounded-tl-none'
                    }`}
                  >
                    <p>{msg.content}</p>
                    <span className={`text-[10px] block mt-1 ${
                      isMe ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}>
                      {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                      {isMe && msg.read && ' • Read'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t bg-muted/30 flex gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isSending}
          className="flex-1"
        />
        <Button type="submit" size="icon" disabled={!newMessage.trim() || isSending}>
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </form>
    </div>
  );
};
