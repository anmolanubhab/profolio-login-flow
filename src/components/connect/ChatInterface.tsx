import { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, Paperclip, Users, Search, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ChatInterfaceProps {
  user: User;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  updated_at: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string;
  file_url?: string;
  file_name?: string;
  is_read: boolean;
  created_at: string;
  profiles?: {
    display_name?: string;
    avatar_url?: string;
  };
}

const ChatInterface = ({ user }: ChatInterfaceProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [newChatEmail, setNewChatEmail] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchConversations();
  }, [user.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation]);

  useEffect(() => {
    // Set up real-time subscription for conversations
    const conversationChannel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    // Set up real-time subscription for messages
    const messageChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (payload.new.conversation_id === selectedConversation) {
            fetchMessages(selectedConversation);
          }
          fetchConversations(); // Refresh conversations to update last message time
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [selectedConversation]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get profiles for participants
      const conversationsWithProfiles = await Promise.all(
        (data || []).map(async (conv) => {
          const otherParticipantId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', otherParticipantId!)
            .single();

          return {
            ...conv,
            profiles: profile || { display_name: 'Unknown User', avatar_url: null }
          };
        })
      );

      setConversations(conversationsWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Get profiles for senders
      const messagesWithProfiles = await Promise.all(
        (data || []).map(async (message) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('display_name, avatar_url')
            .eq('user_id', message.sender_id!)
            .single();

          return {
            ...message,
            profiles: profile || { display_name: 'Unknown User', avatar_url: null }
          };
        })
      );

      setMessages(messagesWithProfiles);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to fetch messages",
        variant: "destructive",
      });
    }
  };

  const markMessagesAsRead = async (conversationId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_id', user.id);
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sendingMessage) return;

    setSendingMessage(true);
    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: selectedConversation,
          sender_id: user.id,
          content: newMessage.trim(),
          message_type: 'text'
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const startNewConversation = async () => {
    if (!newChatEmail.trim()) return;

    try {
      // Find user by email (we'd need to create a function for this)
      // For now, we'll create a simple version
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .eq('user_id', newChatEmail); // This should be improved to search by email

      if (profileError) throw profileError;

      if (!profiles || profiles.length === 0) {
        toast({
          title: "User not found",
          description: "Please check the email address",
          variant: "destructive",
        });
        return;
      }

      const otherUserId = profiles[0].user_id;

      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`)
        .single();

      if (existingConv) {
        setSelectedConversation(existingConv.id);
        setShowNewChat(false);
        setNewChatEmail('');
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participant_1: user.id,
          participant_2: otherUserId
        })
        .select('id')
        .single();

      if (error) throw error;

      setSelectedConversation(newConv.id);
      setShowNewChat(false);
      setNewChatEmail('');
      fetchConversations();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Conversations</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewChat(!showNewChat)}
            >
              <Users className="h-4 w-4" />
            </Button>
          </div>
          {showNewChat && (
            <div className="space-y-2 pt-2">
              <Input
                placeholder="Enter user ID to start chat..."
                value={newChatEmail}
                onChange={(e) => setNewChatEmail(e.target.value)}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={startNewConversation}
                  className="flex-1"
                >
                  Start Chat
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowNewChat(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                  selectedConversation === conversation.id ? 'bg-muted' : ''
                }`}
                onClick={() => setSelectedConversation(conversation.id)}
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={conversation.profiles?.avatar_url} />
                    <AvatarFallback>
                      {conversation.profiles?.display_name?.[0] || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">
                      {conversation.profiles?.display_name || 'Unknown User'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {conversations.length === 0 && (
              <div className="p-4 text-center text-muted-foreground">
                No conversations yet. Start a new chat!
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Window */}
      <Card className="lg:col-span-2">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Chat</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex flex-col h-[500px]">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender_id === user.id ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          message.sender_id === user.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="text-sm">{message.content}</div>
                        <div
                          className={`text-xs mt-1 ${
                            message.sender_id === user.id
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <Separator />
              <div className="p-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="icon">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    disabled={sendingMessage}
                  />
                  <Button onClick={sendMessage} disabled={sendingMessage}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Select a conversation to start chatting</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ChatInterface;