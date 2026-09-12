import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useLockFullscreenOverlay } from '@/hooks/useFullscreenOverlay';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Send, Plus, Search, Loader2, X, Paperclip, FileText, Download,
  Image, Camera, Mic, User as UserIcon, BarChart3, Calendar, Sticker as StickerIcon,
  ChevronLeft, MoreVertical, Pin, PinOff, Star, StarOff, Reply as ReplyIcon,
  CornerUpRight, Trash2, Check, Users2, Building2, MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { secureUpload } from '@/lib/secure-upload';
import { STICKERS, getSticker, getRecentStickers, recordRecentSticker, DEFAULT_STICKER_PACK, Sticker } from '@/lib/stickers';
import { useQueryClient } from '@tanstack/react-query';
import { UNREAD_MESSAGES_QUERY_KEY } from '@/hooks/use-unread-message-count';
import { EmptyState } from '@/components/ui/empty-state';
import noMessageImage from '@/assets/empty-states/no-massage.png';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MessageActionsMenu } from './MessageActionsMenu';
import { MessageInfoDialog } from './MessageInfoDialog';
import { ForwardMessageDialog, type ForwardableMessage } from './ForwardMessageDialog';
import { CreateGroupDialog } from './CreateGroupDialog';
import { MessageImage } from './MessageImage';
import { PhotoLightbox } from '@/components/post/PhotoLightbox';
import { useMessageActions } from '@/hooks/useMessageActions';
import { getMessageAttachmentUrl } from '@/lib/message-attachment-url';
import {
  uploadMessageAttachment, validateMessageAttachment, UploadAbortError,
} from '@/lib/message-upload';

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

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  const diffDays = Math.round(
    (startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / (24 * 60 * 60 * 1000),
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * The single-panel (list-only or chat-only) vs. two-column layout in this
 * component is entirely driven by Tailwind's `lg:` breakpoint (1024px) --
 * see the `hidden lg:flex` classes below. The mobile full-screen chat page
 * must switch at that same width, not the app-wide `useIsMobile()` 768px
 * breakpoint -- otherwise a phone in landscape (typically 700-900px wide)
 * falls in the gap between the two, where the CSS still hides the list but
 * the full-screen takeover has already turned itself off.
 */
function useIsBelowLg(): boolean {
  const [isBelowLg, setIsBelowLg] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 1024,
  );
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const onChange = () => setIsBelowLg(mql.matches);
    mql.addEventListener('change', onChange);
    onChange();
    return () => mql.removeEventListener('change', onChange);
  }, []);
  return isBelowLg;
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
  unreadCount: number;
  is_group?: boolean;
  group_name?: string | null;
  group_description?: string | null;
  group_avatar_url?: string | null;
  groupMemberCount?: number;
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
  reply_to_id?: string | null;
  deleted_for_everyone?: boolean;
  is_forwarded?: boolean;
  senderProfile?: Profile;
}

interface StarredMessageRow {
  id: string;
  conversation_id: string;
  content: string;
  message_type: string;
  file_name?: string | null;
  created_at: string;
  otherUser?: Profile;
}

