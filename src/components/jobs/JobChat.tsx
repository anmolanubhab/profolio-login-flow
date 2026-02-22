
import { useEffect, useRef, useState } from 'react';
import { useJobMessages } from '@/hooks/useJobMessages';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Send, Loader2, Image as ImageIcon, Video as VideoIcon, X, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (messages && messages.length > 0) {
      markAsRead();
      // Scroll to bottom
      if (scrollRef.current) {
        scrollRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, markAsRead]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSending || uploading) return;

    const hasMedia = !!selectedImage || !!selectedVideo;
    if (!newMessage.trim() && !hasMedia) return;

    let contentToSend = newMessage.trim();

    if (hasMedia) {
      setUploading(true);
      try {
        const { data: { user: me } } = await supabase.auth.getUser();
        if (!me) throw new Error('Not authenticated');

        if (selectedImage) {
          const ext = selectedImage.name.split('.').pop();
          const name = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from('post-images').upload(name, selectedImage, { cacheControl: '3600', upsert: false });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('post-images').getPublicUrl(name);
          const payload = JSON.stringify({ type: 'image', url: urlData.publicUrl, caption: contentToSend || undefined });
          contentToSend = payload;
        } else if (selectedVideo) {
          const ext = selectedVideo.name.split('.').pop();
          const name = `${me.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error } = await supabase.storage.from('post-videos').upload(name, selectedVideo, { cacheControl: '3600', upsert: false });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('post-videos').getPublicUrl(name);
          const payload = JSON.stringify({ type: 'video', url: urlData.publicUrl, caption: contentToSend || undefined });
          contentToSend = payload;
        }
      } catch (err) {
        setUploading(false);
        return;
      }
    }

    sendMessage(contentToSend, {
      onSuccess: () => {
        setNewMessage('');
        setSelectedImage(null);
        setImagePreview(null);
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (videoPreview) URL.revokeObjectURL(videoPreview);
        setSelectedVideo(null);
        setVideoPreview(null);
        if (videoInputRef.current) videoInputRef.current.value = '';
        setUploading(false);
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
              let parsed: any = null;
              try {
                parsed = JSON.parse(msg.content);
              } catch {}
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
                    {parsed && parsed.type === 'image' && parsed.url ? (
                      <div className="space-y-2">
                        <img src={parsed.url} alt="attachment" className="max-h-64 rounded-md" />
                        {parsed.caption && <p>{parsed.caption}</p>}
                      </div>
                    ) : parsed && parsed.type === 'video' && parsed.url ? (
                      <div className="space-y-2">
                        <video src={parsed.url} controls className="max-h-64 rounded-md" />
                        {parsed.caption && <p>{parsed.caption}</p>}
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
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

      {/* Input + Media actions */}
      <form onSubmit={handleSend} className="p-4 border-t bg-muted/30 space-y-3">
        {(imagePreview || videoPreview) && (
          <div className="relative rounded-lg overflow-hidden bg-white border">
            {imagePreview && <img src={imagePreview} className="max-h-64 w-full object-contain" />}
            {videoPreview && <video src={videoPreview} controls className="max-h-64 w-full" />}
            <button
              type="button"
              onClick={() => {
                if (imagePreview) {
                  setSelectedImage(null);
                  setImagePreview(null);
                  if (imageInputRef.current) imageInputRef.current.value = '';
                }
                if (videoPreview) {
                  URL.revokeObjectURL(videoPreview);
                  setSelectedVideo(null);
                  setVideoPreview(null);
                  if (videoInputRef.current) videoInputRef.current.value = '';
                }
              }}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-red-500 rounded-full text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              type="file"
              accept="image/*"
              ref={imageInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!file.type.startsWith('image/')) return;
                setSelectedImage(file);
                const reader = new FileReader();
                reader.onload = (ev) => setImagePreview(ev.target?.result as string);
                reader.readAsDataURL(file);
                if (videoPreview) {
                  URL.revokeObjectURL(videoPreview);
                  setSelectedVideo(null);
                  setVideoPreview(null);
                  if (videoInputRef.current) videoInputRef.current.value = '';
                }
              }}
            />
            <input
              type="file"
              accept="video/mp4,video/webm"
              ref={videoInputRef}
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!['video/mp4','video/webm'].includes(file.type)) return;
                setSelectedVideo(file);
                setVideoPreview(URL.createObjectURL(file));
                setSelectedImage(null);
                setImagePreview(null);
                if (imageInputRef.current) imageInputRef.current.value = '';
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="bg-white border-gray-200 hover:bg-gray-50"
                  disabled={isSending || uploading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                  <ImageIcon className="h-4 w-4 mr-2" />
                  Photo
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                  <VideoIcon className="h-4 w-4 mr-2" />
                  Video
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder={selectedImage || selectedVideo ? "Add a caption..." : "Type your message..."}
            disabled={isSending || uploading}
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={isSending || uploading || (!newMessage.trim() && !selectedImage && !selectedVideo)}>
            {(isSending || uploading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};
