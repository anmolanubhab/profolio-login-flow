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
import {
  Send, Plus, MessageCircle, Search, Loader2, X, Paperclip, FileText, Download,
  Image, Camera, Mic, User as UserIcon, BarChart3, Calendar, Sticker as StickerIcon,
} from 'lucide-react';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { secureUpload } from '@/lib/secure-upload';
import { STICKERS, getSticker, getRecentStickers, recordRecentSticker, DEFAULT_STICKER_PACK, Sticker } from '@/lib/stickers';

const ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv'];
const ALLOWED_DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB, matches existing resumes/certificates limit

function formatFileSize(bytes?: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

function StickerGrid({
  stickers,
  emptyLabel,
  disabled,
  onSelect,
}: {
  stickers: Sticker[];
  emptyLabel: string;
  disabled: boolean;
  onSelect: (sticker: Sticker) => void;
}) {
  if (stickers.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-6">{emptyLabel}</p>;
  }
  return (
    <div className="grid grid-cols-4 gap-1.5 max-h-[220px] overflow-y-auto">
      {stickers.map((sticker) => (
        <button
          key={sticker.id}
          type="button"
          aria-label={`Send ${sticker.label} sticker`}
          title={sticker.label}
          disabled={disabled}
          onClick={() => onSelect(sticker)}
          className="aspect-square rounded-md p-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        >
          <img src={sticker.src} alt={sticker.label} loading="lazy" className="w-full h-full object-contain" />
        </button>
      ))}
    </div>
  );
}

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
  mime_type?: string | null;
  file_size?: number | null;
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
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerSearch, setStickerSearch] = useState('');
  const [stickerTab, setStickerTab] = useState<'recent' | 'default'>('default');
  const [sendingSticker, setSendingSticker] = useState(false);
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const attachAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    fetchConversations();
    const recents = getRecentStickers(user.id);
    setRecentStickers(recents);
    setStickerTab(recents.length > 0 ? 'recent' : 'default');
  }, [user.id]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation);
      markMessagesAsRead(selectedConversation);
    }
    setStickerPickerOpen(false);
    setAttachMenuOpen(false);
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

  const handleDocumentFileSelected = async (file: File) => {
    if (!selectedConversation || uploadingDocument) return;

    const ext = fileExtension(file.name);
    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext) || !ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type)) {
      toast({
        title: 'Unsupported file',
        description: 'Supported types: PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV.',
        variant: 'destructive',
      });
      return;
    }
    if (file.size > MAX_DOCUMENT_SIZE) {
      toast({ title: 'File is too large.', description: 'Maximum size is 10MB.', variant: 'destructive' });
      return;
    }

    setUploadingDocument(true);
    try {
      const result = await secureUpload({
        bucket: 'message-attachments',
        file,
        userId: user.id,
        pathPrefix: [selectedConversation],
      });

      if (!result.success || !result.filePath) {
        toast({ title: 'Upload failed', description: 'Could not upload the document. Please try again.', variant: 'destructive' });
        return;
      }

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: file.name,
        message_type: 'file',
        file_url: result.filePath,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending document:', error);
      toast({ title: 'Error', description: 'Could not send the document. Please try again.', variant: 'destructive' });
    } finally {
      setUploadingDocument(false);
    }
  };

  const handleOpenAttachment = async (message: Message) => {
    setOpeningAttachmentId(message.id);
    try {
      const { data, error } = await supabase.functions.invoke('get-message-attachment-url', {
        body: { message_id: message.id },
      });
      if (error || !data?.ok || !data?.url) {
        toast({ title: 'Error', description: "Couldn't open this document. Please try again.", variant: 'destructive' });
        return;
      }
      window.open(data.url, '_blank');
    } catch (error) {
      console.error('Error opening attachment:', error);
      toast({ title: 'Error', description: "Couldn't open this document. Please try again.", variant: 'destructive' });
    } finally {
      setOpeningAttachmentId(null);
    }
  };

  useEffect(() => {
    if (!stickerPickerOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      if (attachAreaRef.current && !attachAreaRef.current.contains(e.target as Node)) {
        setStickerPickerOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setStickerPickerOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [stickerPickerOpen]);

  const handleNotImplemented = (feature: string) => {
    setAttachMenuOpen(false);
    toast({ title: feature, description: 'This feature is not available yet.' });
  };

  const handleSendSticker = async (sticker: Sticker) => {
    if (!selectedConversation || sendingSticker) return;

    setSendingSticker(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: sticker.label,
        message_type: 'sticker',
        file_url: sticker.id,
        file_name: sticker.label,
      });

      if (error) throw error;

      recordRecentSticker(user.id, sticker.id);
      setRecentStickers(getRecentStickers(user.id));
      setStickerPickerOpen(false);
    } catch (error) {
      console.error('Error sending sticker:', error);
      toast({ title: 'Error', description: 'Could not send the sticker. Please try again.', variant: 'destructive' });
    } finally {
      setSendingSticker(false);
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
                          {message.message_type === 'sticker' ? (
                            (() => {
                              const sticker = getSticker(message.file_url || '');
                              return (
                                <div className="flex flex-col items-start">
                                  {sticker ? (
                                    <img
                                      src={sticker.src}
                                      alt={sticker.label}
                                      className="w-[160px] h-[160px] max-w-[45vw] max-h-[45vw] sm:max-w-[180px] sm:max-h-[180px] object-contain"
                                    />
                                  ) : (
                                    <div className="rounded-2xl px-4 py-2 bg-muted text-sm text-muted-foreground">
                                      Sticker unavailable
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                                  </div>
                                </div>
                              );
                            })()
                          ) : message.message_type === 'file' ? (
                            <div
                              className={`rounded-2xl p-3 max-w-full ${
                                message.sender_id === user.id
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 rounded-lg bg-background/90 text-foreground px-3 py-2.5">
                                <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate" title={message.file_name}>
                                    {message.file_name || 'Document'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {(fileExtension(message.file_name || '') || 'file').toUpperCase()}
                                    {message.file_size ? ` · ${formatFileSize(message.file_size)}` : ''}
                                  </p>
                                </div>
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="shrink-0"
                                        aria-label={`Open ${message.file_name || 'document'}`}
                                        disabled={openingAttachmentId === message.id}
                                        onClick={() => handleOpenAttachment(message)}
                                      >
                                        {openingAttachmentId === message.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                          <Download className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Open / Download</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <div
                                className={`text-xs mt-1.5 ${
                                  message.sender_id === user.id
                                    ? 'text-primary-foreground/70'
                                    : 'text-muted-foreground'
                                }`}
                              >
                                {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                              </div>
                            </div>
                          ) : (
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
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div className="p-4 border-t flex-shrink-0">
                {uploadingDocument && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading document…
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleDocumentFileSelected(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="relative" ref={attachAreaRef}>
                    <DropdownMenu open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="outline"
                                size="icon"
                                disabled={sendingMessage || uploadingDocument}
                                aria-label="Attach file"
                              >
                                <Paperclip className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                          </TooltipTrigger>
                          <TooltipContent>Attach</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem onSelect={() => documentInputRef.current?.click()}>
                          <FileText className="h-4 w-4 mr-2" />
                          Document
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Photos & videos')}>
                          <Image className="h-4 w-4 mr-2" />
                          Photos &amp; videos
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Camera')}>
                          <Camera className="h-4 w-4 mr-2" />
                          Camera
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Audio')}>
                          <Mic className="h-4 w-4 mr-2" />
                          Audio
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Contact')}>
                          <UserIcon className="h-4 w-4 mr-2" />
                          Contact
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Poll')}>
                          <BarChart3 className="h-4 w-4 mr-2" />
                          Poll
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Event')}>
                          <Calendar className="h-4 w-4 mr-2" />
                          Event
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setStickerPickerOpen(true)}>
                          <StickerIcon className="h-4 w-4 mr-2" />
                          New sticker
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {stickerPickerOpen && (
                      <div
                        role="dialog"
                        aria-label="Sticker picker"
                        className="absolute bottom-full left-0 mb-2 w-[300px] rounded-md border bg-popover text-popover-foreground shadow-md z-50"
                      >
                        <div className="p-3 pb-2 border-b">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-semibold">Stickers</p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label="Close sticker picker"
                              onClick={() => setStickerPickerOpen(false)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              value={stickerSearch}
                              onChange={(e) => setStickerSearch(e.target.value)}
                              placeholder="Search stickers..."
                              aria-label="Search stickers"
                              className="pl-8 h-8 text-sm"
                              autoFocus
                            />
                          </div>
                        </div>
                        <Tabs value={stickerTab} onValueChange={(v) => setStickerTab(v as 'recent' | 'default')}>
                          <TabsList className="w-full rounded-none grid grid-cols-2 h-9">
                            <TabsTrigger value="recent" className="text-xs">Recent</TabsTrigger>
                            <TabsTrigger value="default" className="text-xs">{DEFAULT_STICKER_PACK.name}</TabsTrigger>
                          </TabsList>
                          <TabsContent value="recent" className="m-0 p-3 pt-2">
                            <StickerGrid
                              stickers={recentStickers.filter((s) => s.label.toLowerCase().includes(stickerSearch.toLowerCase()))}
                              emptyLabel="No recent stickers yet."
                              disabled={sendingSticker}
                              onSelect={handleSendSticker}
                            />
                          </TabsContent>
                          <TabsContent value="default" className="m-0 p-3 pt-2">
                            <StickerGrid
                              stickers={STICKERS.filter((s) => s.label.toLowerCase().includes(stickerSearch.toLowerCase()))}
                              emptyLabel="No stickers found."
                              disabled={sendingSticker}
                              onSelect={handleSendSticker}
                            />
                          </TabsContent>
                        </Tabs>
                      </div>
                    )}
                  </div>
                  <Input
                    placeholder="Type a message..."
                    aria-label="Message"
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
                    aria-label="Send message"
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