const ChatInterface = ({ user }: ChatInterfaceProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [selectedConversationUser, setSelectedConversationUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [openingAttachmentId, setOpeningAttachmentId] = useState<string | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false);
  const [stickerSearch, setStickerSearch] = useState('');
  const [stickerTab, setStickerTab] = useState<'recent' | 'default'>('default');
  const [sendingSticker, setSendingSticker] = useState(false);
  const [recentStickers, setRecentStickers] = useState<Sticker[]>([]);

  // List panel redesign: inline search-to-filter, All/Unread/Favourites/Groups
  // pills, and the 3-dot menu (New group / New community / Starred).
  const [listFilter, setListFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'favourites' | 'groups'>('all');
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [starredSheetOpen, setStarredSheetOpen] = useState(false);
  const [starredMessages, setStarredMessages] = useState<StarredMessageRow[]>([]);
  const [starredLoading, setStarredLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const attachAreaRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imageAbortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const params = useParams<{ conversationId?: string }>();
  const isMobile = useIsBelowLg();

  // On mobile, an open conversation takes over the whole viewport as a
  // dedicated page (route-driven via /connect/:conversationId) rather than
  // sitting in the two-column desktop layout -- see the WhatsApp-style chat
  // page requirements. Locking the fullscreen overlay hides BottomNavigation
  // while it's open (same mechanism the Story page uses).
  const mobileFullScreen = isMobile && !!selectedConversation;
  useLockFullscreenOverlay(mobileFullScreen);

  // WhatsApp-style message actions -----------------------------------------
  const {
    reactionsByMessage, starredIds, pinnedIds, pins, deletedForMeIds,
    toggleReaction, toggleStar, bulkStar, togglePin, bulkPin, deleteForMe,
    reload: reloadActions,
  } = useMessageActions(selectedConversation, user.id);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [infoMessage, setInfoMessage] = useState<Message | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Message | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [savingAttachmentId, setSavingAttachmentId] = useState<string | null>(null);

  // Multi-message selection mode -----------------------------------------
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [forwardTargets, setForwardTargets] = useState<Message[] | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Image messaging (Phase 3a) ------------------------------------------
  const [pendingImage, setPendingImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [imageUpload, setImageUpload] = useState<{ progress: number; status: 'idle' | 'uploading' | 'error' }>({
    progress: 0,
    status: 'idle',
  });
  const [lightbox, setLightbox] = useState<{ url: string; alt: string } | null>(null);

  // Messages the current user has hidden with "delete for me" never render.
  const visibleMessages = messages.filter((m) => !deletedForMeIds.has(m.id));

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelection = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Leaving a conversation drops selection mode with it.
  useEffect(() => {
    exitSelection();
  }, [selectedConversation, exitSelection]);

  /** Drop the shared unread badge to its true value right after a read. */
  const refreshUnreadBadge = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: UNREAD_MESSAGES_QUERY_KEY });
  }, [queryClient]);

  /**
   * Mark every message the current user has received in this conversation as
   * read. Goes through the `mark_conversation_read` RPC: a plain `messages`
   * UPDATE from the client is blocked by RLS for the recipient (the only
   * UPDATE policy is `sender_id = auth.uid()`), which is why the badge used to
   * never clear. The RPC is participant-checked and idempotent, so calling it
   * repeatedly (e.g. on every realtime message) is safe.
   *
   * Declared here -- above the effects that list it as a dependency -- so its
   * `const` binding is initialised before those `useEffect(...)` dependency
   * arrays are evaluated during render (a later declaration threw a TDZ
   * ReferenceError, blanking the whole page).
   */
  const markMessagesAsRead = useCallback(
    async (conversationId: string) => {
      try {
        const { error } = await supabase.rpc('mark_conversation_read', {
          p_conversation_id: conversationId,
        });
        if (error) throw error;
        // Optimistically clear this thread's unread pip and drop the global
        // badge to its true value.
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c)),
        );
        refreshUnreadBadge();
      } catch (error) {
        console.error('Error marking messages as read:', error);
      }
    },
    [refreshUnreadBadge],
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Auto-grow the composer textarea up to a max height instead of scrolling
  // inside a fixed-size box.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [newMessage]);

  // Keep the open conversation in sync with the /connect/:conversationId
  // route -- covers deep links, a page refresh on that route, and the
  // browser/Android back button popping back to /connect.
  useEffect(() => {
    const id = params.conversationId;
    if (id) {
      if (id !== selectedConversation) {
        const match = conversations.find((c) => c.id === id);
        if (match) {
          setSelectedConversation(match.id);
          setSelectedConversationUser(match.otherUser || null);
        }
      }
    } else if (selectedConversation) {
      setSelectedConversation(null);
      setSelectedConversationUser(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.conversationId, conversations]);

  useEffect(() => {
    fetchConversations();
    const recents = getRecentStickers(user.id);
    setRecentStickers(recents);
    setStickerTab(recents.length > 0 ? 'recent' : 'default');
  }, [user.id]);

  useEffect(() => {
    if (selectedConversation) {
      setMessagesLoading(true);
      fetchMessages(selectedConversation).finally(() => setMessagesLoading(false));
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
          // '*' (not just INSERT) so a "delete for everyone" -- a plain UPDATE
          // flipping deleted_for_everyone -- reaches the other participant live
          // instead of only after they reopen the thread.
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as Partial<Message> | null;
          const isInsert = payload.eventType === 'INSERT';
          // Refetch the open thread on a new message, or on an UPDATE that
          // marks a message deleted-for-everyone (so the tombstone shows for
          // the other participant live). Plain is_read UPDATEs are ignored
          // here -- they carry no visible change to the message list.
          const isDeleteForEveryone =
            payload.eventType === 'UPDATE' && (payload.new as Partial<Message>)?.deleted_for_everyone === true;
          if (!isInsert && !isDeleteForEveryone) return;
          if (row?.conversation_id === selectedConversation) {
            fetchMessages(selectedConversation);
            if (isInsert && row.sender_id && row.sender_id !== user.id) {
              // Marking read keeps an incoming message from inflating the
              // unread badge while the thread is open (Part 11).
              markMessagesAsRead(selectedConversation);
            }
          }
          // Refresh the list -- updates the preview, ordering and the per-thread
          // unread pip. A full re-query, so duplicate realtime events can't
          // double-count.
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation, user.id, markMessagesAsRead]);

  // Search people with debounce -- the sidebar's "Search or start a new
  // chat" field both filters existing conversations (see filteredConversations)
  // and, once it finds no more than a couple of chars, looks up people to
  // start a brand-new 1:1 chat with (see the "Start a new chat" section in
  // renderListPanel). One search box, no separate "new message" entry point.
  useEffect(() => {
    const searchUsers = async () => {
      if (listFilter.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setSearchLoading(true);
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, display_name, full_name, email, avatar_url, profession')
          .neq('user_id', user.id)
          .or(`display_name.ilike.%${listFilter}%,full_name.ilike.%${listFilter}%,email.ilike.%${listFilter}%`)
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
  }, [listFilter, user.id]);

  const fetchFavourites = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversation_favourites')
      .select('conversation_id')
      .eq('user_id', user.id);
    if (error) {
      console.error('Error fetching favourites:', error);
      return;
    }
    setFavouriteIds(new Set((data || []).map((r) => r.conversation_id)));
  }, [user.id]);

  useEffect(() => {
    fetchFavourites();
  }, [fetchFavourites]);

  const toggleFavourite = async (conversationId: string) => {
    const isFav = favouriteIds.has(conversationId);
    // Optimistic -- this is a lightweight per-user preference, not worth a
    // round trip before the UI reacts.
    setFavouriteIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
    if (isFav) {
      const { error } = await supabase
        .from('conversation_favourites')
        .delete()
        .eq('user_id', user.id)
        .eq('conversation_id', conversationId);
      if (error) {
        console.error('Error unfavouriting conversation:', error);
        fetchFavourites();
      }
    } else {
      const { error } = await supabase
        .from('conversation_favourites')
        .insert({ user_id: user.id, conversation_id: conversationId });
      if (error) {
        console.error('Error favouriting conversation:', error);
        fetchFavourites();
      }
    }
  };

  /** Aggregates the current user's starred messages (existing per-message ⭐
   *  feature) across every conversation into one list for the 3-dot menu's
   *  "Starred" entry. */
  const fetchStarredMessages = async () => {
    setStarredLoading(true);
    try {
      const { data: starRows, error: starError } = await supabase
        .from('starred_messages')
        .select('message_id')
        .eq('user_id', user.id);
      if (starError) throw starError;

      const messageIds = (starRows || []).map((r) => r.message_id);
      if (messageIds.length === 0) {
        setStarredMessages([]);
        return;
      }

      const { data: msgRows, error: msgError } = await supabase
        .from('messages')
        .select('id, conversation_id, content, message_type, file_name, created_at, sender_id')
        .in('id', messageIds)
        .order('created_at', { ascending: false });
      if (msgError) throw msgError;

      const withProfiles = await Promise.all(
        (msgRows || []).map(async (m) => {
          const conv = conversations.find((c) => c.id === m.conversation_id);
          let otherUser = conv?.otherUser;
          if (!otherUser) {
            const otherId =
              conv && (conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1);
            if (otherId) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('id, user_id, display_name, avatar_url, profession')
                .eq('user_id', otherId)
                .maybeSingle();
              otherUser = profile || undefined;
            }
          }
          return { ...m, otherUser };
        }),
      );

      setStarredMessages(withProfiles);
    } catch (error) {
      console.error('Error fetching starred messages:', error);
      toast({ title: 'Error', description: 'Could not load starred messages.', variant: 'destructive' });
    } finally {
      setStarredLoading(false);
    }
  };

  const openStarredMessages = () => {
    setStarredSheetOpen(true);
    fetchStarredMessages();
  };

  const fetchConversations = async () => {
    try {
      // 1:1 conversations -- unchanged query/shape.
      const { data: oneToOneData, error: oneToOneError } = await supabase
        .from('conversations')
        .select('*')
        .eq('is_group', false)
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
        .order('last_message_at', { ascending: false });
      if (oneToOneError) throw oneToOneError;

      // Group conversations -- fetched separately via the membership table,
      // since groups have no participant_1/participant_2 to filter by.
      const { data: groupMemberRows, error: groupMemberError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, conversations!inner(*)')
        .eq('user_id', user.id)
        .eq('conversations.is_group', true);
      if (groupMemberError) throw groupMemberError;

      const groupConvos = (groupMemberRows || [])
        .map((row) => row.conversations)
        .filter((c): c is NonNullable<typeof c> => !!c);

      const convos = [...(oneToOneData || []), ...groupConvos].sort(
        (a, b) => new Date(b.last_message_at ?? 0).getTime() - new Date(a.last_message_at ?? 0).getTime(),
      );
      const convoIds = convos.map((c) => c.id);
      const groupIds = groupConvos.map((c) => c.id);

      // One batched query for every unread message the current user has
      // received across all their conversations -- tallied per conversation
      // so the list can show which threads are unread (and by how much).
      const unreadByConversation: Record<string, number> = {};
      if (convoIds.length > 0) {
        const { data: unreadRows } = await supabase
          .from('messages')
          .select('conversation_id')
          .in('conversation_id', convoIds)
          .eq('is_read', false)
          .neq('sender_id', user.id);
        for (const row of unreadRows || []) {
          if (!row.conversation_id) continue;
          unreadByConversation[row.conversation_id] = (unreadByConversation[row.conversation_id] || 0) + 1;
        }
      }

      // Member counts for the group rows' "N members" subtitle.
      const memberCountByConversation: Record<string, number> = {};
      if (groupIds.length > 0) {
        const { data: memberRows } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .in('conversation_id', groupIds);
        for (const row of memberRows || []) {
          memberCountByConversation[row.conversation_id] = (memberCountByConversation[row.conversation_id] || 0) + 1;
        }
      }

      // Get profiles for other participants (1:1 only) and last message
      const conversationsWithDetails = await Promise.all(
        convos.map(async (conv) => {
          // Get last message
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (conv.is_group) {
            return {
              ...conv,
              otherUser: undefined,
              lastMessage: lastMsg?.content,
              unreadCount: unreadByConversation[conv.id] || 0,
              groupMemberCount: memberCountByConversation[conv.id] || 0,
            };
          }

          const otherParticipantId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;

          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, user_id, display_name, avatar_url, profession')
            .eq('user_id', otherParticipantId!)
            .maybeSingle();

          return {
            ...conv,
            otherUser: profile || undefined,
            lastMessage: lastMsg?.content,
            unreadCount: unreadByConversation[conv.id] || 0,
          };
        })
      );

      setConversations(conversationsWithDetails);
      setLoadError(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setLoadError(true);
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
          message_type: 'text',
          reply_to_id: replyingTo?.id ?? null,
        });

      if (error) throw error;

      setNewMessage('');
      setReplyingTo(null);
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

  // ---- image messaging (Phase 3a) --------------------------------------

  const clearPendingImage = useCallback(() => {
    imageAbortRef.current?.abort();
    imageAbortRef.current = null;
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setImageCaption('');
    setImageUpload({ progress: 0, status: 'idle' });
  }, []);

  const handleImageFileSelected = (file: File) => {
    if (!selectedConversation) return;
    const validationError = validateMessageAttachment(file, 'image');
    if (validationError) {
      toast({ title: 'Unsupported image', description: validationError, variant: 'destructive' });
      return;
    }
    // Drop any image already staged (and cancel its upload).
    clearPendingImage();
    setPendingImage({ file, previewUrl: URL.createObjectURL(file) });
    setImageCaption('');
    setImageUpload({ progress: 0, status: 'idle' });
  };

  const sendImage = async () => {
    if (!pendingImage || !selectedConversation || imageUpload.status === 'uploading') return;

    const controller = new AbortController();
    imageAbortRef.current = controller;
    setImageUpload({ progress: 0, status: 'uploading' });

    try {
      const { path } = await uploadMessageAttachment({
        conversationId: selectedConversation,
        userId: user.id,
        file: pendingImage.file,
        kind: 'image',
        onProgress: (f) => setImageUpload({ progress: f, status: 'uploading' }),
        signal: controller.signal,
      });

      const { error } = await supabase.from('messages').insert({
        conversation_id: selectedConversation,
        sender_id: user.id,
        content: imageCaption.trim() || pendingImage.file.name,
        message_type: 'image',
        file_url: path,
        file_name: pendingImage.file.name,
        mime_type: pendingImage.file.type,
        file_size: pendingImage.file.size,
        reply_to_id: replyingTo?.id ?? null,
      });
      if (error) throw error;

      URL.revokeObjectURL(pendingImage.previewUrl);
      setPendingImage(null);
      setImageCaption('');
      setImageUpload({ progress: 0, status: 'idle' });
      setReplyingTo(null);
    } catch (err) {
      if (err instanceof UploadAbortError) {
        // user cancelled -- clearPendingImage already reset everything
        return;
      }
      console.error('Error sending image:', err);
      setImageUpload({ progress: 0, status: 'error' });
      toast({
        title: 'Could not send image',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      imageAbortRef.current = null;
    }
  };

  // Revoke the preview object URL if the component unmounts mid-compose.
  useEffect(() => {
    return () => {
      imageAbortRef.current?.abort();
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
    };
  }, []);

  // Switching conversations drops any half-composed image with it.
  useEffect(() => {
    clearPendingImage();
  }, [selectedConversation, clearPendingImage]);

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

  // ---- WhatsApp-style message action handlers --------------------------------

  /** Resolve a fresh signed URL for a message's attachment. */
  const getAttachmentUrl = (message: Message): Promise<string | null> =>
    getMessageAttachmentUrl(message.id);

  const handleCopyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      toast({ title: 'Message copied' });
    } catch {
      toast({ title: 'Could not copy', variant: 'destructive' });
    }
  };

  const handleSaveAttachment = async (message: Message) => {
    setSavingAttachmentId(message.id);
    try {
      const url = await getAttachmentUrl(message);
      if (!url) {
        toast({ title: 'Error', description: "Couldn't fetch this file.", variant: 'destructive' });
        return;
      }
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = message.file_name || 'attachment';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
      } catch {
        // cross-origin / blocked fetch -> fall back to opening in a new tab
        window.open(url, '_blank', 'noopener');
      }
    } finally {
      setSavingAttachmentId(null);
    }
  };

  const handleShareMessage = async (message: Message) => {
    const isFile = message.message_type === 'file' || message.message_type === 'image';
    let url: string | undefined;
    if (isFile) url = (await getAttachmentUrl(message)) || undefined;
    const shareData: ShareData = {
      title: isFile ? (message.file_name || 'Shared file') : 'Message',
      text: isFile ? undefined : message.content,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled -- not an error */
      }
      return;
    }
    // fallback: copy whatever is shareable
    try {
      await navigator.clipboard.writeText(url || message.content);
      toast({ title: 'Copied to clipboard' });
    } catch {
      toast({ title: 'Sharing not supported here', variant: 'destructive' });
    }
  };

  /** "Delete for everyone" for the sender's own messages -- soft delete, keeps the row. */
  const deleteForEveryone = async (ids: string[]) => {
    const own = ids.filter((id) => {
      const m = messages.find((x) => x.id === id);
      return m && m.sender_id === user.id && !m.deleted_for_everyone;
    });
    if (own.length === 0) return;
    setMessages((prev) => prev.map((m) => (own.includes(m.id) ? { ...m, deleted_for_everyone: true } : m)));
    const { error } = await supabase
      .from('messages')
      .update({ deleted_for_everyone: true })
      .in('id', own)
      .eq('sender_id', user.id);
    if (error) {
      toast({ title: 'Could not delete message', variant: 'destructive' });
      fetchMessages(selectedConversation!);
    }
  };

  /** Single-message delete dialog confirm -> "Delete for everyone". */
  const handleDeleteForEveryone = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteForEveryone([id]);
  };

  /** Single-message delete dialog confirm -> "Delete for me". */
  const handleDeleteForMe = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await deleteForMe([id]);
  };

  // ---- bulk selection actions ----------------------------------------------
  const selectedMessages = visibleMessages.filter((m) => selectedIds.has(m.id));
  const allSelectedOwnedAndLive =
    selectedMessages.length > 0 &&
    selectedMessages.every((m) => m.sender_id === user.id && !m.deleted_for_everyone);
  const anySelectedForwardable = selectedMessages.some((m) => !m.deleted_for_everyone);

  const handleBulkForward = () => {
    const forwardable = selectedMessages.filter((m) => !m.deleted_for_everyone);
    if (forwardable.length === 0) {
      toast({ title: 'Nothing to forward', description: 'Deleted messages can’t be forwarded.' });
      return;
    }
    setForwardTargets(forwardable);
  };

  const handleBulkStar = async () => {
    const ids = selectedMessages.filter((m) => !m.deleted_for_everyone).map((m) => m.id);
    if (ids.length === 0) return;
    await bulkStar(ids);
    toast({ title: `${ids.length} ${ids.length === 1 ? 'message' : 'messages'} starred` });
    exitSelection();
  };

  const handleBulkPin = async (pin: boolean) => {
    const ids = selectedMessages.filter((m) => !m.deleted_for_everyone).map((m) => m.id);
    if (ids.length === 0) return;
    await bulkPin(ids, pin);
    exitSelection();
  };

  const handleBulkUnstar = async () => {
    const ids = selectedMessages.filter((m) => starredIds.has(m.id)).map((m) => m.id);
    if (ids.length === 0) {
      exitSelection();
      return;
    }
    for (const id of ids) await toggleStar(id);
    toast({ title: `${ids.length} ${ids.length === 1 ? 'message' : 'messages'} unstarred` });
    exitSelection();
  };

  const handleBulkDeleteForMe = async () => {
    const ids = selectedMessages.map((m) => m.id);
    setBulkDeleteOpen(false);
    await deleteForMe(ids);
    toast({ title: `${ids.length} ${ids.length === 1 ? 'message' : 'messages'} deleted for you` });
    exitSelection();
  };

  const handleBulkDeleteForEveryone = async () => {
    const ids = selectedMessages.map((m) => m.id);
    setBulkDeleteOpen(false);
    await deleteForEveryone(ids);
    toast({ title: `${ids.length} ${ids.length === 1 ? 'message' : 'messages'} deleted` });
    exitSelection();
  };

  const scrollToMessage = (id: string) => {
    const el = messageRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(id);
    setTimeout(() => setHighlightId((cur) => (cur === id ? null : cur)), 1800);
  };

  const messagePreview = (m: Message): string => {
    if (m.message_type === 'sticker') return 'Sticker';
    if (m.message_type === 'image') return 'Photo';
    if (m.message_type === 'file') return m.file_name || 'Attachment';
    return m.content;
  };

  const renderMessage = (message: Message) => {
    const isOwn = message.sender_id === user.id;
    const isDeleted = !!message.deleted_for_everyone;
    const isSticker = message.message_type === 'sticker';
    const isImage = message.message_type === 'image';
    const isDocument = message.message_type === 'file';
    const isAttachment = isImage || isDocument || isSticker;
    const reactionRows = reactionsByMessage.get(message.id) ?? [];
    const myReaction = reactionRows.find((r) => r.user_id === user.id)?.emoji;
    const grouped = Object.values(
      reactionRows.reduce<Record<string, { emoji: string; count: number; mine: boolean }>>((acc, r) => {
        acc[r.emoji] ??= { emoji: r.emoji, count: 0, mine: false };
        acc[r.emoji].count += 1;
        if (r.user_id === user.id) acc[r.emoji].mine = true;
        return acc;
      }, {}),
    );
    const isStarred = starredIds.has(message.id);
    const isPinned = pinnedIds.has(message.id);
    const repliedTo = message.reply_to_id ? messages.find((m) => m.id === message.reply_to_id) : null;
    const highlighted = highlightId === message.id;
    const isSelected = selectedIds.has(message.id);

    return (
      <div
        key={message.id}
        ref={(el) => { messageRefs.current[message.id] = el; }}
        // In selection mode a click anywhere on the row toggles selection.
        // onClickCapture intercepts before inner controls (attachment open,
        // reply-quote jump) so nothing navigates or opens by accident.
        onClickCapture={
          selectionMode
            ? (e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleSelected(message.id);
              }
            : undefined
        }
        className={cn(
          'flex scroll-mt-6 rounded-lg transition-colors',
          isOwn ? 'justify-end' : 'justify-start',
          // pl-9 only shifts content horizontally -- no vertical reflow, so
          // entering selection mode can't jump the scroll position.
          selectionMode && 'relative cursor-pointer select-none pl-9',
          selectionMode && isSelected && 'bg-primary/10 ring-1 ring-inset ring-primary/25',
        )}
      >
        {selectionMode && (
          <span
            aria-hidden
            className={cn(
              'absolute left-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full border transition-colors',
              isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background',
            )}
          >
            {isSelected && <Check className="h-3.5 w-3.5" />}
          </span>
        )}
        <div className={cn('group relative flex min-w-0 max-w-[80%] items-end gap-1.5', isOwn && 'flex-row-reverse')}>
          {!isOwn && (
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={message.senderProfile?.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {message.senderProfile?.display_name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          )}

          <div className={cn('flex min-w-0 flex-col', isOwn ? 'items-end' : 'items-start')}>
            {repliedTo && !isDeleted && (
              <button
                type="button"
                onClick={() => scrollToMessage(repliedTo.id)}
                className="mb-1 flex max-w-full items-center gap-1 rounded-lg border-l-2 border-primary bg-muted/70 px-2 py-1 text-left text-[11px]"
              >
                <ReplyIcon className="h-3 w-3 shrink-0 text-primary" />
                <span className="font-semibold text-primary">
                  {repliedTo.sender_id === user.id ? 'You' : repliedTo.senderProfile?.display_name || 'Them'}
                </span>
                <span className="truncate text-muted-foreground">{messagePreview(repliedTo)}</span>
              </button>
            )}

            {message.is_forwarded && !isDeleted && (
              <span className="mb-0.5 flex items-center gap-1 text-[11px] italic text-muted-foreground">
                <CornerUpRight className="h-3 w-3" /> Forwarded
              </span>
            )}

            <div
              className={cn(
                'relative rounded-2xl transition-shadow',
                highlighted && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
              )}
            >
              {(isPinned || isStarred) && !isDeleted && (
                <span
                  className={cn(
                    'absolute -top-2 z-10 flex items-center gap-0.5 rounded-full bg-background px-1 py-0.5 shadow-sm',
                    isOwn ? '-left-2' : '-right-2',
                  )}
                >
                  {isPinned && <Pin className="h-3 w-3 text-primary" />}
                  {isStarred && <Star className="h-3 w-3 fill-warning text-warning" />}
                </span>
              )}

              {isDeleted ? (
                <div className="flex items-center gap-1.5 rounded-2xl bg-muted px-4 py-2 text-sm italic text-muted-foreground">
                  <X className="h-3.5 w-3.5" /> This message was deleted
                </div>
              ) : isSticker ? (
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
              ) : isImage ? (
                <div className={cn('overflow-hidden rounded-2xl p-1', isOwn ? 'bg-primary' : 'bg-muted')}>
                  <MessageImage
                    messageId={message.id}
                    alt={message.file_name || 'Photo'}
                    isOwn={isOwn}
                    onZoom={(url) => setLightbox({ url, alt: message.file_name || 'Photo' })}
                  />
                  {message.content && message.content !== message.file_name && (
                    <div
                      className={cn(
                        'whitespace-pre-wrap break-words px-2 pt-1.5 text-sm',
                        isOwn ? 'text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {message.content}
                    </div>
                  )}
                  <div
                    className={cn(
                      'px-2 pb-0.5 pt-1 text-xs',
                      isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground',
                    )}
                  >
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </div>
                </div>
              ) : isDocument ? (
                <div className={cn('w-[min(75vw,320px)] rounded-2xl p-3', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      aria-label={`Open ${message.file_name || 'document'}`}
                      disabled={openingAttachmentId === message.id || savingAttachmentId === message.id}
                      onClick={() => handleOpenAttachment(message)}
                    >
                      {openingAttachmentId === message.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className={cn('text-xs mt-1.5', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </div>
                </div>
              ) : (
                <div className={cn('rounded-2xl px-4 py-2', isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
                  <div className="text-sm break-words whitespace-pre-wrap">{message.content}</div>
                  <div className={cn('text-xs mt-1', isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                  </div>
                </div>
              )}
            </div>

            {grouped.length > 0 && !isDeleted && (
              <div className={cn('mt-1 flex flex-wrap gap-1', isOwn && 'justify-end')}>
                {grouped.map((g) => (
                  <button
                    key={g.emoji}
                    type="button"
                    onClick={() => toggleReaction(message.id, g.emoji)}
                    className={cn(
                      'flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                      g.mine ? 'border-primary/50 bg-primary/10' : 'border-border bg-background hover:bg-accent',
                    )}
                  >
                    <span>{g.emoji}</span>
                    {g.count > 1 && <span className="tabular-nums text-[10px] text-muted-foreground">{g.count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kept mounted in selection mode (just hidden) so the Radix menu
              portal never unmounts mid-close -- that was the old ghost-menu
              crash. Its own onSelect already closes it before selection mode
              flips on. */}
          <div className={cn('self-center', selectionMode && 'hidden')}>
            <MessageActionsMenu
                message={{
                  id: message.id,
                  message_type: message.message_type,
                  content: message.content,
                  file_name: message.file_name ?? null,
                  mime_type: message.mime_type ?? null,
                }}
                isOwn={isOwn}
                isDeleted={isDeleted}
                isStarred={isStarred}
                isPinned={isPinned}
                myReaction={myReaction}
                onReact={(e) => toggleReaction(message.id, e)}
                onReply={() => setReplyingTo(message)}
                onCopy={isDeleted || isAttachment ? undefined : () => handleCopyMessage(message)}
                onForward={isDeleted ? undefined : () => setForwardTargets([message])}
                onPin={() => togglePin(message.id)}
                onStar={() => toggleStar(message.id)}
                onSelect={() => enterSelection(message.id)}
                onInfo={() => setInfoMessage(message)}
                onSaveAs={!isDeleted && isAttachment ? () => handleSaveAttachment(message) : undefined}
                onShare={isDeleted ? undefined : () => handleShareMessage(message)}
                onOpenWith={
                  !isDeleted && message.message_type === 'file'
                    ? () => handleOpenAttachment(message)
                    : undefined
                }
                // Received / already-deleted: only "Delete for me". Own & live:
                // one "Delete for everyone" entry -> a dialog that still offers
                // "Delete for me" as the softer choice.
                onDeleteForMe={!isOwn || isDeleted ? () => setDeleteTarget(message) : undefined}
                onDeleteForEveryone={isOwn && !isDeleted ? () => setDeleteTarget(message) : undefined}
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </MessageActionsMenu>
            </div>
        </div>
      </div>
    );
  };

  const renderMessagesWithSeparators = () => {
    const nodes: JSX.Element[] = [];
    let lastDateKey: string | null = null;
    for (const message of visibleMessages) {
      const dateKey = new Date(message.created_at).toDateString();
      if (dateKey !== lastDateKey) {
        lastDateKey = dateKey;
        nodes.push(
          <div key={`sep-${dateKey}`} className="flex items-center justify-center py-1">
            <span className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground">
              {formatDateSeparator(message.created_at)}
            </span>
          </div>,
        );
      }
      nodes.push(renderMessage(message));
    }
    return nodes;
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
        setListFilter('');
        navigate(`/connect/${existingConv.id}`);
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
      setListFilter('');
      fetchConversations();
      navigate(`/connect/${newConv.id}`);

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
    // Always route-driven (not just on mobile) -- Connect.tsx decides whether
    // to render its own hero/tabs/list chrome purely from the
    // :conversationId route param, so the URL must change on every viewport
    // size or that chrome and this chat workspace would render at once.
    navigate(`/connect/${conversation.id}`);
  };

  const handleBack = useCallback(() => {
    navigate('/connect');
    setSelectedConversation(null);
    setSelectedConversationUser(null);
  }, [navigate]);

  const filteredConversations = conversations.filter((c) => {
    if (activeTab === 'unread' && c.unreadCount === 0) return false;
    if (activeTab === 'favourites' && !favouriteIds.has(c.id)) return false;
    if (activeTab === 'groups' && !c.is_group) return false;
    if (listFilter.trim()) {
      const q = listFilter.trim().toLowerCase();
      const name = (c.is_group ? c.group_name : c.otherUser?.display_name)?.toLowerCase() || '';
      const last = c.lastMessage?.toLowerCase() || '';
      if (!name.includes(q) && !last.includes(q)) return false;
    }
    return true;
  });
  const favouritesCount = conversations.filter((c) => favouriteIds.has(c.id)).length;
  // Below ~2 chars the search box just filters the list above; at 2+ chars it
  // also offers to start a brand-new 1:1 chat with someone not in the list
  // yet -- the one and only "start a new chat" entry point (see header).
  const showPeopleSearch = listFilter.trim().length >= 2;
  const peopleSearchResults = searchResults.filter(
    (p) => !conversations.some((c) => !c.is_group && c.otherUser?.user_id === p.user_id),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Mounted regardless of which panel below is showing.
  const dialogs = (
    <>
      <CreateGroupDialog
        open={createGroupOpen}
        onOpenChange={setCreateGroupOpen}
        currentUserId={user.id}
        onCreated={(conversationId) => {
          setSelectedConversation(conversationId);
          setSelectedConversationUser(null);
          fetchConversations();
          navigate(`/connect/${conversationId}`);
        }}
      />

      <MessageInfoDialog
        open={!!infoMessage}
        onOpenChange={(o) => !o && setInfoMessage(null)}
        message={infoMessage}
        isOwn={infoMessage?.sender_id === user.id}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget.sender_id === user.id && !deleteTarget.deleted_for_everyone
                ? '“Delete for everyone” removes it from the conversation for both of you. “Delete for me” just hides it on this account.'
                : 'This hides the message on your account only. Other people in the chat still see it.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteForMe}>Delete for me</AlertDialogAction>
            {deleteTarget && deleteTarget.sender_id === user.id && !deleteTarget.deleted_for_everyone && (
              <AlertDialogAction
                onClick={handleDeleteForEveryone}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete for everyone
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'message' : 'messages'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {allSelectedOwnedAndLive
                ? '“Delete for everyone” removes them from the conversation for both of you. “Delete for me” just hides them on this account.'
                : 'Some of these were sent by the other person or are already deleted, so they can only be hidden on your account.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDeleteForMe}>Delete for me</AlertDialogAction>
            {allSelectedOwnedAndLive && (
              <AlertDialogAction
                onClick={handleBulkDeleteForEveryone}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete for everyone
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ForwardMessageDialog
        open={!!forwardTargets}
        onOpenChange={(o) => !o && setForwardTargets(null)}
        messages={(forwardTargets ?? []).map<ForwardableMessage>((m) => ({
          id: m.id,
          content: m.content,
          message_type: m.message_type,
          file_url: m.file_url ?? null,
          file_name: m.file_name ?? null,
          mime_type: m.mime_type ?? null,
          file_size: m.file_size ?? null,
        }))}
        currentUserId={user.id}
        conversations={conversations.map((c) => ({
          id: c.id,
          otherUser: c.otherUser,
          lastMessage: c.lastMessage,
        }))}
        onForwarded={() => {
          setForwardTargets(null);
          exitSelection();
          fetchConversations();
        }}
      />

      {lightbox && (
        <PhotoLightbox
          photos={[{ url: lightbox.url, alt: lightbox.alt }]}
          index={0}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );

  // No active conversation -- just the list. Connect.tsx keeps its own
  // hero/tabs chrome visible above this in this state.
  const filterPills: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread', count: conversations.filter((c) => c.unreadCount > 0).length },
    { key: 'favourites', label: 'Favourites', count: favouritesCount },
    { key: 'groups', label: 'Groups' },
  ];

  const renderListPanel = () => (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex-shrink-0 border-b px-3 py-3 lg:px-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{isMobile ? 'Chats' : 'Messages'}</h2>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 lg:h-8 lg:w-8" aria-label="More options">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => handleNotImplemented('New community')}>
                  <Building2 className="mr-2 h-4 w-4" /> New community
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={openStarredMessages}>
                  <Star className="mr-2 h-4 w-4" /> Starred
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="default"
              size="icon"
              className="h-9 w-9 rounded-full lg:h-8 lg:w-8"
              aria-label="Create new group"
              onClick={() => setCreateGroupOpen(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {conversations.length > 0 && (
          <>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="conversation-list-search"
                value={listFilter}
                onChange={(e) => setListFilter(e.target.value)}
                placeholder="Search or start a new chat"
                aria-label="Search conversations"
                className="h-9 pl-8"
              />
            </div>
            <div className="mt-2 flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {filterPills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setActiveTab(pill.key)}
                  className={cn(
                    'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                    activeTab === pill.key
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  {pill.label}
                  {!!pill.count && <span className="ml-1 tabular-nums">{pill.count}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {loadError && conversations.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Couldn&apos;t load your messages</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Check your connection and try again.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setLoading(true);
                  fetchConversations();
                }}
              >
                Retry
              </Button>
            </div>
          ) : conversations.length === 0 && !showPeopleSearch ? (
            <EmptyState
              size="compact"
              illustration={noMessageImage}
              illustrationAlt="No messages illustration"
              title="No messages yet"
              description="Reach out and start a conversation to advance your career"
              action={
                <Button onClick={() => document.getElementById('conversation-list-search')?.focus()}>
                  Send a message
                </Button>
              }
            />
          ) : (
            <div className="lg:px-2">
              {showPeopleSearch && (
                <div className="pb-2">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:px-2">
                    Start a new chat
                  </p>
                  {searchLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : peopleSearchResults.length === 0 ? (
                    <p className="px-4 pb-2 text-xs text-muted-foreground">No people found.</p>
                  ) : (
                    peopleSearchResults.map((profile) => (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => startNewConversation(profile)}
                        className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left transition-colors hover:bg-muted/50 lg:px-3"
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarImage src={profile.avatar_url || undefined} />
                          <AvatarFallback>{profile.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {profile.display_name || profile.full_name || 'Unknown User'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {profile.profession || profile.email || ''}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                  {filteredConversations.length > 0 && (
                    <p className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:px-2">
                      Conversations
                    </p>
                  )}
                </div>
              )}

              {activeTab === 'groups' && filteredConversations.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">No group conversations yet</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Tap + above to create one.</p>
                </div>
              ) : filteredConversations.length === 0 && !showPeopleSearch ? (
                <div className="px-4 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">No conversations match</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Try a different search or filter.</p>
                </div>
              ) : (
              filteredConversations.map((conversation) => {
                const isUnread = conversation.unreadCount > 0;
                const isFav = favouriteIds.has(conversation.id);
                const isSelected = selectedConversation === conversation.id;
                const displayName = conversation.is_group
                  ? conversation.group_name || 'Group'
                  : conversation.otherUser?.display_name || 'Unknown User';
                return (
                  <div
                    key={conversation.id}
                    role="button"
                    tabIndex={0}
                    aria-current={isSelected ? 'true' : undefined}
                    aria-label={
                      isUnread
                        ? `${displayName}, ${conversation.unreadCount} unread`
                        : displayName
                    }
                    className={cn(
                      'group flex w-full cursor-pointer items-start gap-3 border-b border-border px-1 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 lg:rounded-lg lg:border-b-0 lg:px-3',
                      isSelected && 'bg-primary/10 hover:bg-primary/10',
                    )}
                    onClick={() => handleSelectConversation(conversation)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectConversation(conversation);
                      }
                    }}
                  >
                    <Avatar className="h-11 w-11 shrink-0">
                      {conversation.is_group ? (
                        <AvatarImage src={conversation.group_avatar_url || undefined} />
                      ) : (
                        <AvatarImage src={conversation.otherUser?.avatar_url || undefined} />
                      )}
                      <AvatarFallback>
                        {conversation.is_group ? (
                          <Users2 className="h-5 w-5" />
                        ) : (
                          conversation.otherUser?.display_name?.[0]?.toUpperCase() || 'U'
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className={cn(
                            'min-w-0 truncate text-sm',
                            isUnread ? 'font-bold text-foreground' : 'font-medium',
                          )}
                        >
                          {displayName}
                        </span>
                        <span
                          className={cn(
                            'shrink-0 text-[11px]',
                            isUnread ? 'font-medium text-primary' : 'text-muted-foreground',
                          )}
                        >
                          {formatDistanceToNow(new Date(conversation.last_message_at), { addSuffix: true })}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={cn(
                            'min-w-0 flex-1 truncate text-xs',
                            isUnread ? 'font-medium text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {conversation.is_group && conversation.groupMemberCount
                            ? `${conversation.groupMemberCount} members · ${conversation.lastMessage || 'No messages yet'}`
                            : conversation.lastMessage || 'No messages yet'}
                        </p>
                        {isUnread && (
                          <span
                            className="grid h-4 min-w-[16px] shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
                            aria-hidden="true"
                          >
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavourite(conversation.id);
                      }}
                      className={cn(
                        'shrink-0 self-center rounded-full p-1.5 transition-colors',
                        isFav ? 'opacity-100' : 'opacity-60 hover:opacity-100 focus-visible:opacity-100',
                      )}
                    >
                      <Star className={cn('h-4 w-4', isFav ? 'fill-warning text-warning' : 'text-muted-foreground')} />
                    </button>
                  </div>
                );
              })
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );

  const starredMessagesSheet = (
    <Sheet open={starredSheetOpen} onOpenChange={setStarredSheetOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Starred messages</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-6rem)]">
          {starredLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : starredMessages.length === 0 ? (
            <div className="px-2 py-10 text-center">
              <Star className="mx-auto mb-2 h-8 w-8 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground">No starred messages</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Star a message from its menu to find it here later.
              </p>
            </div>
          ) : (
            <div className="space-y-1 pr-2">
              {starredMessages.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-muted/50"
                  onClick={() => {
                    setStarredSheetOpen(false);
                    handleSelectConversation({
                      id: m.conversation_id,
                      participant_1: '',
                      participant_2: '',
                      last_message_at: '',
                      updated_at: '',
                      otherUser: m.otherUser,
                      unreadCount: 0,
                    });
                    setTimeout(() => scrollToMessage(m.id), 400);
                  }}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarImage src={m.otherUser?.avatar_url || undefined} />
                    <AvatarFallback>{m.otherUser?.display_name?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{m.otherUser?.display_name || 'Unknown'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {m.message_type === 'image' ? 'Photo' : m.message_type === 'file' ? m.file_name || 'Attachment' : m.content}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );

  if (!selectedConversation && isMobile) {
    return (
      <>
        <div
          className={cn(
            'flex min-w-0 flex-col border-0 bg-transparent shadow-none',
            conversations.length > 0
              ? 'h-[calc(var(--app-vvh,100dvh)-3.5rem-4.5rem)] min-h-[16rem]'
              : 'h-auto',
          )}
        >
          {renderListPanel()}
        </div>
        {dialogs}
        {starredMessagesSheet}
      </>
    );
  }

  if (!isMobile) {
    // Desktop: always the two-column workspace -- chat on the left, the
    // conversation list on the right (deliberately mirrored from the
    // typical list-left layout) -- filling everything below the fixed top
    // navbar. No separate "select a conversation" full-page state.
    return (
      <>
        <div
          className="fixed inset-x-0 bottom-0 z-40 flex min-w-0 bg-background"
          style={{ top: 'var(--nav-height)' }}
        >
          <div className="flex min-w-0 flex-1 flex-col border-r">
            {selectedConversation ? (
              renderChatPanel()
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
                <MessageSquareText className="mb-3 h-12 w-12 opacity-40" />
                <p className="text-sm font-medium text-foreground">Select a conversation</p>
                <p className="mt-1 text-xs">Choose from your conversations on the right, or start a new chat</p>
              </div>
            )}
          </div>
          <div className="w-[360px] shrink-0">{renderListPanel()}</div>
        </div>
        {dialogs}
        {starredMessagesSheet}
      </>
    );
  }

  // The open conversation's header + messages + composer. Used both as the
  // mobile full-screen page's content and as the desktop two-column
  // layout's left panel -- see the two early `return`s above for how each
  // context wraps/positions it.
  function renderChatPanel() {
    const activeConversation = conversations.find((c) => c.id === selectedConversation);
    const isGroupChat = !!activeConversation?.is_group;
    const chatHeaderName = isGroupChat
      ? activeConversation?.group_name || 'Group'
      : selectedConversationUser?.display_name || 'Chat';
    const chatHeaderSubtitle = isGroupChat
      ? `${activeConversation?.groupMemberCount || 0} members`
      : selectedConversationUser?.profession;

    return (
      <div className="flex h-full min-w-0 flex-col bg-background">
        <div
          className={cn('flex-shrink-0 border-b px-3 pb-3', !mobileFullScreen && 'lg:px-6')}
          style={{ paddingTop: mobileFullScreen ? 'max(0.75rem, env(safe-area-inset-top))' : '0.75rem' }}
        >
              {selectionMode ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-2 h-9 w-9 shrink-0"
                    onClick={exitSelection}
                    aria-label="Cancel selection"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                  <span className="min-w-0 flex-1 truncate text-base font-semibold">
                    {selectedIds.size} selected
                  </span>
                  {selectedIds.size > 0 && anySelectedForwardable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleBulkForward}
                      aria-label="Forward selected"
                    >
                      <CornerUpRight className="h-5 w-5" />
                    </Button>
                  )}
                  {selectedIds.size > 0 && anySelectedForwardable && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={handleBulkStar}
                      aria-label="Star selected"
                    >
                      <Star className="h-5 w-5" />
                    </Button>
                  )}
                  {selectedIds.size > 0 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => setBulkDeleteOpen(true)}
                      aria-label="Delete selected"
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  )}
                  {selectedIds.size > 0 && anySelectedForwardable && (
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="More actions">
                          <MoreVertical className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="data-[state=closed]:!animate-none">
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleBulkPin(true); }}>
                          <Pin className="mr-2 h-4 w-4" /> Pin
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleBulkPin(false); }}>
                          <PinOff className="mr-2 h-4 w-4" /> Unpin
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleBulkUnstar(); }}>
                          <StarOff className="mr-2 h-4 w-4" /> Unstar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="-ml-2 h-11 w-11 shrink-0 lg:hidden"
                    onClick={handleBack}
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Avatar className="h-10 w-10 shrink-0">
                    {isGroupChat ? (
                      <AvatarImage src={activeConversation?.group_avatar_url || undefined} />
                    ) : (
                      <AvatarImage src={selectedConversationUser?.avatar_url || undefined} />
                    )}
                    <AvatarFallback>
                      {isGroupChat ? (
                        <Users2 className="h-4 w-4" />
                      ) : (
                        selectedConversationUser?.display_name?.[0]?.toUpperCase() || 'U'
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{chatHeaderName}</h2>
                    {chatHeaderSubtitle && (
                      <p className="truncate text-xs text-muted-foreground">{chatHeaderSubtitle}</p>
                    )}
                  </div>
                </div>
              )}
        </div>
        <div className="flex flex-1 flex-col overflow-hidden">
              {pins.length > 0 && (() => {
                const latest = visibleMessages.find((m) => m.id === pins[0].message_id);
                if (!latest) return null;
                return (
                  <button
                    type="button"
                    onClick={() => scrollToMessage(latest.id)}
                    className="flex w-full items-center gap-2 border-b bg-muted/40 px-4 py-2 text-left text-xs"
                  >
                    <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="font-medium text-foreground">Pinned</span>
                    <span className="truncate text-muted-foreground">{messagePreview(latest)}</span>
                    {pins.length > 1 && (
                      <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                        {pins.length}
                      </span>
                    )}
                  </button>
                );
              })()}
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {messagesLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : visibleMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <p className="text-sm font-medium">
                        {isGroupChat ? `Say hello to ${chatHeaderName}` : `Start a conversation with ${chatHeaderName}`}
                      </p>
                      <p className="text-xs mt-1">Send a message to start chatting.</p>
                    </div>
                  ) : (
                    renderMessagesWithSeparators()
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Message Input */}
              <div
                className={cn(
                  'p-4 border-t flex-shrink-0',
                  mobileFullScreen && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
                )}
              >
                {replyingTo && (
                  <div className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-primary bg-muted/60 px-3 py-2">
                    <ReplyIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-primary">
                        Replying to {replyingTo.sender_id === user.id ? 'yourself' : replyingTo.senderProfile?.display_name || 'them'}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{messagePreview(replyingTo)}</p>
                    </div>
                    <button
                      type="button"
                      aria-label="Cancel reply"
                      onClick={() => setReplyingTo(null)}
                      className="rounded-full p-0.5 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {uploadingDocument && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Uploading document…
                  </div>
                )}
                {pendingImage && (
                  <div className="mb-2 rounded-lg border bg-muted/50 p-2">
                    <div className="flex items-start gap-2.5">
                      <img
                        src={pendingImage.previewUrl}
                        alt="Selected"
                        className="h-16 w-16 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">{pendingImage.file.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatFileSize(pendingImage.file.size)}
                        </p>
                        <Input
                          value={imageCaption}
                          onChange={(e) => setImageCaption(e.target.value)}
                          placeholder="Add a caption…"
                          aria-label="Image caption"
                          disabled={imageUpload.status === 'uploading'}
                          className="mt-1.5 h-8 text-sm"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              void sendImage();
                            }
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        aria-label="Discard image"
                        onClick={clearPendingImage}
                        className="rounded-full p-1 text-muted-foreground hover:bg-accent"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {imageUpload.status === 'uploading' && (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-150"
                            style={{ width: `${Math.round(imageUpload.progress * 100)}%` }}
                          />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">
                          {Math.round(imageUpload.progress * 100)}%
                        </span>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearPendingImage}>
                          Cancel
                        </Button>
                      </div>
                    )}

                    {imageUpload.status !== 'uploading' && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {imageUpload.status === 'error' && (
                          <span className="mr-auto text-[11px] text-destructive">Upload failed.</span>
                        )}
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={clearPendingImage}>
                          Cancel
                        </Button>
                        <Button size="sm" className="h-7 px-3 text-xs" onClick={() => void sendImage()}>
                          {imageUpload.status === 'error' ? 'Retry' : 'Send'}
                        </Button>
                      </div>
                    )}
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
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFileSelected(file);
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageFileSelected(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="relative" ref={attachAreaRef}>
                    <DropdownMenu modal={false} open={attachMenuOpen} onOpenChange={setAttachMenuOpen}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="icon"
                          disabled={sendingMessage || uploadingDocument}
                          aria-label="Attach file"
                          title="Attach"
                          className="h-11 w-11 touch-manipulation"
                        >
                          <Paperclip className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      {/* modal={false} + data-[state=closed]:!animate-none: a modal
                          DropdownMenu traps focus and scroll-locks the body via
                          react-remove-scroll. Document/Photo/Camera below open a
                          native OS picker synchronously on select, which steals
                          focus the same way a nested Dialog does -- that orphans
                          the close animation's animationend under the modal's own
                          teardown and leaves the body permanently scroll-locked
                          (every later tap, including this same button, then does
                          nothing). Same fix already applied to the per-message
                          and bulk-actions dropdowns in this file. */}
                      <DropdownMenuContent align="start" className="data-[state=closed]:!animate-none">
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            documentInputRef.current?.click();
                            setAttachMenuOpen(false);
                          }}
                        >
                          <FileText className="h-4 w-4 mr-2" />
                          Document
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            imageInputRef.current?.click();
                            setAttachMenuOpen(false);
                          }}
                        >
                          <Image className="h-4 w-4 mr-2" />
                          Photo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(event) => {
                            event.preventDefault();
                            cameraInputRef.current?.click();
                            setAttachMenuOpen(false);
                          }}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          Camera
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handleNotImplemented('Video')}>
                          <Image className="h-4 w-4 mr-2" />
                          Video
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
                        className="absolute bottom-full left-0 mb-2 w-[min(300px,calc(100vw-2rem))] rounded-md border bg-popover text-popover-foreground shadow-md z-50"
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
                  <Textarea
                    ref={composerRef}
                    placeholder="Type a message..."
                    aria-label="Message"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    disabled={sendingMessage}
                    rows={1}
                    className="flex-1 min-h-[40px] max-h-[120px] resize-none py-2.5 leading-5"
                  />
                  <Button
                    onClick={sendMessage}
                    disabled={sendingMessage || !newMessage.trim()}
                    size="icon"
                    className="shrink-0"
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
            </div>
          </div>
    );
  }

  // Reached only when isMobile && selectedConversation (both earlier
  // branches -- desktop, and mobile-with-no-selection -- already returned).
  // A true full-screen page: fixed inset-0 bypasses the global nav entirely
  // and hides BottomNavigation (see useLockFullscreenOverlay above).
  return (
    <>
      <div
        className="fixed inset-x-0 top-0 z-[60] flex min-w-0 flex-col bg-background"
        // `dvh`/native fixed-viewport sizing tracks retractable browser chrome
        // but not the on-screen keyboard on Android (see useViewportSizeVar) --
        // without this, `inset-0` can stay taller than what's actually visible
        // while the keyboard is open, sinking the composer (and its Attach
        // button) partly behind the keyboard/gesture-nav area until a later
        // reflow catches up. Pinning height to the live visual viewport keeps
        // the composer flush with the real visible bottom edge at all times.
        style={{ height: 'var(--app-vvh, 100dvh)' }}
      >
        {renderChatPanel()}
      </div>
      {dialogs}
      {starredMessagesSheet}
    </>
  );
};

export default ChatInterface;
