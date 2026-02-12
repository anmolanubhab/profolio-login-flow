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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-380px)] min-h-[600px]">
      {/* Conversations List */}
      <Card className="lg:col-span-1 flex flex-col rounded-[2rem] border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0 px-6 pt-6">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-xl font-bold text-gray-900">Messages</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowNewChat(!showNewChat)}
              className="rounded-full h-10 w-10 p-0 border-gray-100 hover:bg-gray-50 text-gray-500"
            >
              {showNewChat ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
            </Button>
          </div>
          
          {showNewChat && (
            <div className="space-y-2 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={userSearchOpen}
                    className="w-full justify-start text-muted-foreground h-12 rounded-xl border-gray-100 bg-gray-50/50 hover:bg-gray-50 font-medium"
                  >
                    <Search className="h-4 w-4 mr-2 text-gray-400" />
                    Search users...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0 rounded-2xl border-gray-100 shadow-2xl" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Search by name..." 
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                      className="h-12 border-none focus:ring-0"
                    />
                    <CommandList className="max-h-[300px]">
                      {searchLoading && (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-6 w-6 animate-spin text-[#833AB4]" />
                        </div>
                      )}
                      {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <CommandEmpty className="p-8 text-center text-gray-400 font-medium">No users found.</CommandEmpty>
                      )}
                      {!searchLoading && searchQuery.length < 2 && (
                        <div className="p-8 text-sm text-gray-400 text-center font-medium">
                          Type at least 2 characters to search
                        </div>
                      )}
                      {searchResults.length > 0 && (
                        <CommandGroup heading="Users" className="p-2">
                          {searchResults.map((profile) => (
                            <CommandItem
                              key={profile.id}
                              value={profile.id}
                              onSelect={() => startNewConversation(profile)}
                              className="cursor-pointer rounded-xl p-3 hover:bg-gray-50 transition-colors"
                            >
                              <Avatar className="h-10 w-10 mr-3 rounded-xl ring-2 ring-white shadow-sm">
                                <AvatarImage src={profile.avatar_url || undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 font-bold">
                                  {profile.display_name?.[0]?.toUpperCase() || 'U'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">
                                  {profile.display_name || profile.full_name || 'Unknown User'}
                                </p>
                                <p className="text-xs text-gray-500 truncate font-medium">
                                  {profile.profession || profile.email || ''}
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
          <ScrollArea className="h-full px-2">
            {conversations.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <div className="bg-gray-50 h-20 w-20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <MessageCircle className="h-10 w-10 text-gray-200" />
                </div>
                <p className="text-base font-bold text-gray-900 mb-1">No conversations yet</p>
                <p className="text-sm font-medium">Start a new chat to connect</p>
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`p-4 rounded-2xl cursor-pointer hover:bg-gray-50 transition-all duration-300 group ${
                      selectedConversation === conversation.id ? 'bg-gradient-to-r from-[#0077B5]/5 to-[#E1306C]/5 ring-1 ring-[#833AB4]/10 shadow-sm' : ''
                    }`}
                    onClick={() => handleSelectConversation(conversation)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <Avatar className="h-14 w-14 flex-shrink-0 rounded-2xl ring-4 ring-white shadow-sm group-hover:scale-105 transition-transform duration-300">
                          <AvatarImage src={conversation.otherUser?.avatar_url || undefined} />
                          <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 font-bold text-lg">
                            {conversation.otherUser?.display_name?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 border-2 border-white rounded-full" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-gray-900 truncate">
                            {conversation.otherUser?.display_name || 'Unknown User'}
                          </h4>
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: false })}
                          </span>
                        </div>
                        {conversation.lastMessage && (
                          <p className="text-sm text-gray-500 truncate font-medium">
                            {conversation.lastMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat Window */}
      <Card className="lg:col-span-2 flex flex-col rounded-[2rem] border-gray-100 shadow-xl shadow-gray-100/50 overflow-hidden bg-gray-50/30">
        {selectedConversation ? (
          <>
            <CardHeader className="pb-4 flex-shrink-0 border-b border-gray-100 bg-white px-8 pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 rounded-2xl ring-4 ring-gray-50 shadow-sm">
                    <AvatarImage src={selectedConversationUser?.avatar_url || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 font-bold">
                      {selectedConversationUser?.display_name?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg font-bold text-gray-900">
                      {selectedConversationUser?.display_name || 'Chat'}
                    </CardTitle>
                    {selectedConversationUser?.profession && (
                      <p className="text-xs font-bold text-[#833AB4] uppercase tracking-wider">
                        {selectedConversationUser.profession}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="rounded-full h-10 w-10 p-0 border-gray-100 text-gray-400 hover:text-gray-900">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full h-10 w-10 p-0 border-gray-100 text-gray-400 hover:text-gray-900">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 flex flex-col flex-1 overflow-hidden relative">
              {/* Messages */}
              <ScrollArea className="flex-1 p-8">
                <div className="space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-50">
                      <div className="bg-white h-20 w-20 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-gray-100">
                        <MessageCircle className="h-10 w-10 text-gray-200" />
                      </div>
                      <p className="text-base font-bold text-gray-900 mb-1">New conversation</p>
                      <p className="text-sm font-medium text-gray-500">Send a message to start the connection</p>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${
                          message.sender_id === user.id ? 'justify-end' : 'justify-start'
                        }`}
                      >
                        <div className={`flex items-end gap-3 max-w-[80%] ${message.sender_id === user.id ? 'flex-row-reverse' : 'flex-row'}`}>
                          {message.sender_id !== user.id && (
                            <Avatar className="h-8 w-8 flex-shrink-0 rounded-xl ring-2 ring-white shadow-sm mb-1">
                              <AvatarImage src={message.senderProfile?.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px] font-bold">
                                {message.senderProfile?.display_name?.[0]?.toUpperCase() || 'U'}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="flex flex-col gap-1.5">
                            <div
                              className={`rounded-[1.5rem] px-5 py-3 shadow-sm ${
                                message.sender_id === user.id
                                  ? 'bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white rounded-tr-none font-medium'
                                  : 'bg-white text-gray-700 rounded-tl-none border border-gray-100 font-medium'
                              }`}
                            >
                              <div className="text-sm leading-relaxed break-words">{message.content}</div>
                            </div>
                            <span className={`text-[9px] font-bold uppercase tracking-widest px-1 ${
                              message.sender_id === user.id ? 'text-right text-gray-400' : 'text-left text-gray-400'
                            }`}>
                              {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-6 bg-white border-t border-gray-100 flex-shrink-0">
                <div className="max-w-4xl mx-auto flex gap-4 items-end bg-gray-50/80 p-2 rounded-[2rem] border border-gray-100 group-focus-within:bg-white group-focus-within:ring-2 group-focus-within:ring-[#833AB4]/10 transition-all">
                  <Button variant="ghost" size="sm" className="rounded-full h-10 w-10 p-0 text-gray-400 hover:text-[#833AB4] hover:bg-white transition-all">
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Input
                    placeholder="Write a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    className="flex-1 bg-transparent border-none focus-visible:ring-0 text-gray-900 placeholder:text-gray-400 h-10 font-medium"
                  />
                  <Button 
                    onClick={sendMessage}
                    disabled={!newMessage.trim() || sendingMessage}
                    className={`rounded-full h-10 w-10 p-0 shadow-lg transition-all duration-300 ${
                      newMessage.trim() 
                        ? 'bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] text-white hover:opacity-90 shadow-[#833AB4]/20' 
                        : 'bg-gray-200 text-white shadow-none'
                    }`}
                  >
                    {sendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-white">
            <div className="bg-gradient-to-br from-[#0077B5]/5 via-[#833AB4]/5 to-[#E1306C]/5 h-32 w-32 rounded-[2.5rem] flex items-center justify-center mb-8 animate-pulse shadow-sm border border-[#833AB4]/5">
              <MessageCircle className="h-16 w-16 text-[#833AB4]/30" />
            </div>
            <h3 className="text-2xl font-extrabold text-gray-900 mb-3 tracking-tight">Your Inbox</h3>
            <p className="text-gray-500 max-w-sm mx-auto text-lg font-medium leading-relaxed mb-10">
              Select a conversation from the sidebar or start a new chat to begin messaging.
            </p>
            <Button 
              onClick={() => setShowNewChat(true)}
              className="bg-gradient-to-r from-[#0077B5] via-[#833AB4] to-[#E1306C] hover:opacity-90 text-white border-none rounded-full px-10 py-6 h-auto text-lg font-bold shadow-xl shadow-[#833AB4]/20 transition-all hover:scale-105 active:scale-95"
            >
              Start a Conversation
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ChatInterface;
