// Shared notification message/icon/link helpers -- previously duplicated
// near-verbatim between NotificationBell.tsx (the navbar dropdown) and
// Notifications.tsx (the full notifications page), which had drifted
// slightly out of sync (the page showed raw comment/message text, the
// dropdown didn't; the page recognized a 'certificate' type, the dropdown
// didn't). Consolidated here, keeping whichever behavior was more complete:
//   - comment / comment_reply: quote the actual comment text (from the page)
//   - message: show the actual message text (from the page)
//   - icon mapping: includes 'certificate' -> Award (from the page)
import {
  Bell,
  MessageCircle,
  UserPlus,
  Award,
  ThumbsUp,
  MessageSquare,
  Share2,
  Eye,
  Briefcase,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { REACTION_META, ReactionType } from '@/components/ReactionBar';

export interface NotificationPayload {
  sender_name?: string;
  sender_avatar?: string;
  message?: string;
  job_title?: string;
  post_id?: string;
  profile_id?: string;
  company_name?: string;
  location?: string;
  conversation_id?: string;
  connection_id?: string;
  skill_name?: string;
  endorser_id?: string;
  reactor_count?: number;
  latest_reaction_type?: ReactionType;
}

export interface NotificationLike {
  type: string;
  payload: NotificationPayload;
}

export const getNotificationIcon = (type: string): LucideIcon => {
  switch (type) {
    case 'like':
    case 'post_reaction':
      return ThumbsUp;
    case 'comment':
    case 'comment_reply':
      return MessageSquare;
    case 'share':
      return Share2;
    case 'connection_request':
    case 'connection_accepted':
      return UserPlus;
    case 'profile_view':
    case 'profile_save':
      return Eye;
    case 'new_job':
      return Briefcase;
    case 'message':
      return MessageCircle;
    case 'certificate':
      return Award;
    case 'skill_endorsement':
      return Star;
    default:
      return Bell;
  }
};

export const getNotificationMessage = (notification: NotificationLike): string => {
  const { type, payload } = notification;
  const senderName = payload?.sender_name || 'Someone';

  switch (type) {
    case 'like':
      return `${senderName} liked your post`;
    case 'post_reaction': {
      // Bundled: "Rahul celebrated your post." for the first reactor,
      // "5 people reacted to your post." once more people pile on -- never
      // one notification per reaction (see notify_post_reaction()).
      const count = payload?.reactor_count || 1;
      if (count > 1) {
        return `${count} people reacted to your post`;
      }
      const reactionType = payload?.latest_reaction_type;
      const verb = reactionType ? REACTION_META[reactionType].verb : 'reacted to';
      return `${senderName} ${verb} your post`;
    }
    case 'comment':
      return payload?.message ? `${senderName} commented: "${payload.message}"` : `${senderName} commented on your post`;
    case 'comment_reply':
      return payload?.message ? `${senderName} replied: "${payload.message}"` : `${senderName} replied to your comment`;
    case 'share':
      return `${senderName} shared your post`;
    case 'connection_request':
      return `${senderName} sent you a connection request`;
    case 'connection_accepted':
      return `${senderName} accepted your connection request`;
    case 'profile_view':
      return `${senderName} viewed your profile`;
    case 'profile_save':
      return `${senderName} saved your profile`;
    case 'new_job':
      return `New job posted: ${payload?.job_title || 'Check it out'}`;
    case 'message':
      return payload?.message ? `${senderName}: ${payload.message}` : `${senderName} sent you a message`;
    case 'skill_endorsement':
      return `${senderName} endorsed your ${payload?.skill_name || 'skill'}`;
    default:
      return payload?.message || 'New notification';
  }
};

export const getNotificationLink = (notification: NotificationLike): string => {
  const { type, payload } = notification;

  switch (type) {
    case 'like':
    case 'post_reaction':
    case 'comment':
    case 'comment_reply':
    case 'share':
      return `/dashboard?post=${payload?.post_id}`;
    case 'connection_request':
    case 'connection_accepted':
      return '/notifications';
    case 'profile_view':
    case 'profile_save':
    case 'skill_endorsement':
      return '/profile';
    case 'new_job':
      return '/jobs';
    case 'message':
      return '/connect';
    default:
      return '/notifications';
  }
};
