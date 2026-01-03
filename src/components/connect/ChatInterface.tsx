import { useState, useEffect, useRef, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Send, Plus, MessageCircle, Search, Loader2, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ChatInterfaceProps {
  user: User;
}

interface Profile {
  id: string;
  user_id: string;
  display_name?: string;
  full_name?: string;
  email?: string;
  avatar_url?: string;
  profession?: string;
}

interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string;
  last_message_at: string;
  updated_at: string;
  otherUser?: Profile;
  lastMessage?: string;
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
  senderProfile?: Profile;
}

const ChatInterface = ({ user }: ChatInterfaceProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedConversationUser, setSelectedConversationUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchConversations();
  }, [user.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
    }
  }, [selectedConversation]);

  // Real-time subscriptions
  useEffect(() => {
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
          const newMsg = payload.new as Message;
          if (newMsg.conversation_id === selectedConversation) {
            fetchMessages(selectedConversation);
          }
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
  }, [selectedConversation]);

  // Search users with debounce
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, display_name, full_name, email, avatar_url, profession')
          .neq('user_id', user.id)
          .or(`display_name.ilike.%${searchQuery}%,full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`)
          .limit(10);

        if (error) throw error;
        setSearchResults(data || []);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setSearchLoading(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, user.id]);

  const fetchConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get profiles for other participants and last message
      const conversationsWithDetails = await Promise.all(
        (data || []).map(async (conv) => {
          const otherParticipantId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
          
          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, user_id, display_name, avatar_url, profession')
            .eq('user_id', otherParticipantId!)
            .maybeSingle();

          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...conv,
            otherUser: profile || undefined,
            lastMessage: lastMsg?.content
          };
        })
      );

      setConversations(conversationsWithDetails);
    } catch (error) {
      console.error('Error fetching conversations:', error);
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
            .select('id, user_id, display_name, avatar_url, profession')
            .eq('user_id', message.sender_id!)
            .maybeSingle();

          return {
            ...message,
            senderProfile: profile || undefined
          };
        })
      );

      setMessages(messagesWithProfiles);
    } catch (error) {
      console.error('Error fetching messages:', error);
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
    } catch (error) {
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
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const startNewConversation = async (selectedUser: Profile) => {
    if (!selectedUser.user_id) return;

    try {
      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('conversations')
        .select('id')
        .or(`and(participant_1.eq.${user.id},participant_2.eq.${selectedUser.user_id}),and(participant_1.eq.${selectedUser.user_id},participant_2.eq.${user.id})`)
        .maybeSingle();

      if (existingConv) {
        setSelectedConversation(existingConv.id);
        setSelectedConversationUser(selectedUser);
        setShowNewChat(false);
        setSearchQuery('');
        setUserSearchOpen(false);
        return;
      }

      // Create new conversation
      const { data: newConv, error } = await supabase
        .from('conversations')
        .insert({
          participant_1: user.id,
          participant_2: selectedUser.user_id
        })
        .select('id')
        .single();

      if (error) throw error;

      setSelectedConversation(newConv.id);
      setSelectedConversationUser(selectedUser);
      setShowNewChat(false);
      setSearchQuery('');
      setUserSearchOpen(false);
      fetchConversations();

      toast({
        title: "Success",
        description: `Started conversation with ${selectedUser.display_name || 'user'}`,
      });
    } catch (error) {
      console.error('Error starting conversation:', error);
      toast({
        title: "Error",
        description: "Failed to start conversation",
        variant: "destructive",
      });
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation.id);
    setSelectedConversationUser(conversation.otherUser || null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[calc(100vh-280px)] min-h-[500px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1 flex flex-col">
        <CardHeader className="pb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Messages</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewChat(!showNewChat)}
            >
              {showNewChat ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          
          {showNewChat && (
            <div className="space-y-2 pt-2">
              <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={userSearchOpen}
                    className="w-full justify-start text-muted-foreground"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Search users...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search by name..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      {searchLoading && (
                        <div className="flex items-center justify-center p-4">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                      {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <CommandEmpty>No users found.</CommandEmpty>
                      )}
                      {!searchLoading && searchQuery.length < 2 && (
                        <div className="p-4 text-sm text-muted-foreground text-center">
                          Type at least 2 characters to search
                        </div>
                      )}
                      {searchResults.length > 0 && (
                        <CommandGroup heading="Users">
                          {searchResults.map((profile) => (
                            <CommandItem
                              key={profile.id}
                              value={profile.id}
                              onSelect={() => startNewConversation(profile)}
                              className="cursor-pointer"
                            >
                              <Avatar className="h-8 w-8 mr-2">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback>
                                  {profile.display_name?.[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {profile.display_name || profile.full_name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {profile.email || profile.profession || ''}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      )}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No conversations yet</p>
                <p className="text-xs mt-1">Start a new chat to connect</p>
              </div>
            ) : (
              conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                    selectedConversation === conversation.id ? 'bg-muted' : ''
                  }`}
                  onClick={() => handleSelectConversation(conversation)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={conversation.otherUser?.avatar_url || undefined} />
                      <AvatarFallback>
                        {conversation.otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {conversation.otherUser?.display_name || 'Unknown User'}
                      </div>
                      {conversation.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conversation.lastMessage}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Window */}
      <Card className="lg:col-span-2 flex flex-col">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-3 flex-shrink-0 border-b">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={selectedConversationUser?.avatar_url || undefined} />
                  <AvatarFallback>
                    {selectedConversationUser?.display_name?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <CardTitle className="text-base">
                    {selectedConversationUser?.display_name || 'Chat'}
                  </CardTitle>
                  {selectedConversationUser?.profession && (
                    <p className="text-xs text-muted-foreground">
                      {selectedConversationUser.profession}
                    </p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1 overflow-hidden">
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs mt-1">Send a message to start the conversation</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div className="flex items-end gap-2 max-w-[70%]">
                          {message.sender_id !== user.id && (
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarImage src={message.senderProfile?.avatar_url || undefined} />
                              <AvatarFallback className="text-xs">
                                {message.senderProfile?.display_name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              message.sender_id === user.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="text-sm break-words">{message.content}</div>
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
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t flex-shrink-0">
                <div className="flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    disabled={sendingMessage}
                    className="flex-1"
                  />
                  <Button 
                    onClick={sendMessage} 
                    disabled={sendingMessage || !newMessage.trim()}
                    size="icon"
                  >
                    {sendingMessage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="font-medium mb-1">Select a conversation</h3>
              <p className="text-sm">Choose from your existing conversations or start a new chat</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ChatInterface;
